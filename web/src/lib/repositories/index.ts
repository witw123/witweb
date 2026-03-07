import { userRepository } from "./user-repository";
import { postRepository } from "./post-repository";
import { commentRepository } from "./comment-repository";
import { videoTaskRepository } from "./video-task-repository";
import { messageRepository } from "./message-repository";
import { drizzleMessageRepository } from "./message-repository.drizzle";
import { agentRepository } from "./agent-repository";
import { drizzleAgentRepository } from "./agent-repository.drizzle";
import { topicRadarRepository } from "./topic-radar-repository";
import { drizzleTopicRadarRepository } from "./topic-radar-repository.drizzle";
import { secureConfigRepository } from "./secure-config-repository";
import { auditLogRepository } from "./audit-log-repository";
import { aboutRepository } from "./about-repository";
import { drizzleCategoryRepository } from "./category-repository.drizzle";
import { drizzleCommentRepository } from "./comment-repository.drizzle";
import { drizzlePostRepository } from "./post-repository.drizzle";
import { drizzleUserRepository } from "./user-repository.drizzle";

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
export { drizzleMessageRepository } from "./message-repository.drizzle";

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
export { drizzleAgentRepository } from "./agent-repository.drizzle";

export { topicRadarRepository } from "./topic-radar-repository";
export { drizzleTopicRadarRepository } from "./topic-radar-repository.drizzle";
export { secureConfigRepository } from "./secure-config-repository";
export { auditLogRepository, type AdminAuditLogRow } from "./audit-log-repository";
export { aboutRepository, type AboutContent } from "./about-repository";
export { drizzleCategoryRepository } from "./category-repository.drizzle";
export { drizzleCommentRepository } from "./comment-repository.drizzle";
export { drizzlePostRepository } from "./post-repository.drizzle";
export { drizzleUserRepository } from "./user-repository.drizzle";

export const repositories = {
  user: userRepository,
  post: postRepository,
  drizzlePost: drizzlePostRepository,
  comment: commentRepository,
  drizzleComment: drizzleCommentRepository,
  videoTask: videoTaskRepository,
  message: messageRepository,
  drizzleMessage: drizzleMessageRepository,
  agent: agentRepository,
  drizzleAgent: drizzleAgentRepository,
  topicRadar: topicRadarRepository,
  drizzleTopicRadar: drizzleTopicRadarRepository,
  drizzleCategory: drizzleCategoryRepository,
  drizzleUser: drizzleUserRepository,
  secureConfig: secureConfigRepository,
  auditLog: auditLogRepository,
  about: aboutRepository,
} as const;

export type Repositories = typeof repositories;

