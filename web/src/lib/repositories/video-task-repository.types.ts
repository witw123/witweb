import type { VideoTaskStatus, VideoTaskType } from "@/types";

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

export interface UpdateVideoTaskData {
  status?: VideoTaskStatus;
  progress?: number;
  result_json?: string;
  failure_reason?: string;
  error?: string;
}

export interface CreateCharacterData {
  username: string;
  character_id: string;
  name?: string | null;
  source_task_id?: string | null;
}
