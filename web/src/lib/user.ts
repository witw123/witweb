/**
 * 用户工具函数
 *
 * 提供用户相关的业务逻辑函数
 */

import { drizzlePostRepository, drizzleUserRepository } from "./repositories";
import type { User, UserProfile } from "@/types";

/**
 * 根据用户名获取用户
 *
 * @param {string} username - 用户名
 * @returns {Promise<User|null>} 用户对象
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  return await drizzleUserRepository.findByUsername(username);
}

/**
 * 获取用户公开资料
 *
 * @param {string} username - 用户名
 * @param {string|null} [viewer] - 查看者用户名
 * @returns {Promise<UserProfile|null>} 用户公开资料
 */
export async function publicProfile(username: string, viewer?: string | null): Promise<UserProfile | null> {
  const user = await getUserByUsername(username);
  if (!user) return null;

  const counts = await drizzleUserRepository.getFollowCounts(username);
  const likesReceived = await drizzlePostRepository.getUserLikesReceived(username);
  const profile: UserProfile = {
    username: user.username,
    role: user.role || "user",
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    cover_url: user.cover_url || "",
    bio: user.bio || "",
    created_at: user.created_at,
    following_count: counts.following_count,
    follower_count: counts.follower_count,
    post_count: await drizzlePostRepository.getPostCountByAuthor(username),
    activity_count: await drizzlePostRepository.getActivityCount(username),
    like_received_count: likesReceived,
  };

  if (viewer && viewer !== username) {
    profile.is_following = await drizzleUserRepository.isFollowing(viewer, username);
  } else {
    profile.is_following = false;
  }

  return profile;
}
