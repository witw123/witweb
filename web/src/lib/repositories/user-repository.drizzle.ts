import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { getDb } from "@/lib/db/drizzle";
import { follows, users } from "@/lib/db/schema";
import type { FollowerItem, FollowerListResponse, FollowingItem, FollowingListResponse, User } from "@/types";

/** 用户基本信息类型（仅包含公开信息） */
type BasicUser = Pick<User, "username" | "nickname" | "avatar_url">;

/** 用户角色类型 */
type UserRole = NonNullable<User["role"]>;

/**
 * 规范化用户角色
 *
 * 将数据库中的角色字符串转换为有效的角色枚举值
 *
 * @param {string|null} role - 数据库中的角色字符串
 * @returns {User["role"]} 规范化的角色
 */
function normalizeRole(role: string | null): User["role"] {
  const value = (role || "user") as UserRole;
  const allowed: UserRole[] = [
    "super_admin",
    "content_reviewer",
    "operator",
    "admin",
    "user",
    "bot",
  ];
  return allowed.includes(value) ? value : "user";
}

/**
 * 用户数据仓库（Drizzle 实现）
 *
 * 负责用户相关的数据操作，包括用户查询、关注关系等
 */
export class DrizzleUserRepository {
  /**
   * 根据用户名查找用户
   *
   * @param {string} username - 用户名
   * @returns {Promise<User|null>} 用户信息，不存在则返回 null
   */
  async findByUsername(username: string): Promise<User | null> {
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        password: users.password,
        role: users.role,
        nickname: users.nickname,
        avatar_url: users.avatarUrl,
        cover_url: users.coverUrl,
        bio: users.bio,
        balance: users.balance,
        created_at: users.createdAt,
        last_read_notifications_at: users.lastReadNotificationsAt,
        is_bot: users.isBot,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!rows[0]) return null;

    return {
      ...rows[0],
      role: normalizeRole(rows[0].role),
    };
  }

  /**
   * 检查用户名是否存在
   *
   * @param {string} username - 用户名
   * @returns {Promise<boolean>} 是否存在
   */
  async existsByUsername(username: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return rows.length > 0;
  }

  /**
   * 批量获取用户基本信息
   *
   * @param {string[]} usernames - 用户名列表
   * @returns {Promise<BasicUser[]>} 用户基本信息列表
   */
  async listBasicByUsernames(usernames: string[]): Promise<BasicUser[]> {
    const db = getDb();
    const unique = Array.from(new Set(usernames.map((item) => item?.trim()).filter(Boolean)));
    if (unique.length === 0) return [];

    return db
      .select({
        username: users.username,
        nickname: users.nickname,
        avatar_url: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.username, unique));
  }

  /**
   * 获取用户关注数量
   *
   * @param {string} username - 用户名
   * @returns {{following_count: number; follower_count: number}} 关注数和粉丝数
   */
  async getFollowCounts(username: string): Promise<{ following_count: number; follower_count: number }> {
    const db = getDb();
    const [followingRow] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.follower, username));

    const [followersRow] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.following, username));

    return {
      following_count: Number(followingRow?.cnt || 0),
      follower_count: Number(followersRow?.cnt || 0),
    };
  }

  async isFollowing(follower: string, following: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .select({ follower: follows.follower })
      .from(follows)
      .where(and(eq(follows.follower, follower), eq(follows.following, following)))
      .limit(1);

    return rows.length > 0;
  }

  async follow(follower: string, following: string): Promise<boolean> {
    if (follower === following) {
      throw new ApiError(ErrorCode.BAD_REQUEST, "不能关注自己");
    }

    const db = getDb();
    const rows = await db
      .insert(follows)
      .values({
        follower,
        following,
        createdAt: sql`now()`,
      })
      .onConflictDoNothing()
      .returning({ id: follows.id });

    return rows.length > 0;
  }

  async unfollow(follower: string, following: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .delete(follows)
      .where(and(eq(follows.follower, follower), eq(follows.following, following)))
      .returning({ id: follows.id });

    return rows.length > 0;
  }

  async listFollowing(
    username: string,
    page = 1,
    size = 20,
    query?: string
  ): Promise<FollowingListResponse> {
    const db = getDb();
    const validPage = Math.max(1, page);
    const validSize = Math.max(1, Math.min(100, size));
    const offset = (validPage - 1) * validSize;
    const keyword = query?.trim();

    const where = keyword
      ? and(
          eq(follows.follower, username),
          or(ilike(users.username, `%${keyword}%`), ilike(users.nickname, `%${keyword}%`))
        )
      : eq(follows.follower, username);

    const [totalRow] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(follows)
      .innerJoin(users, eq(users.username, follows.following))
      .where(where);

    const items = await db
      .select({
        username: users.username,
        nickname: users.nickname,
        avatar_url: users.avatarUrl,
        bio: users.bio,
        follower_count: sql<number>`(
          SELECT COUNT(*)::int FROM follows f2 WHERE f2.following = ${users.username}
        )`,
        following_count: sql<number>`(
          SELECT COUNT(*)::int FROM follows f3 WHERE f3.follower = ${users.username}
        )`,
        is_mutual: sql<boolean>`EXISTS(
          SELECT 1 FROM follows f4
          WHERE f4.follower = ${users.username} AND f4.following = ${username}
        )`,
      })
      .from(follows)
      .innerJoin(users, eq(users.username, follows.following))
      .where(where)
      .orderBy(desc(follows.createdAt))
      .limit(validSize)
      .offset(offset);

    return {
      items: items.map((item) => ({
        ...item,
        follower_count: Number(item.follower_count || 0),
        following_count: Number(item.following_count || 0),
        is_mutual: Boolean(item.is_mutual),
      })) as FollowingItem[],
      total: Number(totalRow?.cnt || 0),
      page: validPage,
      size: validSize,
    };
  }

  async listFollowers(
    username: string,
    page = 1,
    size = 20,
    query?: string,
    viewer?: string
  ): Promise<FollowerListResponse> {
    const db = getDb();
    const validPage = Math.max(1, page);
    const validSize = Math.max(1, Math.min(100, size));
    const offset = (validPage - 1) * validSize;
    const keyword = query?.trim();
    const currentViewer = viewer || username;

    const where = keyword
      ? and(
          eq(follows.following, username),
          or(ilike(users.username, `%${keyword}%`), ilike(users.nickname, `%${keyword}%`))
        )
      : eq(follows.following, username);

    const [totalRow] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(follows)
      .innerJoin(users, eq(users.username, follows.follower))
      .where(where);

    const items = await db
      .select({
        username: users.username,
        nickname: users.nickname,
        avatar_url: users.avatarUrl,
        bio: users.bio,
        follower_count: sql<number>`(
          SELECT COUNT(*)::int FROM follows f2 WHERE f2.following = ${users.username}
        )`,
        following_count: sql<number>`(
          SELECT COUNT(*)::int FROM follows f3 WHERE f3.follower = ${users.username}
        )`,
        is_following: sql<boolean>`EXISTS(
          SELECT 1 FROM follows f4
          WHERE f4.follower = ${currentViewer} AND f4.following = ${users.username}
        )`,
      })
      .from(follows)
      .innerJoin(users, eq(users.username, follows.follower))
      .where(where)
      .orderBy(desc(follows.createdAt))
      .limit(validSize)
      .offset(offset);

    return {
      items: items.map((item) => ({
        ...item,
        follower_count: Number(item.follower_count || 0),
        following_count: Number(item.following_count || 0),
        is_following: Boolean(item.is_following),
      })) as FollowerItem[],
      total: Number(totalRow?.cnt || 0),
      page: validPage,
      size: validSize,
    };
  }
}

export const drizzleUserRepository = new DrizzleUserRepository();
