/**
 * 用户仓储层
 *
 * 负责用户资料、角色、关注关系和后台用户列表的数据访问。
 * 这里聚合了用户中心和后台都会用到的核心查询，避免用户相关 SQL 分散在多个服务里。
 */

import { ApiError, ErrorCode } from "@/lib/api-error";
import { pgQuery, pgQueryOne, pgRun } from "@/lib/postgres-query";
import type { FollowerItem, FollowerListResponse, FollowingItem, FollowingListResponse, User } from "@/types";
import { authConfig } from "@/lib/config";

export interface CreateUserData {
  username: string;
  password: string;
  nickname?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  is_bot?: boolean;
}

export interface UpdateUserData {
  nickname?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  balance?: number;
  last_read_notifications_at?: string;
}

export interface UpdatePasswordData {
  password: string;
}

/** 规范化用户列表分页参数。 */
function normalizePagination(page = 1, size = 20): { page: number; size: number; offset: number } {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(50, size));
  const offset = (validPage - 1) * validSize;
  return { page: validPage, size: validSize, offset };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface AdminUserListItem {
  username: string;
  created_at: string;
  role: "super_admin" | "content_reviewer" | "operator" | "admin" | "user" | "bot";
  activity_status: "active" | "inactive";
}

export class UserRepository {
  async findByUsername(username: string): Promise<User | null> {
    return pgQueryOne<User>("SELECT * FROM users WHERE username = ?", [username]);
  }

  /** 保留单独入口，便于未来区分是否允许读出密码字段。 */
  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return pgQueryOne<User>("SELECT * FROM users WHERE username = ?", [username]);
  }

  async existsByUsername(username: string): Promise<boolean> {
    const row = await pgQueryOne<{ username: string }>("SELECT username FROM users WHERE username = ? LIMIT 1", [username]);
    return !!row;
  }

  /** 创建用户并返回新用户 ID。 */
  async create(data: CreateUserData): Promise<number> {
    const now = new Date().toISOString();
    const row = await pgQueryOne<{ id: number }>(
      `
      INSERT INTO users (username, password, nickname, avatar_url, cover_url, bio, created_at, balance, is_bot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
      `,
      [
        data.username,
        data.password,
        data.nickname || data.username,
        data.avatar_url || "",
        data.cover_url || "",
        data.bio || "",
        now,
        0,
        data.is_bot ? 1 : 0,
      ]
    );
    return Number(row?.id || 0);
  }

  /** 动态更新用户资料，仅改动传入字段。 */
  async update(username: string, data: UpdateUserData): Promise<boolean> {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.nickname !== undefined) {
      fields.push("nickname = ?");
      params.push(data.nickname);
    }
    if (data.avatar_url !== undefined) {
      fields.push("avatar_url = ?");
      params.push(data.avatar_url);
    }
    if (data.cover_url !== undefined) {
      fields.push("cover_url = ?");
      params.push(data.cover_url);
    }
    if (data.bio !== undefined) {
      fields.push("bio = ?");
      params.push(data.bio);
    }
    if (data.balance !== undefined) {
      fields.push("balance = ?");
      params.push(data.balance);
    }
    if (data.last_read_notifications_at !== undefined) {
      fields.push("last_read_notifications_at = ?");
      params.push(data.last_read_notifications_at);
    }
    if (fields.length === 0) return false;

    params.push(username);
    const result = await pgRun(`UPDATE users SET ${fields.join(", ")} WHERE username = ?`, params);
    return result.changes > 0;
  }

  async updatePassword(username: string, hashedPassword: string): Promise<boolean> {
    const result = await pgRun("UPDATE users SET password = ? WHERE username = ?", [hashedPassword, username]);
    return result.changes > 0;
  }

  async updateBalance(username: string, amount: number): Promise<boolean> {
    const result = await pgRun("UPDATE users SET balance = balance + ? WHERE username = ?", [amount, username]);
    return result.changes > 0;
  }

  async markNotificationsAsRead(username: string): Promise<boolean> {
    const result = await pgRun("UPDATE users SET last_read_notifications_at = ? WHERE username = ?", [
      new Date().toISOString(),
      username,
    ]);
    return result.changes > 0;
  }

  async deleteByUsername(username: string): Promise<boolean> {
    const result = await pgRun("DELETE FROM users WHERE username = ?", [username]);
    return result.changes > 0;
  }

  async updateRole(
    username: string,
    role: "super_admin" | "content_reviewer" | "operator" | "admin" | "user" | "bot"
  ): Promise<boolean> {
    const result = await pgRun("UPDATE users SET role = ? WHERE username = ?", [role, username]);
    return result.changes > 0;
  }

  /** 批量删除普通用户，显式排除管理员和指定保留用户名。 */
  async bulkDeleteByUsernames(usernames: string[], excludeUsernames: string[] = []): Promise<number> {
    const targets = Array.from(new Set(usernames.map((item) => item.trim()).filter(Boolean)));
    if (targets.length === 0) return 0;

    const placeholders = targets.map(() => "?").join(", ");
    const params: unknown[] = [...targets];
    let sql = `DELETE FROM users WHERE username IN (${placeholders}) AND COALESCE(role, 'user') NOT IN ('admin', 'super_admin')`;

    const excludes = Array.from(new Set(excludeUsernames.map((item) => item.trim()).filter(Boolean)));
    if (excludes.length > 0) {
      const excludePlaceholders = excludes.map(() => "?").join(", ");
      sql += ` AND username NOT IN (${excludePlaceholders})`;
      params.push(...excludes);
    }

    return (await pgRun(sql, params)).changes;
  }

  /** 通用用户列表查询，支持关键字搜索。 */
  async list(page = 1, size = 20, search?: string): Promise<PaginatedResult<User>> {
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    let whereClause = "";
    let params: unknown[] = [];

    if (search?.trim()) {
      whereClause = "username LIKE ? OR nickname LIKE ?";
      params = [`%${search.trim()}%`, `%${search.trim()}%`];
    }

    const countSql = whereClause
      ? `SELECT COUNT(*)::int AS cnt FROM users WHERE ${whereClause}`
      : "SELECT COUNT(*)::int AS cnt FROM users";
    const total = (await pgQueryOne<{ cnt: number }>(countSql, params))?.cnt || 0;

    const dataSql = whereClause
      ? `SELECT * FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      : `SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const items = await pgQuery<User>(dataSql, [...params, validSize, offset]);

    return { items, total, page: validPage, size: validSize };
  }

  /**
   * 后台用户列表
   *
   * 支持按角色、活跃度和关键字筛选，并把超级管理员用户名映射到固定角色标签。
   */
  async listAdmin(
    page = 1,
    size = 20,
    search = "",
    sort = "created_at_desc",
    role = "",
    activity = ""
  ): Promise<PaginatedResult<AdminUserListItem>> {
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    const keyword = search.trim();
    const adminUsername = authConfig.adminUsername;

    const whereParts: string[] = [];
    const params: unknown[] = [];
    const activeExpr = `(
      EXISTS(SELECT 1 FROM posts p WHERE p.author = u.username AND p.created_at::timestamptz >= NOW() - INTERVAL '30 days')
      OR EXISTS(SELECT 1 FROM comments c WHERE c.author = u.username AND c.created_at::timestamptz >= NOW() - INTERVAL '30 days')
      OR EXISTS(SELECT 1 FROM likes l WHERE l.username = u.username AND l.created_at::timestamptz >= NOW() - INTERVAL '30 days')
    )`;

    if (keyword) {
      whereParts.push("u.username LIKE ?");
      params.push(`%${keyword}%`);
    }
    if (role.trim()) {
      if (role.trim() === "super_admin") {
        whereParts.push("u.username = ?");
        params.push(adminUsername);
      } else if (role.trim() === "admin") {
        whereParts.push("COALESCE(u.role, 'user') = ? AND u.username <> ?");
        params.push("admin", adminUsername);
      } else {
        whereParts.push("COALESCE(u.role, 'user') = ?");
        params.push(role.trim());
      }
    }
    if (activity === "active") whereParts.push(activeExpr);
    if (activity === "inactive") whereParts.push(`NOT ${activeExpr}`);
    const where = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const totalSql = `SELECT COUNT(*)::int AS cnt FROM users u ${where}`;
    const total = (await pgQueryOne<{ cnt: number }>(totalSql, params))?.cnt || 0;

    let orderBy = "created_at DESC";
    if (sort === "created_at_asc") orderBy = "created_at ASC";
    if (sort === "username_asc") orderBy = "username ASC";
    if (sort === "username_desc") orderBy = "username DESC";
    if (sort === "role_asc") orderBy = "role ASC";
    if (sort === "role_desc") orderBy = "role DESC";

    const sql = `SELECT
      u.username,
      u.created_at,
      CASE WHEN u.username = ? THEN 'super_admin' ELSE COALESCE(u.role, 'user') END AS role,
      CASE WHEN ${activeExpr} THEN 'active' ELSE 'inactive' END AS activity_status
      FROM users u ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const items = await pgQuery<AdminUserListItem>(
      sql,
      [adminUsername, ...params, validSize, offset]
    );

    return { items, total, page: validPage, size: validSize };
  }

  /** 批量查询基础用户资料，适合列表补齐昵称和头像。 */
  async listBasicByUsernames(usernames: string[]): Promise<Array<Pick<User, "username" | "nickname" | "avatar_url">>> {
    const unique = Array.from(new Set(usernames.map((item) => item?.trim()).filter(Boolean)));
    if (unique.length === 0) return [];
    const placeholders = unique.map(() => "?").join(", ");
    const sql = `SELECT username, nickname, avatar_url FROM users WHERE username IN (${placeholders})`;
    return pgQuery<Pick<User, "username" | "nickname" | "avatar_url">>(sql, unique);
  }

  async deleteFollowRelations(username: string): Promise<number> {
    const result = await pgRun("DELETE FROM follows WHERE follower = ? OR following = ?", [username, username]);
    return result.changes;
  }

  /** 查询关注数和粉丝数。 */
  async getFollowCounts(username: string): Promise<{ following_count: number; follower_count: number }> {
    const following =
      (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM follows WHERE follower = ?", [username]))?.cnt || 0;
    const followers =
      (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM follows WHERE following = ?", [username]))?.cnt || 0;

    return {
      following_count: following,
      follower_count: followers,
    };
  }

  async isFollowing(follower: string, following: string): Promise<boolean> {
    const row = await pgQueryOne<{ follower: string }>(
      "SELECT follower FROM follows WHERE follower = ? AND following = ? LIMIT 1",
      [follower, following]
    );
    return !!row;
  }

  /** 关注前显式阻止自己关注自己。 */
  async follow(follower: string, following: string): Promise<boolean> {
    if (follower === following) {
      throw new ApiError(ErrorCode.BAD_REQUEST, "不能关注自己");
    }

    const result = await pgRun(
      `
      INSERT INTO follows (follower, following, created_at)
      VALUES (?, ?, NOW())
      ON CONFLICT DO NOTHING
      `,
      [follower, following]
    );
    return result.changes > 0;
  }

  async unfollow(follower: string, following: string): Promise<boolean> {
    const result = await pgRun("DELETE FROM follows WHERE follower = ? AND following = ?", [follower, following]);
    return result.changes > 0;
  }

  /** 查询当前用户的关注列表。 */
  async listFollowing(
    username: string,
    page = 1,
    size = 20,
    query?: string
  ): Promise<FollowingListResponse> {
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    const keyword = query?.trim();

    let totalSql: string;
    let totalParams: unknown[];
    if (keyword) {
      totalSql = `
        SELECT COUNT(*)::int AS cnt
        FROM follows f
        JOIN users u ON u.username = f.following
        WHERE f.follower = ? AND (u.username LIKE ? OR u.nickname LIKE ?)
      `;
      totalParams = [username, `%${keyword}%`, `%${keyword}%`];
    } else {
      totalSql = "SELECT COUNT(*)::int AS cnt FROM follows WHERE follower = ?";
      totalParams = [username];
    }
    const total = (await pgQueryOne<{ cnt: number }>(totalSql, totalParams))?.cnt || 0;

    let dataSql: string;
    let dataParams: unknown[];
    if (keyword) {
      dataSql = `
        SELECT
          u.username,
          u.nickname,
          u.avatar_url,
          u.bio,
          (SELECT COUNT(*)::int FROM follows f2 WHERE f2.following = u.username) AS follower_count,
          (SELECT COUNT(*)::int FROM follows f3 WHERE f3.follower = u.username) AS following_count,
          EXISTS(SELECT 1 FROM follows f4 WHERE f4.follower = u.username AND f4.following = ?) AS is_mutual
        FROM follows f
        JOIN users u ON u.username = f.following
        WHERE f.follower = ? AND (u.username LIKE ? OR u.nickname LIKE ?)
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      dataParams = [username, username, `%${keyword}%`, `%${keyword}%`, validSize, offset];
    } else {
      dataSql = `
        SELECT
          u.username,
          u.nickname,
          u.avatar_url,
          u.bio,
          (SELECT COUNT(*)::int FROM follows f2 WHERE f2.following = u.username) AS follower_count,
          (SELECT COUNT(*)::int FROM follows f3 WHERE f3.follower = u.username) AS following_count,
          EXISTS(SELECT 1 FROM follows f4 WHERE f4.follower = u.username AND f4.following = ?) AS is_mutual
        FROM follows f
        JOIN users u ON u.username = f.following
        WHERE f.follower = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      dataParams = [username, username, validSize, offset];
    }

    const items = await pgQuery<FollowingItem>(dataSql, dataParams);
    return { items, total, page: validPage, size: validSize };
  }

  /** 查询当前用户的粉丝列表，并附带“我是否已回关”状态。 */
  async listFollowers(
    username: string,
    page = 1,
    size = 20,
    query?: string,
    viewer?: string
  ): Promise<FollowerListResponse> {
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    const keyword = query?.trim();

    let totalSql: string;
    let totalParams: unknown[];
    if (keyword) {
      totalSql = `
        SELECT COUNT(*)::int AS cnt
        FROM follows f
        JOIN users u ON u.username = f.follower
        WHERE f.following = ? AND (u.username LIKE ? OR u.nickname LIKE ?)
      `;
      totalParams = [username, `%${keyword}%`, `%${keyword}%`];
    } else {
      totalSql = "SELECT COUNT(*)::int AS cnt FROM follows WHERE following = ?";
      totalParams = [username];
    }
    const total = (await pgQueryOne<{ cnt: number }>(totalSql, totalParams))?.cnt || 0;

    let dataSql: string;
    let dataParams: unknown[];
    if (keyword) {
      dataSql = `
        SELECT
          u.username,
          u.nickname,
          u.avatar_url,
          u.bio,
          (SELECT COUNT(*)::int FROM follows f2 WHERE f2.following = u.username) AS follower_count,
          (SELECT COUNT(*)::int FROM follows f3 WHERE f3.follower = u.username) AS following_count,
          EXISTS(SELECT 1 FROM follows f4 WHERE f4.follower = ? AND f4.following = u.username) AS is_following
        FROM follows f
        JOIN users u ON u.username = f.follower
        WHERE f.following = ? AND (u.username LIKE ? OR u.nickname LIKE ?)
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      dataParams = [viewer || username, username, `%${keyword}%`, `%${keyword}%`, validSize, offset];
    } else {
      dataSql = `
        SELECT
          u.username,
          u.nickname,
          u.avatar_url,
          u.bio,
          (SELECT COUNT(*)::int FROM follows f2 WHERE f2.following = u.username) AS follower_count,
          (SELECT COUNT(*)::int FROM follows f3 WHERE f3.follower = u.username) AS following_count,
          EXISTS(SELECT 1 FROM follows f4 WHERE f4.follower = ? AND f4.following = u.username) AS is_following
        FROM follows f
        JOIN users u ON u.username = f.follower
        WHERE f.following = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      dataParams = [viewer || username, username, validSize, offset];
    }

    const items = await pgQuery<FollowerItem>(dataSql, dataParams);
    return { items, total, page: validPage, size: validSize };
  }

  async count(): Promise<number> {
    return (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM users"))?.cnt || 0;
  }
}

export const userRepository = new UserRepository();
