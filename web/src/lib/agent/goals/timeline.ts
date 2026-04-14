import "server-only";

import type { AgentTimelineEvent } from "@/features/agent/timeline";
import { sortAgentTimelineEvents } from "@/features/agent/timeline";
import type { PlannedStep } from "./types";

// Utility functions
export function nowIso(): string {
  return new Date().toISOString();
}

export function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readTagList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => readString(item)).filter(Boolean))];
  }
  if (typeof value === "string") {
    return [...new Set(value.split(/[,，]/).map((item) => item.trim()).filter(Boolean))];
  }
  return [];
}

export function previewUnknown(value: unknown, max = 220): string {
  const text =
    typeof value === "string"
      ? value.trim()
      : JSON.stringify(value ?? {}, null, 0);
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}

// Event emitter helper
export type GoalEventReporter = (event: AgentTimelineEvent) => void | Promise<void>;

export function emitGoalEvent(
  onEvent: GoalEventReporter | undefined,
  event: Omit<AgentTimelineEvent, "id">,
  collector?: AgentTimelineEvent[]
): void | Promise<void> {
  const hydratedEvent: AgentTimelineEvent = {
    id: `${event.kind}_${event.goal_id || "global"}_${event.step_key || event.approval_id || Date.now()}`,
    ...event,
  };
  collector?.push(hydratedEvent);
  return onEvent?.(hydratedEvent);
}

// Event builders
export function buildGoalStatusEvent(
  goalId: string,
  status: string,
  detail: string,
  createdAt = nowIso()
): AgentTimelineEvent {
  return {
    id: `goal_${goalId}_${status}_${createdAt}`,
    source: "goal",
    kind: "goal_status",
    goal_id: goalId,
    title: "Goal 状态",
    status,
    detail,
    created_at: createdAt,
  };
}

export function buildStepEvent(
  goalId: string,
  step: Pick<PlannedStep, "step_key" | "title">,
  status: string,
  detail?: string,
  createdAt = nowIso()
): AgentTimelineEvent {
  return {
    id: `step_${goalId}_${step.step_key}_${status}_${createdAt}`,
    source: "goal",
    kind: "step",
    goal_id: goalId,
    step_key: step.step_key,
    title: step.title,
    status,
    detail,
    created_at: createdAt,
  };
}

export function buildApprovalEvent(
  goalId: string,
  approval: { id: number; step_key: string; action: string; status: string },
  detail: string,
  createdAt = nowIso()
): AgentTimelineEvent {
  return {
    id: `approval_${approval.id}_${approval.status}_${createdAt}`,
    source: "approval",
    kind: "approval",
    goal_id: goalId,
    step_key: approval.step_key,
    approval_id: approval.id,
    title: approval.action,
    status: approval.status,
    detail,
    created_at: createdAt,
  };
}

export function buildToolStartEvent(
  goalId: string,
  step: Pick<PlannedStep, "step_key" | "title" | "tool_name">,
  inputPreview: string,
  createdAt = nowIso()
): AgentTimelineEvent {
  return {
    id: `tool_start_${goalId}_${step.step_key}_${createdAt}`,
    source: "tool",
    kind: "tool_start",
    goal_id: goalId,
    step_key: step.step_key,
    tool_name: step.tool_name || null,
    title: step.title,
    status: "running",
    detail: step.tool_name || step.title,
    input_preview: inputPreview,
    created_at: createdAt,
  };
}

export function buildToolResultEvent(
  goalId: string,
  step: Pick<PlannedStep, "step_key" | "title" | "tool_name">,
  outputPreview: string,
  status: "done" | "failed" = "done",
  createdAt = nowIso()
): AgentTimelineEvent {
  return {
    id: `tool_result_${goalId}_${step.step_key}_${createdAt}`,
    source: "tool",
    kind: "tool_result",
    goal_id: goalId,
    step_key: step.step_key,
    tool_name: step.tool_name || null,
    title: step.title,
    status,
    detail: step.tool_name || step.title,
    output_preview: outputPreview,
    created_at: createdAt,
  };
}

export function buildArtifactEvent(
  goalId: string,
  stepKey: string,
  artifactKind: string,
  title: string,
  preview: string,
  createdAt = nowIso()
): AgentTimelineEvent {
  return {
    id: `artifact_${goalId}_${stepKey}_${artifactKind}_${createdAt}`,
    source: "artifact",
    kind: "artifact",
    goal_id: goalId,
    step_key: stepKey,
    artifact_kind: artifactKind,
    artifact_preview: preview,
    title,
    status: "done",
    created_at: createdAt,
  };
}

// Timeline assembly
export function buildGoalTimelineEvents(
  goal: { id: string; status: string; summary: string; created_at: string; updated_at: string },
  steps: Array<{ step_key: string; title: string; status: string; started_at: string; finished_at: string | null }>,
  approvals: Array<{ id: number; step_key: string; action: string; status: string; created_at: string; resolved_at: string | null }>,
  deliveries: Array<{ id: string; event_type: string; status: string; created_at: string; updated_at: string | null }>
): AgentTimelineEvent[] {
  const events: AgentTimelineEvent[] = [
    buildGoalStatusEvent(goal.id, goal.status, goal.summary, goal.updated_at || goal.created_at),
    ...steps.flatMap((step) => {
      const items: AgentTimelineEvent[] = [];
      if (step.started_at) {
        items.push(buildStepEvent(goal.id, step, "running", undefined, step.started_at));
      }
      if (step.finished_at) {
        items.push(buildStepEvent(goal.id, step, step.status, undefined, step.finished_at));
      }
      return items;
    }),
    ...approvals.map((approval) =>
      buildApprovalEvent(
        goal.id,
        approval,
        approval.status === "pending" ? "等待审批" : `已${approval.status === "approved" ? "批准" : "拒绝"}`,
        approval.resolved_at || approval.created_at
      )
    ),
    ...deliveries.map((delivery) => ({
      id: `delivery_${delivery.id}`,
      source: "delivery" as const,
      kind: "delivery" as const,
      goal_id: goal.id,
      title: delivery.event_type,
      status: delivery.status,
      created_at: delivery.updated_at || delivery.created_at,
    })),
  ];

  return sortAgentTimelineEvents(events);
}
