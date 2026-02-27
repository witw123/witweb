import { postRepository, userRepository } from "./repositories";
import type { User, UserProfile } from "@/types";

export function getUserByUsername(username: string): User | null {
  return userRepository.findByUsername(username);
}

export function publicProfile(username: string, viewer?: string | null): UserProfile | null {
  const user = getUserByUsername(username);
  if (!user) return null;

  const counts = userRepository.getFollowCounts(username);
  const likesReceived = postRepository.getUserLikesReceived(username);
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
    post_count: postRepository.getPostCountByAuthor(username),
    activity_count: postRepository.getActivityCount(username),
    like_received_count: likesReceived,
  };

  if (viewer && viewer !== username) {
    profile.is_following = userRepository.isFollowing(viewer, username);
  } else {
    profile.is_following = false;
  }

  return profile;
}
