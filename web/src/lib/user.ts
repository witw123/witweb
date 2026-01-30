import { getUsersDb } from "./db";
import { followCounts, isFollowing } from "./follow";

export function getUserByUsername(username: string) {
  const db = getUsersDb();
  const row = db.prepare("SELECT username, password, nickname, avatar_url, balance, created_at FROM users WHERE username = ?")
    .get(username) as any;
  return row || null;
}

export function publicProfile(username: string, viewer?: string | null) {
  const user = getUserByUsername(username);
  if (!user) return null;
  const counts = followCounts(username);
  const profile: any = {
    username: user.username,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    following_count: counts.following_count,
    follower_count: counts.follower_count,
  };
  if (viewer && viewer !== username) {
    profile.is_following = isFollowing(viewer, username);
  } else {
    profile.is_following = false;
  }
  return profile;
}
