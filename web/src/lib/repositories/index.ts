import { userRepository } from "./user-repository";
import { postRepository } from "./post-repository";
import { commentRepository } from "./comment-repository";
import { videoTaskRepository } from "./video-task-repository";
import { messageRepository } from "./message-repository";

export {
  BaseRepository,
  type QueryOptions,
  type PaginationParams,
  type PaginatedResult,
  type SortDirection,
  type SortOptions,
} from "./base-repository";

export {
  UserRepository,
  userRepository,
  type CreateUserData,
  type UpdateUserData,
  type UpdatePasswordData,
} from "./user-repository";

export {
  PostRepository,
  postRepository,
  type CreatePostData,
  type UpdatePostData,
  type ListPostsParams,
} from "./post-repository";

export {
  CommentRepository,
  commentRepository,
  type CreateCommentData,
  type UpdateCommentData,
} from "./comment-repository";

export {
  VideoTaskRepository,
  videoTaskRepository,
  type CreateVideoTaskData,
  type UpdateVideoTaskData,
  type CreateCharacterData,
} from "./video-task-repository";

export {
  MessageRepository,
  messageRepository,
  type SendMessageData,
  type CreateConversationData,
} from "./message-repository";

export const repositories = {
  user: userRepository,
  post: postRepository,
  comment: commentRepository,
  videoTask: videoTaskRepository,
  message: messageRepository,
} as const;

export type Repositories = typeof repositories;
