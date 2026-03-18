export type AgentTimelineEvent = {
  id: string;
  source: "conversation" | "goal" | "approval" | "delivery" | "tool" | "artifact";
  kind: "phase" | "goal_status" | "step" | "approval" | "delivery" | "tool_start" | "tool_result" | "artifact";
  goal_id?: string | null;
  step_key?: string | null;
  approval_id?: number | null;
  tool_name?: string | null;
  input_preview?: string;
  output_preview?: string;
  artifact_kind?: string;
  artifact_preview?: string;
  title: string;
  status: string;
  detail?: string;
  created_at: string;
};

export function sortAgentTimelineEvents<T extends { created_at: string }>(events: T[]) {
  return [...events].sort((a, b) => {
    const aTs = new Date(a.created_at).getTime();
    const bTs = new Date(b.created_at).getTime();
    return aTs - bTs;
  });
}
