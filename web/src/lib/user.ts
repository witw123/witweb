import { getUsersDb } from "./db";
import { followCounts, isFollowing } from "./follow";
import { getUserLikesReceived, getPostCount } from "./blog";

export function getUserByUsername(username: string) {
  const db = getUsersDb();
  const row = db.prepare("SELECT id, username, password, nickname, avatar_url, cover_url, bio, balance, created_at FROM users WHERE username = ?")
    .get(username) as any;
  return row || null;
}

export function publicProfile(username: string, viewer?: string | null) {
  const user = getUserByUsername(username);
  if (!user) return null;
  const counts = followCounts(username);
  const likesReceived = getUserLikesReceived(username);
  const profile: any = {
    username: user.username,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    cover_url: user.cover_url || "",
    bio: user.bio || "",
    created_at: user.created_at,
    following_count: counts.following_count,
    follower_count: counts.follower_count,
    post_count: getPostCount(username),
    like_received_count: likesReceived,
  };
  if (viewer && viewer !== username) {
    profile.is_following = isFollowing(viewer, username);
  } else {
    profile.is_following = false;
  }
  return profile;
}
