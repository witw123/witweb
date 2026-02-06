import { getUsersDb } from "./db";
import type { FollowCounts, FollowingItem, FollowerItem } from "@/types";

interface CountRow {
  cnt: number;
}

export function followCounts(username: string): FollowCounts {
  const db = getUsersDb();
  const following = db.prepare("SELECT COUNT(*) AS cnt FROM follows WHERE follower = ?").get(username) as CountRow;
  const followers = db.prepare("SELECT COUNT(*) AS cnt FROM follows WHERE following = ?").get(username) as CountRow;
  return {
    following_count: following?.cnt || 0,
    follower_count: followers?.cnt || 0,
  };
}

export function isFollowing(follower: string, following: string): boolean {
  const db = getUsersDb();
  const row = db.prepare("SELECT 1 FROM follows WHERE follower = ? AND following = ?")
    .get(follower, following);
  return !!row;
}

export function followUser(follower: string, following: string): void {
  const db = getUsersDb();
  if (follower === following) return;
  db.prepare("INSERT OR IGNORE INTO follows (follower, following) VALUES (?, ?)")
    .run(follower, following);
}

export function unfollowUser(follower: string, following: string): void {
  const db = getUsersDb();
  db.prepare("DELETE FROM follows WHERE follower = ? AND following = ?")
    .run(follower, following);
}

interface FollowingQueryRow {
  username: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  is_mutual: number;
}

interface FollowerQueryRow {
  username: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  is_following: number;
}

export function listFollowing(username: string, page = 1, size = 20, query = ""): { items: FollowingItem[]; total: number; page: number; size: number } {
  const db = getUsersDb();
  page = Math.max(1, page);
  size = Math.max(1, Math.min(50, size));
  const offset = (page - 1) * size;
  const keyword = query.trim();

  let total = 0;
  if (keyword) {
    const row = db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM follows f
      JOIN users u ON u.username = f.following
      WHERE f.follower = ? AND (u.username LIKE ? OR u.nickname LIKE ?)
    `).get(username, `%${keyword}%`, `%${keyword}%`) as CountRow;
    total = row?.cnt || 0;
  } else {
    const row = db.prepare("SELECT COUNT(*) AS cnt FROM follows WHERE follower = ?").get(username) as CountRow;
    total = row?.cnt || 0;
  }

  const rows = keyword
    ? db.prepare(`
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
      `).all(username, username, `%${keyword}%`, `%${keyword}%`, size, offset)
    : db.prepare(`
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
      `).all(username, username, size, offset);

  const items = (rows as FollowingQueryRow[]).map(row => ({
    username: row.username,
    nickname: row.nickname,
    avatar_url: row.avatar_url,
    bio: row.bio,
    follower_count: row.follower_count,
    following_count: row.following_count,
    is_mutual: Boolean(row.is_mutual)
  } satisfies FollowingItem));

  return { items, total, page, size };
}

export function listFollowers(username: string, page = 1, size = 20, query = ""): { items: FollowerItem[]; total: number; page: number; size: number } {
  const db = getUsersDb();
  page = Math.max(1, page);
  size = Math.max(1, Math.min(50, size));
  const offset = (page - 1) * size;
  const keyword = query.trim();

  let total = 0;
  if (keyword) {
    const row = db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM follows f
      JOIN users u ON u.username = f.follower
      WHERE f.following = ? AND (u.username LIKE ? OR u.nickname LIKE ?)
    `).get(username, `%${keyword}%`, `%${keyword}%`) as CountRow;
    total = row?.cnt || 0;
  } else {
    const row = db.prepare("SELECT COUNT(*) AS cnt FROM follows WHERE following = ?").get(username) as CountRow;
    total = row?.cnt || 0;
  }

  const rows = keyword
    ? db.prepare(`
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
      `).all(username, username, `%${keyword}%`, `%${keyword}%`, size, offset)
    : db.prepare(`
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
      `).all(username, username, size, offset);

  const items = (rows as FollowerQueryRow[]).map(row => ({
    username: row.username,
    nickname: row.nickname,
    avatar_url: row.avatar_url,
    bio: row.bio,
    follower_count: row.follower_count,
    following_count: row.following_count,
    is_following: Boolean(row.is_following)
  } satisfies FollowerItem));

  return { items, total, page, size };
}
