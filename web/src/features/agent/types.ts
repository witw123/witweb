import type { AgentTimelineEvent } from "@/features/agent/timeline";

export interface AgentCitation {
  document_id: string;
  chunk_index: number;
  title: string;
  source_type?: string;
  slug?: string;
  href?: string;
}

export interface AgentReplyMeta {
  rag_strategy?: string;
  knowledge_hit_count?: number;
  citation_count?: number;
  retrieval_confidence?: number;
  fallback_reason?: "low_confidence" | "empty_retrieval" | "parse_failed";
  citations?: AgentCitation[];
  execution_stage?: string;
  memory_used?: {
    conversation_summary?: string;
    long_term_memory_count?: number;
  };
  thinking?: {
    current_stage?: string;
    stages?: Array<{
      key: string;
      title: string;
      status: "pending" | "running" | "done";
    }>;
  };
  timeline_events?: AgentTimelineEvent[];
}

export interface AgentAttachment {
  id: string;
  name: string;
  mime_type: string;
  url: string;
  size: number;
  kind: "image" | "document";
}

export interface AgentMessageMeta extends AgentReplyMeta {
  attachments?: AgentAttachment[];
}

export interface AgentGoalPlanStep {
  step_key: string;
  title: string;
  kind: string;
  status: string;
  tool_name?: string;
  rationale?: string;
}

export interface AgentGoalPlan {
  summary?: string;
  knowledge_context?: { title: string }[];
  steps: AgentGoalPlanStep[];
}

export interface AgentGoalSummary {
  id: string;
  goal: string;
  summary: string;
  status: string;
  plan: AgentGoalPlan;
}

export interface AgentGoalStep {
  id: number;
  step_key: string;
  kind: string;
  title: string;
  status: string;
  started_at: string;
  finished_at?: string;
  input?: unknown;
  output?: unknown;
}

export interface AgentGoalApproval {
  id: number;
  step_key: string;
  action: string;
  risk_level: string;
  status: string;
  payload: unknown;
}

export interface AgentGoalDelivery {
  id: string;
  goal_id: string | null;
  event_type: string;
  target_url: string;
  status: string;
  response_code: number | null;
  response_body_preview: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AgentGoalTimelineDto {
  goal: AgentGoalSummary;
  timeline: AgentGoalStep[];
  approvals: AgentGoalApproval[];
  deliveries: AgentGoalDelivery[];
  events?: AgentTimelineEvent[];
}

export interface AgentGalleryItem {
  goal_id: string;
  conversation_id: string | null;
  task_type: string | null;
  status: string;
  updated_at: string;
  title: string;
  summary: string;
  tags: string[];
  source: "goal_timeline" | "post_draft" | "video_prompt";
  preview: {
    content?: string;
    seo_title?: string;
    cover_prompt?: string;
    video_prompt?: string;
  };
}

export interface AgentConversationSummary {
  id: string;
  title: string;
  last_message_preview: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AgentConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  goal_id: string | null;
  created_at: string;
  meta?: AgentMessageMeta;
  local_status?: "pending" | "streaming" | "stopped" | "finalized";
}

export interface AgentConversationDto {
  conversation: AgentConversationSummary;
  messages: AgentConversationMessage[];
  goals: AgentGoalTimelineDto[];
  reply_meta?: AgentReplyMeta;
  conversation_memory?: {
    summary: string;
    key_points: string[];
    turn_count: number;
  } | null;
  long_term_memories?: Array<{
    key: string;
    value: string;
    confidence: number;
    source: string;
  }>;
}
