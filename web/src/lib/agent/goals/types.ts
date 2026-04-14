import "server-only";

import type { AgentAttachment } from "@/features/agent/types";
import type { ToolRiskLevel } from "@/lib/agent-tools";
import { z } from "@/lib/validate";

// Execution modes
export type GoalExecutionMode = "confirm" | "auto_low_risk";

// Task types
export const CONTENT_TASK_TYPES = [
  "general_assistant",
  "hot_topic_article",
  "continue_article",
  "article_to_video",
  "publish_draft",
] as const;

export type ContentTaskType = (typeof CONTENT_TASK_TYPES)[number];

// Step types
export type GoalStepKind = "tool" | "llm" | "analysis";
export type GoalStepStatus =
  | "planned"
  | "waiting_approval"
  | "running"
  | "done"
  | "failed"
  | "skipped_waiting_approval";

// Planned step
export type PlannedStep = {
  step_key: string;
  kind: GoalStepKind;
  title: string;
  tool_name?: string;
  rationale: string;
  status: GoalStepStatus;
  risk_level?: ToolRiskLevel;
  requires_approval?: boolean;
  input: Record<string, unknown>;
};

// Stored plan
export type StoredPlan = {
  model: string;
  task_type: ContentTaskType;
  template_id?: string | null;
  summary: string;
  steps: PlannedStep[];
  attachments?: AgentAttachment[];
  attachment_context?: string;
  knowledge_context?: Array<{
    title: string;
    content: string;
    citation: { document_id: string; chunk_index: number };
  }>;
};

// Planner response schema
export const plannerResponseSchema = z.object({
  summary: z.string().min(1),
  steps: z
    .array(
      z.object({
        step_key: z.string().min(1),
        kind: z.enum(["tool", "llm", "analysis"]),
        title: z.string().min(1),
        tool_name: z.string().optional(),
        rationale: z.string().default(""),
        input: z.record(z.unknown()).default({}),
      })
    )
    .min(1),
});

// Re-export types from agent-tools
export type { ToolRiskLevel };
