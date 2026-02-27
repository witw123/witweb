/**
 */

import type Database from "better-sqlite3";
import { BaseRepository, type QueryOptions, type PaginatedResult } from "./base-repository";
import { getUsersDb } from "@/lib/db";
import { ApiError, ErrorCode } from "@/lib/api-error";
import type { User, FollowingItem, FollowerItem, FollowingListResponse, FollowerListResponse } from "@/types";

/**
 */
export interface CreateUserData {
  username: string;
  password: string;
  nickname?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  is_bot?: boolean;
}

/**
 */
export interface UpdateUserData {
  nickname?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  balance?: number;
  last_read_notifications_at?: string;
}

/**
 */
export interface UpdatePasswordData {
  password: string;
}

/**
 */
export class UserRepository extends BaseRepository<User, number> {
  protected readonly tableName = "users";
  protected readonly primaryKey = "id";

  protected getDb(options?: QueryOptions): Database {
    return options?.db || getUsersDb();
  }


  /**
   */
  findByUsername(username: string, options?: QueryOptions): User | null {
    return this.findOne("username = ?", [username], options);
  }

  /**
   */
  findByUsernameWithPassword(username: string, options?: QueryOptions): User | null {
    const sql = `SELECT * FROM users WHERE username = ?`;
    return this.queryOne<User>(sql, [username], options);
  }

  /**
   */
  existsByUsername(username: string, options?: QueryOptions): boolean {
    return this.exists("username = ?", [username], options);
  }

  /**
   */
  create(data: CreateUserData, options?: QueryOptions): number {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO users (username, password, nickname, avatar_url, cover_url, bio, created_at, balance, is_bot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = this.run(sql, [
      data.username,
      data.password,
      data.nickname || data.username,
      data.avatar_url || "",
      data.cover_url || "",
      data.bio || "",
      now,
      0,
      data.is_bot ? 1 : 0,
    ], options);
    return Number(result.lastInsertRowid);
  }

  /**
   */
  update(username: string, data: UpdateUserData, options?: QueryOptions): boolean {
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
    const sql = `UPDATE users SET ${fields.join(", ")} WHERE username = ?`;
    const result = this.run(sql, params, options);
    return result.changes > 0;
  }

  /**
   */
  updatePassword(username: string, hashedPassword: string, options?: QueryOptions): boolean {
    const sql = `UPDATE users SET password = ? WHERE username = ?`;
    const result = this.run(sql, [hashedPassword, username], options);
    return result.changes > 0;
  }

  /**
   */
  updateBalance(username: string, amount: number, options?: QueryOptions): boolean {
    const sql = `UPDATE users SET balance = balance + ? WHERE username = ?`;
    const result = this.run(sql, [amount, username], options);
    return result.changes > 0;
  }

  /**
   */
  markNotificationsAsRead(username: string, options?: QueryOptions): boolean {
    const sql = `UPDATE users SET last_read_notifications_at = ? WHERE username = ?`;
    const result = this.run(sql, [new Date().toISOString(), username], options);
    return result.changes > 0;
  }

  /**
   */
  deleteByUsername(username: string, options?: QueryOptions): boolean {
    const sql = `DELETE FROM users WHERE username = ?`;
    const result = this.run(sql, [username], options);
    return result.changes > 0;
  }

  /**
   */
  list(page = 1, size = 20, search?: string, options?: QueryOptions): PaginatedResult<User> {
    const { page: validPage, size: validSize, offset } = this.normalizePagination(page, size);
    
    let whereClause = "";
    let params: unknown[] = [];
    
    if (search?.trim()) {
      whereClause = "username LIKE ? OR nickname LIKE ?";
      params = [`%${search.trim()}%`, `%${search.trim()}%`];
    }

    const total = this.count(whereClause, params, options);

    const sql = whereClause
      ? `SELECT * FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      : `SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    
    const items = this.query<User>(sql, [...params, validSize, offset], options);

    return { items, total, page: validPage, size: validSize };
  }

  listAdmin(
    page = 1,
    size = 20,
    search = "",
    sort = "created_at_desc",
    options?: QueryOptions
  ): PaginatedResult<Pick<User, "username" | "created_at">> {
    const { page: validPage, size: validSize, offset } = this.normalizePagination(page, size);
    const keyword = search.trim();

    let where = "";
    const params: unknown[] = [];
    if (keyword) {
      where = "WHERE username LIKE ?";
      params.push(`%${keyword}%`);
    }

    const totalSql = `SELECT COUNT(*) AS cnt FROM users ${where}`;
    const total = (this.queryOne<{ cnt: number }>(totalSql, params, options)?.cnt) || 0;

    let orderBy = "created_at DESC";
    if (sort === "created_at_asc") orderBy = "created_at ASC";
    if (sort === "username_asc") orderBy = "username ASC";
    if (sort === "username_desc") orderBy = "username DESC";

    const sql = `SELECT username, created_at FROM users ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const items = this.query<Pick<User, "username" | "created_at">>(
      sql,
      [...params, validSize, offset],
      options
    );

    return { items, total, page: validPage, size: validSize };
  }

  listBasicByUsernames(
    usernames: string[],
    options?: QueryOptions
  ): Array<Pick<User, "username" | "nickname" | "avatar_url">> {
    const unique = Array.from(new Set(usernames.map((item) => item?.trim()).filter(Boolean)));
    if (unique.length === 0) return [];

    const placeholders = unique.map(() => "?").join(", ");
    const sql = `SELECT username, nickname, avatar_url FROM users WHERE username IN (${placeholders})`;
    return this.query<Pick<User, "username" | "nickname" | "avatar_url">>(sql, unique, options);
  }

  deleteFollowRelations(username: string, options?: QueryOptions): number {
    const sql = `DELETE FROM follows WHERE follower = ? OR following = ?`;
    const result = this.run(sql, [username, username], options);
    return result.changes;
  }


  /**
   */
  getFollowCounts(username: string, options?: QueryOptions): { following_count: number; follower_count: number } {
    const db = this.getDb(options);
    
    const following = db.prepare("SELECT COUNT(*) AS cnt FROM follows WHERE follower = ?")
      .get(username) as { cnt: number };
    const followers = db.prepare("SELECT COUNT(*) AS cnt FROM follows WHERE following = ?")
      .get(username) as { cnt: number };

    return {
      following_count: following?.cnt || 0,
      follower_count: followers?.cnt || 0,
    };
  }

  /**
   */
  isFollowing(follower: string, following: string, options?: QueryOptions): boolean {
    const sql = `SELECT 1 FROM follows WHERE follower = ? AND following = ?`;
    const result = this.queryOne<Record<string, unknown>>(sql, [follower, following], options);
    return !!result;
  }

  /**
   */
  follow(follower: string, following: string, options?: QueryOptions): boolean {
    if (follower === following) {
      throw new ApiError(ErrorCode.BAD_REQUEST, "不能关注自己");
    }
    
    const sql = `
      INSERT OR IGNORE INTO follows (follower, following, created_at)
      VALUES (?, ?, datetime('now', 'localtime'))
    `;
    const result = this.run(sql, [follower, following], options);
    return result.changes > 0;
  }

  /**
   */
  unfollow(follower: string, following: string, options?: QueryOptions): boolean {
    const sql = `DELETE FROM follows WHERE follower = ? AND following = ?`;
    const result = this.run(sql, [follower, following], options);
    return result.changes > 0;
  }

  /**
   */
  listFollowing(
    username: string,
    page = 1,
    size = 20,
    query?: string,
    viewer?: string,
    options?: QueryOptions
  ): FollowingListResponse {
    const { page: validPage, size: validSize, offset } = this.normalizePagination(page, size);
    const db = this.getDb(options);
    const keyword = query?.trim();

    let totalSql: string;
    let totalParams: unknown[];
    
    if (keyword) {
      totalSql = `
        SELECT COUNT(*) AS cnt
        FROM follows f
        JOIN users u ON u.username = f.following
        WHERE f.follower = ? AND (u.username LIKE ? OR u.nickname LIKE ?)
      `;
      totalParams = [username, `%${keyword}%`, `%${keyword}%`];
    } else {
      totalSql = `SELECT COUNT(*) AS cnt FROM follows WHERE follower = ?`;
      totalParams = [username];
    }
    
    const totalResult = db.prepare(totalSql).get(...totalParams) as { cnt: number };
    const total = totalResult?.cnt || 0;

    let dataSql: string;
    let dataParams: unknown[];

    if (keyword) {
      dataSql = `
        SELECT
          u.username,
          u.nickname,
          u.avatar_url,
          u.bio,
          (SELECT COUNT(*) FROM follows f2 WHERE f2.following = u.username) AS follower_count,
          (SELECT COUNT(*) FROM follows f3 WHERE f3.follower = u.username) AS following_count,
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
          (SELECT COUNT(*) FROM follows f2 WHERE f2.following = u.username) AS follower_count,
          (SELECT COUNT(*) FROM follows f3 WHERE f3.follower = u.username) AS following_count,
          EXISTS(SELECT 1 FROM follows f4 WHERE f4.follower = u.username AND f4.following = ?) AS is_mutual
        FROM follows f
        JOIN users u ON u.username = f.following
        WHERE f.follower = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      dataParams = [username, username, validSize, offset];
    }

    const items = db.prepare(dataSql).all(...dataParams) as FollowingItem[];

    return { items, total, page: validPage, size: validSize };
  }

  /**
   */
  listFollowers(
    username: string,
    page = 1,
    size = 20,
    query?: string,
    viewer?: string,
    options?: QueryOptions
  ): FollowerListResponse {
    const { page: validPage, size: validSize, offset } = this.normalizePagination(page, size);
    const db = this.getDb(options);
    const keyword = query?.trim();

    let totalSql: string;
    let totalParams: unknown[];
    
    if (keyword) {
      totalSql = `
        SELECT COUNT(*) AS cnt
        FROM follows f
        JOIN users u ON u.username = f.follower
        WHERE f.following = ? AND (u.username LIKE ? OR u.nickname LIKE ?)
      `;
      totalParams = [username, `%${keyword}%`, `%${keyword}%`];
    } else {
      totalSql = `SELECT COUNT(*) AS cnt FROM follows WHERE following = ?`;
      totalParams = [username];
    }
    
    const totalResult = db.prepare(totalSql).get(...totalParams) as { cnt: number };
    const total = totalResult?.cnt || 0;

    let dataSql: string;
    let dataParams: unknown[];

    if (keyword) {
      dataSql = `
        SELECT
          u.username,
          u.nickname,
          u.avatar_url,
          u.bio,
          (SELECT COUNT(*) FROM follows f2 WHERE f2.following = u.username) AS follower_count,
          (SELECT COUNT(*) FROM follows f3 WHERE f3.follower = u.username) AS following_count,
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
          (SELECT COUNT(*) FROM follows f2 WHERE f2.following = u.username) AS follower_count,
          (SELECT COUNT(*) FROM follows f3 WHERE f3.follower = u.username) AS following_count,
          EXISTS(SELECT 1 FROM follows f4 WHERE f4.follower = ? AND f4.following = u.username) AS is_following
        FROM follows f
        JOIN users u ON u.username = f.follower
        WHERE f.following = ?
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
      `;
      dataParams = [viewer || username, username, validSize, offset];
    }

    const items = db.prepare(dataSql).all(...dataParams) as FollowerItem[];

    return { items, total, page: validPage, size: validSize };
  }
}

export const userRepository = new UserRepository();
