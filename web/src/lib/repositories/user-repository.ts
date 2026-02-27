import { ApiError, ErrorCode } from "@/lib/api-error";
import { pgQuery, pgQueryOne, pgRun } from "@/lib/postgres-query";
import type { FollowerItem, FollowerListResponse, FollowingItem, FollowingListResponse, User } from "@/types";

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

export class UserRepository {
  async findByUsername(username: string): Promise<User | null> {
    return pgQueryOne<User>("SELECT * FROM users WHERE username = ?", [username]);
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return pgQueryOne<User>("SELECT * FROM users WHERE username = ?", [username]);
  }

  async existsByUsername(username: string): Promise<boolean> {
    const row = await pgQueryOne<{ username: string }>("SELECT username FROM users WHERE username = ? LIMIT 1", [username]);
    return !!row;
  }

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

  async listAdmin(
    page = 1,
    size = 20,
    search = "",
    sort = "created_at_desc"
  ): Promise<PaginatedResult<Pick<User, "username" | "created_at">>> {
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    const keyword = search.trim();

    let where = "";
    const params: unknown[] = [];
    if (keyword) {
      where = "WHERE username LIKE ?";
      params.push(`%${keyword}%`);
    }

    const totalSql = `SELECT COUNT(*)::int AS cnt FROM users ${where}`;
    const total = (await pgQueryOne<{ cnt: number }>(totalSql, params))?.cnt || 0;

    let orderBy = "created_at DESC";
    if (sort === "created_at_asc") orderBy = "created_at ASC";
    if (sort === "username_asc") orderBy = "username ASC";
    if (sort === "username_desc") orderBy = "username DESC";

    const sql = `SELECT username, created_at FROM users ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const items = await pgQuery<Pick<User, "username" | "created_at">>(sql, [...params, validSize, offset]);

    return { items, total, page: validPage, size: validSize };
  }

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
