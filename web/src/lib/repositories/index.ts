import { userRepository } from "./user-repository";
import { postRepository } from "./post-repository";
import { commentRepository } from "./comment-repository";
import { videoTaskRepository } from "./video-task-repository";
import { messageRepository } from "./message-repository";
import { agentRepository } from "./agent-repository";
import { topicRadarRepository } from "./topic-radar-repository";
import { secureConfigRepository } from "./secure-config-repository";

export {
  type PaginationParams,
  type PaginatedResult,
  type SortDirection,
  type SortOptions,
} from "./types";

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

export {
  agentRepository,
  type AgentType as RepositoryAgentType,
  type AgentStatus as RepositoryAgentStatus,
  type AgentStepStatus as RepositoryAgentStepStatus,
  type ArtifactKind as RepositoryArtifactKind,
  type AgentRunRow,
  type AgentStepRow,
  type AgentArtifactRow,
} from "./agent-repository";

export { topicRadarRepository } from "./topic-radar-repository";
export { secureConfigRepository } from "./secure-config-repository";

export const repositories = {
  user: userRepository,
  post: postRepository,
  comment: commentRepository,
  videoTask: videoTaskRepository,
  message: messageRepository,
  agent: agentRepository,
  topicRadar: topicRadarRepository,
  secureConfig: secureConfigRepository,
} as const;

export type Repositories = typeof repositories;

