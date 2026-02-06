/**
 * Studio 瑙嗛鐢熸垚鐩稿叧绫诲瀷瀹氫箟
 * Studio video generation type definitions
 */


/**
 * 瑙嗛浠诲姟鐘舵€?
 * Video task status
 */
export type VideoTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'completed';

/**
 * 瑙嗛浠诲姟绫诲瀷
 * Video task type
 */
export type VideoTaskType = 'text2video' | 'image2video' | 'remix' | 'character' | 'upload_character' | 'create_character';

/**
 * 瑙嗛浠诲姟瀹炰綋
 * Video task entity
 */
export interface VideoTask {
  id: string;
  username: string;
  task_type: VideoTaskType;
  status: VideoTaskStatus;
  progress: number;
  prompt: string | null;
  model: string | null;
  url: string | null;
  aspect_ratio: string | null;
  duration: number | null;
  remix_target_id: string | null;
  size: string | null;
  pid: string | null;
  timestamps: string | null;
  result_json: string | null;
  failure_reason: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Video result entity
 */
export interface VideoResult {
  id: number;
  task_id: string;
  url: string;
  remove_watermark: boolean;
  pid: string | null;
  character_id: string | null;
  created_at: string;
}

/**
 * Video task with results
 */
export interface VideoTaskWithResults extends VideoTask {
  results: VideoResult[];
}

/**
 * 瑙掕壊瀹炰綋
 * Character entity
 */
export interface Character {
  id: number;
  username: string;
  character_id: string;
  name: string | null;
  source_task_id: string | null;
  created_at: string;
}

/**
 * Studio 閰嶇疆瀹炰綋
 * Studio config entity
 */
export interface StudioConfig {
  api_key?: string;
  token?: string;
  host_mode?: 'auto' | 'domestic' | 'overseas';
  query_defaults?: Record<string, unknown>;
}

/**
 * Studio 閰嶇疆琛?
 * Studio config row
 */
export interface StudioConfigRow {
  key: keyof StudioConfig;
  value: string;
}

/**
 * Studio 鍘嗗彶璁板綍
 * Studio history entry
 */
export interface StudioHistory {
  id: number;
  file: string | null;
  prompt: string | null;
  time: number;
  task_id: string | null;
  pid: string | null;
  url: string | null;
  duration_seconds: number | null;
}

/**
 * Studio 浠诲姟鏃堕棿
 * Studio task time
 */
export interface StudioTaskTime {
  task_id: string;
  ts: number;
}

/**
 * Studio 娲昏穬浠诲姟
 * Studio active task
 */
export interface StudioActiveTask {
  id: string;
  prompt: string;
  start_time: number;
}


/**
 * Create video task request
 */
export interface CreateVideoTaskRequest {
  prompt?: string;
  model?: string;
  url?: string;
  aspect_ratio?: string;
  duration?: number;
  remix_target_id?: string;
  size?: string;
  pid?: string;
  timestamps?: string;
}

/**
 * API response data
 */
export interface VideoAPIResponse {
  id: string;
  status?: VideoTaskStatus;
  progress?: number;
  results?: VideoAPIResult[];
  failure_reason?: string;
  error?: string;
}

/**
 * API result item
 */
export interface VideoAPIResult {
  url: string;
  pid?: string;
  removeWatermark?: boolean;
  character_id?: string;
}

/**
 * Video task list response
 */
export interface VideoTaskListResponse {
  tasks: VideoTask[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Finalize video response
 */
export interface FinalizeVideoResponse {
  id: string;
  file?: string;
  url?: string;
  pid?: string;
  status?: VideoTaskStatus;
  progress?: number;
  error?: string;
}

/**
 * 涓婁紶瑙掕壊璇锋眰
 * Upload character request
 */
export interface UploadCharacterRequest {
  file: File;
  name?: string;
}

/**
 * Create character request
 */
export interface CreateCharacterRequest {
  name: string;
  source_task_id?: string;
}

/**
 * 鏇存柊 Studio 閰嶇疆璇锋眰
 * Update studio config request
 */
export interface UpdateStudioConfigRequest {
  api_key?: string;
  token?: string;
  host_mode?: 'auto' | 'domestic' | 'overseas';
  query_defaults?: Record<string, unknown>;
}

// ============ 鏈湴瑙嗛绫诲瀷 ============

/**
 * 鏈湴瑙嗛椤?
 * Local video item
 */
export interface LocalVideo {
  name: string;
  size: number;
  mtime: number;
  url: string;
  generated_time: number;
  duration_seconds: number | null;
  prompt: string;
}


/**
 * 瑙嗛浠诲姟椤圭粍浠?Props
 * Video task item component props
 */
export interface VideoTaskItemProps {
  task: VideoTask;
  onRefresh?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

/**
 * 瑙嗛鐢诲粖椤?
 * Video gallery item
 */
export interface VideoGalleryItemProps {
  video: LocalVideo;
  onDelete?: (name: string) => void;
  onDownload?: (url: string, name: string) => void;
}

/**
 * Create form props
 */
export interface CreateFormProps {
  onSubmit: (data: CreateVideoTaskRequest) => Promise<void>;
  loading?: boolean;
  defaultValues?: Partial<CreateVideoTaskRequest>;
}

/**
 * 瑙掕壊瀹為獙瀹?Props
 * Character lab props
 */
export interface CharacterLabProps {
  characters: Character[];
  onUpload: (data: UploadCharacterRequest) => Promise<void>;
  onCreate: (data: CreateCharacterRequest) => Promise<void>;
  loading?: boolean;
}

/**
 * Task list props
 */
export interface TaskListProps {
  tasks: VideoTask[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: (taskId: string) => void;
}

/**
 * Video player props
 */
export interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
}

// ============ 澶栭儴 API 绫诲瀷 ============

/**
 * 澶栭儴瑙嗛 API 涓绘満閰嶇疆
 * External video API host configuration
 */
export interface VideoAPIHosts {
  overseas: string;
  domestic: string;
}

/**
 * API 璇锋眰 Payload
 * API request payload
 */
export interface VideoAPIPayload {
  prompt?: string;
  model?: string;
  url?: string;
  aspect_ratio?: string;
  duration?: number;
  remix_target_id?: string;
  size?: string;
  pid?: string;
  timestamps?: string;
  character_id?: string;
}
