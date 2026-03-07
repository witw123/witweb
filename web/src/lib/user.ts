import { drizzlePostRepository, drizzleUserRepository } from "./repositories";
import type { User, UserProfile } from "@/types";

export async function getUserByUsername(username: string): Promise<User | null> {
  return await drizzleUserRepository.findByUsername(username);
}

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
