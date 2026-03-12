/**
 * 视频任务相关类型定义
 *
 * 包含视频任务创建/更新参数、角色数据参数等
 */

import type { VideoTaskStatus, VideoTaskType } from "@/types";

/** 创建视频任务的数据参数 */
export interface CreateVideoTaskData {
  id?: string;
  username: string;
  task_type: VideoTaskType;
  status?: VideoTaskStatus;
  progress?: number;
  prompt?: string | null;
  model?: string | null;
  url?: string | null;
  aspect_ratio?: string | null;
  duration?: number | null;
  remix_target_id?: string | null;
  size?: string | null;
  pid?: string | null;
  timestamps?: string | null;
}

/** 更新视频任务的数据参数 */
export interface UpdateVideoTaskData {
  status?: VideoTaskStatus;
  progress?: number;
  result_json?: string;
  failure_reason?: string;
  error?: string;
}

/** 创建角色的数据参数 */
export interface CreateCharacterData {
  username: string;
  character_id: string;
  name?: string | null;
  source_task_id?: string | null;
}
