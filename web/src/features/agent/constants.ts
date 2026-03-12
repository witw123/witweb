export type AgentThinkingPhaseKey = "intent" | "memory" | "search" | "compose" | "goal";

export const AGENT_THINKING_PHASES: Array<{
  key: AgentThinkingPhaseKey;
  title: string;
  source: "search" | "memory" | "execution";
}> = [
  { key: "intent", title: "识别用户意图", source: "execution" },
  { key: "memory", title: "提取用户记忆", source: "memory" },
  { key: "search", title: "检索知识与上下文", source: "search" },
  { key: "compose", title: "生成最终回答", source: "execution" },
  { key: "goal", title: "规划并执行任务", source: "execution" },
];

export const AGENT_THINKING_PHASE_MAP = Object.fromEntries(
  AGENT_THINKING_PHASES.map((item) => [item.key, item])
) as Record<AgentThinkingPhaseKey, (typeof AGENT_THINKING_PHASES)[number]>;

export function createAgentThinkingStages(
  keys: AgentThinkingPhaseKey[] = ["intent", "memory", "search", "compose"]
) {
  return keys.map((key) => ({
    key,
    title: AGENT_THINKING_PHASE_MAP[key].title,
    status: "pending" as const,
  }));
}

export function upsertAgentThinkingStage(
  stages: Array<{ key: string; title: string; status: "pending" | "running" | "done" }>,
  event: { key: string; title?: string; status: "pending" | "running" | "done" }
) {
  const phaseOrder = new Map(AGENT_THINKING_PHASES.map((item, index) => [item.key, index]));
  const existing = stages.find((item) => item.key === event.key);
  const nextStage = {
    key: event.key,
    title:
      event.title ||
      (phaseOrder.has(event.key as AgentThinkingPhaseKey)
        ? AGENT_THINKING_PHASE_MAP[event.key as AgentThinkingPhaseKey].title
        : event.key),
    status: event.status,
  };

  if (existing) {
    return stages.map((item) => (item.key === event.key ? { ...item, ...nextStage } : item));
  }

  return [...stages, nextStage].sort((a, b) => {
    const aIndex = phaseOrder.get(a.key as AgentThinkingPhaseKey) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = phaseOrder.get(b.key as AgentThinkingPhaseKey) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
}

export const AGENT_INPUT_TEXT = {
  placeholder: "给 AI Agent 发送你的问题或目标，按 Enter 发送...",
  advancedOpen: "收起模式",
  advancedClosed: "思考模式",
  advancedLabel: "提示模式（可选）",
  advancedHint:
    "不填也可以直接输入自然语言目标。这个选项只会给 Agent 一个轻量提示，不再限制它如何选工具。",
  sendTitle: "发送 (Enter)",
  stopTitle: "停止",
  newConversation: "新对话",
  streamEmptyContentError: "请输入消息内容",
  emptyRetrievalAnswer: "当前没有检索到足够可靠的知识片段，请补充问题或先完善知识库。",
  lowConfidenceAnswer: "当前知识命中置信度较低，我无法确认答案，建议补充更具体的问题或完善知识库。",
};
