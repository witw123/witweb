import "server-only";

import { randomUUID } from "crypto";
import type { AgentAttachment, AgentGalleryItem } from "@/features/agent/types";
import type { AgentTimelineEvent } from "@/features/agent/timeline";
import { sortAgentTimelineEvents } from "@/features/agent/timeline";
import { getRagMemoryContext } from "@/lib/agent-memory";
import { generateAgentDraft } from "@/lib/agent-llm";
import { getModelDescriptor } from "@/lib/ai-models";
import { resolveApiConfig } from "@/lib/api-registry";
import { executeAgentTool, getAgentTool, listAgentTools, type ToolRiskLevel } from "@/lib/agent-tools";
import { listRecentContentDeliveries } from "@/lib/integrations/n8n";
import { searchKnowledge } from "@/lib/knowledge";
import { invokeModelJson, invokeModelText } from "@/lib/model-runtime";
import { getPromptTemplate } from "@/lib/prompt-templates";
import {
  isLangChainRagEnabled,
  retrieveKnowledgeContextWithLangChain,
} from "@/lib/rag/langchain-rag";
import { agentPlatformRepository, type AgentGoalStepRow } from "@/lib/repositories";
import { publicProfile } from "@/lib/user";
import { z } from "@/lib/validate";

type GoalExecutionMode = "confirm" | "auto_low_risk";
export const CONTENT_TASK_TYPES = [
  "general_assistant",
  "hot_topic_article",
  "continue_article",
  "article_to_video",
  "publish_draft",
] as const;
export type ContentTaskType = (typeof CONTENT_TASK_TYPES)[number];
const AGENT_VIDEO_GENERATION_DISABLED = true;

type GoalStepKind = "tool" | "llm" | "analysis";
type GoalStepStatus =
  | "planned"
  | "waiting_approval"
  | "running"
  | "done"
  | "failed"
  | "skipped_waiting_approval";

type DraftBundle = Awaited<ReturnType<typeof generateAgentDraft>> & {
  videoPrompt: string;
  references: Array<{ title: string; citation: { document_id: string; chunk_index: number } }>;
  rag_strategy: string;
  knowledge_hit_count: number;
  citation_count: number;
  retrieval_confidence: number;
};

type PlannedStep = {
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

type StoredPlan = {
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


type GoalEventReporter = (event: AgentTimelineEvent) => void | Promise<void>;

const plannerResponseSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(
    z.object({
      step_key: z.string().min(1),
      kind: z.enum(["tool", "llm", "analysis"]),
      title: z.string().min(1),
      tool_name: z.string().optional(),
      rationale: z.string().default(""),
      input: z.record(z.unknown()).default({}),
    })
  ).min(1),
});

function nowIso() {
  return new Date().toISOString();
}

function emitGoalEvent(
  onEvent: GoalEventReporter | undefined,
  event: Omit<AgentTimelineEvent, "id">,
  collector?: AgentTimelineEvent[]
) {
  const hydratedEvent: AgentTimelineEvent = {
    id: `${event.kind}_${event.goal_id || "global"}_${event.step_key || event.approval_id || Date.now()}`,
    ...event,
  };
  collector?.push(hydratedEvent);
  return onEvent?.(hydratedEvent);
}

function buildGoalStatusEvent(goalId: string, status: string, detail: string, createdAt = nowIso()): AgentTimelineEvent {
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

function buildStepEvent(goalId: string, step: Pick<PlannedStep, "step_key" | "title">, status: string, detail?: string, createdAt = nowIso()): AgentTimelineEvent {
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

function buildApprovalEvent(goalId: string, approval: { id: number; step_key: string; action: string; status: string }, detail: string, createdAt = nowIso()): AgentTimelineEvent {
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

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readTagList(value: unknown) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => readString(item)).filter(Boolean))];
  }
  if (typeof value === "string") {
    return [...new Set(value.split(/[,，]/).map((item) => item.trim()).filter(Boolean))];
  }
  return [] as string[];
}

function previewUnknown(value: unknown, max = 220) {
  const text =
    typeof value === "string"
      ? value.trim()
      : JSON.stringify(value ?? {}, null, 0);
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}

function withoutDisabledVideoSteps(steps: PlannedStep[]) {
  return AGENT_VIDEO_GENERATION_DISABLED
    ? steps.filter((step) => step.tool_name !== "video.generate")
    : steps;
}

function needsPublicWebContext(taskType: ContentTaskType, goal: string) {
  if (taskType === "hot_topic_article") return true;
  const normalized = goal.trim().toLowerCase();
  return [
    "latest",
    "recent",
    "current",
    "news",
    "trend",
    "today",
    "最新",
    "最近",
    "近期",
    "新闻",
    "趋势",
    "热点",
  ].some((keyword) => normalized.includes(keyword));
}

function buildFileReadStep(attachments: AgentAttachment[]): PlannedStep | null {
  if (attachments.length === 0) return null;
  return {
    step_key: "read_attachments",
    kind: "tool",
    title: "Read uploaded attachments",
    tool_name: "file.read",
    rationale: "Read user-uploaded files first so planning and drafting can reuse attachment context.",
    status: "planned",
    input: { limit: Math.min(attachments.length, 4) },
  };
}

function buildWebSearchStep(goal: string): PlannedStep {
  return {
    step_key: "search_web",
    kind: "tool",
    title: "Search public web",
    tool_name: "web.search",
    rationale: "Gather current public web references before planning or drafting.",
    status: "planned",
    input: { query: goal, limit: 5 },
  };
}

function ensureContextualReadSteps(
  steps: PlannedStep[],
  taskType: ContentTaskType,
  goal: string,
  attachments: AgentAttachment[]
) {
  const nextSteps = [...steps];

  if (attachments.length > 0 && !nextSteps.some((step) => step.tool_name === "file.read")) {
    const fileReadStep = buildFileReadStep(attachments);
    if (fileReadStep) {
      nextSteps.unshift(fileReadStep);
    }
  }

  if (needsPublicWebContext(taskType, goal) && !nextSteps.some((step) => step.tool_name === "web.search")) {
    const webSearchStep = buildWebSearchStep(goal);
    const readProfileIndex = nextSteps.findIndex((step) => step.tool_name === "profile.read");
    const insertAt = readProfileIndex >= 0 ? readProfileIndex + 1 : attachments.length > 0 ? 1 : 0;
    nextSteps.splice(insertAt, 0, webSearchStep);
  }

  return nextSteps;
}

function hasExplicitExecutionIntent(goal: string) {
  const normalized = goal.trim().toLowerCase();
  if (!normalized) return false;
  return [
    "write",
    "generate",
    "create",
    "save",
    "publish",
    "send",
    "search",
    "analyze",
    "research",
    "post",
    "blog",
    "video",
    "draft",
    "article",
    "topic",
    "hot",
    "publish",
    "发送",
    "发布",
    "搜索",
    "分析",
    "写",
    "生成",
    "草稿",
    "文章",
    "视频",
  ].some((keyword) => normalized.includes(keyword));
}

function looksLikeConversationGoal(goal: string) {
  const normalized = goal.trim().toLowerCase();
  if (!normalized) return false;
  if (hasExplicitExecutionIntent(normalized)) return false;
  if (normalized.length <= 12) return true;
  return [
    "hello",
    "hi",
    "who are you",
    "what are you",
    "why",
    "how",
    "can you",
    "?",
    "？",
    "你好",
    "你是",
    "在吗",
    "怎么",
    "为什么",
    "帮我解释",
    "聊聊",
  ].some((keyword) => normalized.includes(keyword));
}

function inferTaskType(goal: string, inputTaskType?: ContentTaskType): ContentTaskType {
  if (inputTaskType) return inputTaskType;
  if (goal.includes("视频") || goal.toLowerCase().includes("video")) return "article_to_video";
  if (goal.includes("续写") || goal.includes("改写")) return "continue_article";
  if (goal.includes("发布") || goal.includes("草稿")) return "publish_draft";
  return "hot_topic_article";
}

function buildTaskFallbackPlan(
  taskType: ContentTaskType,
  executionMode: GoalExecutionMode,
  goal: string,
  attachments: AgentAttachment[] = []
): PlannedStep[] {
  const publishApproval = executionMode === "confirm";

  switch (taskType) {
    case "continue_article":
      return ensureContextualReadSteps(withoutDisabledVideoSteps([
        {
          step_key: "read_profile",
          kind: "tool",
          title: "Read creator profile",
          tool_name: "profile.read",
          rationale: "Read user profile and style preferences first.",
          status: "planned",
          input: {},
        },
        {
          step_key: "collect_references",
          kind: "analysis",
          title: "Collect references",
          rationale: "Gather existing references before continuation.",
          status: "planned",
          input: { goal },
        },
        {
          step_key: "compose_content",
          kind: "llm",
          title: "Continue article draft",
          rationale: "Generate continued draft with coherent style.",
          status: "planned",
          input: { mode: "continue_article" },
        },
        {
          step_key: "create_post",
          kind: "tool",
          title: "Save draft post",
          tool_name: "blog.create_post",
          rationale: "Save as draft for manual review.",
          status: publishApproval ? "waiting_approval" : "planned",
          requires_approval: publishApproval,
          risk_level: "publish_or_send",
          input: { status: "draft" },
        },
      ]), taskType, goal, attachments);
    case "article_to_video":
      return ensureContextualReadSteps(withoutDisabledVideoSteps([
        {
          step_key: "read_profile",
          kind: "tool",
          title: "Read creator profile",
          tool_name: "profile.read",
          rationale: "Align script with creator style.",
          status: "planned",
          input: {},
        },
        {
          step_key: "compose_content",
          kind: "llm",
          title: "Generate video script",
          rationale: "Produce short-form script package.",
          status: "planned",
          input: { mode: "article_to_video" },
        },
        {
          step_key: "create_video",
          kind: "tool",
          title: "Create video task",
          tool_name: "video.generate",
          rationale: "Create video generation task based on script.",
          status: publishApproval ? "waiting_approval" : "planned",
          requires_approval: publishApproval,
          risk_level: "publish_or_send",
          input: { duration: 10, aspectRatio: "9:16" },
        },
      ]), taskType, goal, attachments);
    case "publish_draft":
      return ensureContextualReadSteps(withoutDisabledVideoSteps([
        {
          step_key: "read_profile",
          kind: "tool",
          title: "Read creator profile",
          tool_name: "profile.read",
          rationale: "Load creator preferences before drafting.",
          status: "planned",
          input: {},
        },
        {
          step_key: "compose_content",
          kind: "llm",
          title: "Generate publish draft",
          rationale: "Generate title/content/seo/distribution copy.",
          status: "planned",
          input: { mode: "publish_draft" },
        },
        {
          step_key: "create_post",
          kind: "tool",
          title: "Create blog draft",
          tool_name: "blog.create_post",
          rationale: "Save as draft first to avoid accidental publish.",
          status: publishApproval ? "waiting_approval" : "planned",
          requires_approval: publishApproval,
          risk_level: "publish_or_send",
          input: { status: "draft" },
        },
      ]), taskType, goal, attachments);
    case "hot_topic_article":
    default:
      return ensureContextualReadSteps(withoutDisabledVideoSteps([
        {
          step_key: "read_profile",
          kind: "tool",
          title: "Read creator profile",
          tool_name: "profile.read",
          rationale: "Understand user profile and style preference.",
          status: "planned",
          input: {},
        },
        {
          step_key: "radar_scan",
          kind: "tool",
          title: "Analyze hot topics",
          tool_name: "radar.fetch_and_analyze",
          rationale: "Analyze recent trends before drafting.",
          status: "planned",
          input: { limit: 10, focus: goal },
        },
        {
          step_key: "compose_content",
          kind: "llm",
          title: "Generate article package",
          rationale: "Generate title, outline, body, SEO and prompts.",
          status: "planned",
          input: { mode: "hot_topic_article" },
        },
        {
          step_key: "create_post",
          kind: "tool",
          title: "Create blog draft",
          tool_name: "blog.create_post",
          rationale: "Save draft before publication.",
          status: publishApproval ? "waiting_approval" : "planned",
          requires_approval: publishApproval,
          risk_level: "publish_or_send",
          input: { status: "draft" },
        },
        {
          step_key: "create_video",
          kind: "tool",
          title: "Create video task",
          tool_name: "video.generate",
          rationale: "Optionally create matching video task.",
          status: publishApproval ? "waiting_approval" : "planned",
          requires_approval: publishApproval,
          risk_level: "publish_or_send",
          input: { duration: 10, aspectRatio: "9:16" },
        },
      ]), taskType, goal, attachments);
  }
}
export function inferAutonomousTaskType(goal: string, inputTaskType?: ContentTaskType): ContentTaskType {
  if (inputTaskType) return inputTaskType;
  if (looksLikeConversationGoal(goal)) return "general_assistant";
  const normalized = goal.trim().toLowerCase();
  const hasExecutionIntent = [
    "\u5199",
    "\u751f\u6210",
    "\u521b\u5efa",
    "\u4fdd\u5b58",
    "\u53d1\u5e03",
    "\u53d1\u9001",
    "\u641c\u7d22",
    "\u5206\u6790",
    "\u6574\u7406",
    "\u67e5",
    "\u8349\u7a3f",
    "\u6587\u7ae0",
    "\u70ed\u70b9",
    "\u89c6\u9891",
    "draft",
    "write",
    "create",
    "save",
    "publish",
    "send",
    "search",
    "analyze",
    "research",
    "post",
    "blog",
    "video",
  ].some((keyword) => normalized.includes(keyword));

  const looksLikeConversation = !hasExecutionIntent && (
    normalized.length <= 12 ||
    [
      "\u4f60\u662f",
      "\u4f60\u597d",
      "\u5728\u5417",
      "\u662f\u8c01",
      "\u600e\u4e48",
      "\u4e3a\u4ec0\u4e48",
      "\u80fd\u4e0d\u80fd",
      "\u662f\u4ec0\u4e48",
      "\u5e2e\u6211\u89e3\u91ca",
      "\u804a\u804a",
      "\u4ecb\u7ecd\u4e00\u4e0b",
      "hello",
      "hi",
      "who are you",
      "what are you",
      "why",
      "how",
      "can you",
      "?",
      "\uff1f",
    ].some((keyword) => normalized.includes(keyword))
  );

  if (looksLikeConversation) return "general_assistant";
  return inferTaskType(goal, inputTaskType);
}

function buildAutonomousFallbackPlan(
  taskType: ContentTaskType,
  executionMode: GoalExecutionMode,
  goal: string,
  attachments: AgentAttachment[] = []
): PlannedStep[] {
  if (taskType === "general_assistant") {
    return ensureContextualReadSteps([
      {
        step_key: "reply_directly",
        kind: "llm",
        title: "\u751f\u6210\u5bf9\u8bdd\u56de\u590d",
        rationale: "\u8fd9\u662f\u666e\u901a\u63d0\u95ee\u6216\u95f2\u804a\uff0c\u76f4\u63a5\u56de\u590d\u5373\u53ef\uff0c\u4e0d\u9700\u8981\u8c03\u7528\u7ad9\u5185\u5de5\u5177\u3002",
        status: "planned",
        input: { mode: "general_assistant" },
      },
    ], taskType, goal, attachments);
  }

  return buildTaskFallbackPlan(taskType, executionMode, goal, attachments);
}

function isWritingTaskType(taskType: ContentTaskType) {
  return taskType === "hot_topic_article" || taskType === "continue_article" || taskType === "publish_draft";
}

function ensureWritingPlanSteps(
  steps: PlannedStep[],
  taskType: ContentTaskType,
  executionMode: GoalExecutionMode,
  goal: string,
  attachments: AgentAttachment[] = []
) {
  if (!isWritingTaskType(taskType)) return steps;

  const fallbackSteps = buildAutonomousFallbackPlan(taskType, executionMode, goal, attachments);
  const hasCompose = steps.some((step) => step.step_key === "compose_content" || step.kind === "llm");
  const hasCreatePost = steps.some((step) => step.step_key === "create_post" || step.tool_name === "blog.create_post");
  const nextSteps = [...steps];

  if (!hasCompose) {
    const fallbackCompose = fallbackSteps.find((step) => step.step_key === "compose_content");
    if (fallbackCompose) {
      const createPostIndex = nextSteps.findIndex((step) => step.step_key === "create_post" || step.tool_name === "blog.create_post");
      if (createPostIndex >= 0) {
        nextSteps.splice(createPostIndex, 0, fallbackCompose);
      } else {
        nextSteps.push(fallbackCompose);
      }
    }
  }

  if (!hasCreatePost) {
    const fallbackCreatePost = fallbackSteps.find((step) => step.step_key === "create_post");
    if (fallbackCreatePost) {
      nextSteps.push(fallbackCreatePost);
    }
  }

  return ensureContextualReadSteps(nextSteps, taskType, goal, attachments);
}

function sanitizePlannerStep(
  rawStep: z.infer<typeof plannerResponseSchema>["steps"][number],
  executionMode: GoalExecutionMode
): PlannedStep | null {
  if (rawStep.kind === "tool") {
    if (!rawStep.tool_name) return null;
    if (AGENT_VIDEO_GENERATION_DISABLED && rawStep.tool_name === "video.generate") return null;
    const tool = getAgentTool(rawStep.tool_name);
    if (!tool) return null;
    const requiresApproval = executionMode === "confirm" && tool.riskLevel !== "read";

    return {
      step_key: rawStep.step_key,
      kind: "tool",
      title: rawStep.title,
      tool_name: rawStep.tool_name,
      rationale: rawStep.rationale,
      status: requiresApproval ? "waiting_approval" : "planned",
      requires_approval: requiresApproval,
      risk_level: tool.riskLevel,
      input: rawStep.input || {},
    };
  }

  return {
    step_key: rawStep.step_key,
    kind: rawStep.kind,
    title: rawStep.title,
    rationale: rawStep.rationale,
    status: "planned",
    input: rawStep.input || {},
  };
}

async function buildPlannerPlan(
  username: string,
  goal: string,
  taskType: ContentTaskType,
  executionMode: GoalExecutionMode,
  input?: {
    templateId?: string;
    attachments?: AgentAttachment[];
    attachmentContext?: string;
  }
): Promise<StoredPlan> {
  const attachments = input?.attachments || [];
  const attachmentContext = input?.attachmentContext || "";
  const toolRegistry = listAgentTools().filter((tool) =>
    AGENT_VIDEO_GENERATION_DISABLED ? tool.name !== "video.generate" : true
  );
  const model = getModelDescriptor();
  const resolvedModel = await resolveApiConfig("agent_llm");
  const profile = await publicProfile(username, username);
  const template = input?.templateId ? await getPromptTemplate(username, input.templateId) : null;
  const knowledge = await searchKnowledge(username, { query: goal, limit: 3 }).catch(() => ({
    items: [],
    rewritten_query: goal,
    retrieval_strategy: "fallback_identity",
  }));

  if (taskType === "general_assistant") {
    return {
      model: resolvedModel?.model || model.id,
      task_type: taskType,
      template_id: input?.templateId || null,
      summary: "Use a direct conversational reply for this goal.",
      steps: buildAutonomousFallbackPlan(taskType, executionMode, goal, attachments),
      attachments,
      attachment_context: attachmentContext,
      knowledge_context: knowledge.items.map((item) => ({
        title: item.title,
        content: item.content,
        citation: item.citation,
      })),
    };
  }

  if (!resolvedModel && !model.configured) {
    return {
      model: model.id,
      task_type: taskType,
      template_id: input?.templateId || null,
      summary: "Using product-task fallback plan because no model is configured.",
      steps: buildAutonomousFallbackPlan(taskType, executionMode, goal, attachments),
      attachments,
      attachment_context: attachmentContext,
      knowledge_context: knowledge.items.map((item) => ({
        title: item.title,
        content: item.content,
        citation: item.citation,
      })),
    };
  }

  try {
    const response = await invokeModelJson(
      {
        model: resolvedModel?.model || model.id,
        systemPrompt: [
          "You are the WitWeb content planner.",
          "Only choose tools from the provided registry.",
          "Optimize for creator workflow, not enterprise automation.",
          AGENT_VIDEO_GENERATION_DISABLED
            ? "Prefer: read profile -> analyze references/hot topics -> llm draft -> create draft post."
            : "Prefer: read profile -> analyze references/hot topics -> llm draft -> create draft post -> optional video task.",
          template?.system_prompt ? `Template system prompt:\n${template.system_prompt}` : "",
        ].filter(Boolean).join("\n\n"),
        userPrompt: [
          `Goal: ${goal}`,
          `Task type hint: ${taskType}`,
          `Execution mode: ${executionMode}`,
          `Tools JSON: ${JSON.stringify(toolRegistry)}`,
          `User profile JSON: ${JSON.stringify(profile || {})}`,
          `Knowledge JSON: ${JSON.stringify(knowledge.items)}`,
          attachments.length ? `Attachments JSON: ${JSON.stringify(attachments)}` : "",
          attachmentContext ? `Attachment context:\n${attachmentContext}` : "",
          template?.task_prompt ? `Template task prompt:\n${template.task_prompt}` : "",
          "Choose the smallest effective set of tools for the user's goal. Prefer read tools first, then analysis, then drafting, then write actions if needed.",
          "Do not assume every goal needs a blog draft. Only choose write tools when they help complete the user's request.",
          "Return JSON only. Fields: summary, steps[]. Each step requires step_key, kind, title, rationale, input. Tool steps also require tool_name.",
        ].join("\n\n"),
      },
      (value) => plannerResponseSchema.parse(value)
    );

    const steps = ensureContextualReadSteps(
      ensureWritingPlanSteps(
        response.parsed.steps
          .map((item) => sanitizePlannerStep(item, executionMode))
          .filter((item): item is PlannedStep => Boolean(item)),
        taskType,
        executionMode,
        goal,
        attachments
      ),
      taskType,
      goal,
      attachments
    );

    if (steps.length === 0) {
      throw new Error("empty_plan");
    }

    return {
      model: response.model.id,
      task_type: taskType,
      template_id: input?.templateId || null,
      summary: response.parsed.summary,
      steps,
      attachments,
      attachment_context: attachmentContext,
      knowledge_context: knowledge.items.map((item) => ({
        title: item.title,
        content: item.content,
        citation: item.citation,
      })),
    };
  } catch {
    return {
      model: resolvedModel?.model || model.id,
      task_type: taskType,
      template_id: input?.templateId || null,
      summary: "Planner fell back to the fixed creator workflow.",
      steps: buildAutonomousFallbackPlan(taskType, executionMode, goal, attachments),
      attachments,
      attachment_context: attachmentContext,
      knowledge_context: knowledge.items.map((item) => ({
        title: item.title,
        content: item.content,
        citation: item.citation,
      })),
    };
  }
}

function buildCompletedToolContext(plan: StoredPlan, goalSteps: AgentGoalStepRow[]) {
  const planStepMap = new Map(plan.steps.map((step) => [step.step_key, step]));
  const blocks: string[] = [];

  for (const step of goalSteps) {
    if (step.status !== "done") continue;
    const plannedStep = planStepMap.get(step.step_key);
    if (!plannedStep || plannedStep.kind !== "tool" || !plannedStep.tool_name) continue;

    const parsedOutput = asRecord(parseJson(step.output_json, {}));
    const result = asRecord(parsedOutput?.result) || parsedOutput;

    if (plannedStep.tool_name === "file.read") {
      const items = Array.isArray(result?.items) ? result.items : [];
      const summaries = items
        .map((item) => asRecord(item))
        .filter(Boolean)
        .map((item) => {
          const name = readString(item?.name);
          const excerpt = readString(item?.content_excerpt);
          return excerpt ? `- ${name}: ${excerpt}` : name ? `- ${name}: metadata only` : "";
        })
        .filter(Boolean);

      if (summaries.length > 0) {
        blocks.push(`Attachment reads:\n${summaries.join("\n")}`);
      }
    }

    if (plannedStep.tool_name === "web.search") {
      const items = Array.isArray(result?.items) ? result.items : [];
      const summaries = items
        .map((item) => asRecord(item))
        .filter(Boolean)
        .map((item) => {
          const title = readString(item?.title);
          const snippet = readString(item?.snippet);
          const url = readString(item?.url);
          const line = [title, snippet].filter(Boolean).join(": ");
          return line ? `- ${line}${url ? ` (${url})` : ""}` : "";
        })
        .filter(Boolean);

      if (summaries.length > 0) {
        blocks.push(`Public web references:\n${summaries.join("\n")}`);
      }
    }
  }

  return blocks.join("\n\n");
}

async function synthesizeDraft(
  username: string,
  goal: string,
  plan: StoredPlan,
  templateId?: string,
  conversationId?: string | null,
  goalId?: string
): Promise<DraftBundle> {
  const template = templateId ? await getPromptTemplate(username, templateId) : null;
  const memoryContext = await getRagMemoryContext(username, conversationId).catch(() => ({
    conversationSummary: "",
    conversationKeyPoints: [],
    longTermMemories: [],
  }));
  const legacyReferences = (plan.knowledge_context || []).map((item) => ({
    title: item.title,
      content: item.content,
      citation: item.citation,
    }));
  const completedToolContext = goalId
    ? buildCompletedToolContext(plan, await agentPlatformRepository.getGoalSteps(goalId).catch(() => []))
    : "";
  const ragRetrieval = isLangChainRagEnabled()
    ? await retrieveKnowledgeContextWithLangChain({
        username,
        query: goal,
        conversationId,
        limit: 3,
      }).catch(() => null)
    : null;
  const activeReferences = ragRetrieval
    ? ragRetrieval.retrieved_chunks.map((item) => ({
        title: item.title,
        content: item.content,
        citation: item.citation,
      }))
    : legacyReferences;
  const referenceBlock = activeReferences.length
    ? `References:\n${activeReferences.map((item) => `- ${item.title}: ${item.content}`).join("\n")}`
    : "";
  const ragMeta = {
    rag_strategy: ragRetrieval ? "langchain_hybrid" : "legacy_hybrid",
    knowledge_hit_count: ragRetrieval ? ragRetrieval.retrieved_chunks.length : legacyReferences.length,
    citation_count: ragRetrieval ? ragRetrieval.citations.length : legacyReferences.length,
    retrieval_confidence: ragRetrieval ? ragRetrieval.retrieval_confidence : 0,
  };

  const prompt = [
    template?.system_prompt || "",
    template?.task_prompt || "",
    memoryContext.conversationSummary ? `Conversation summary:\n${memoryContext.conversationSummary}` : "",
    memoryContext.longTermMemories.length
      ? `Long-term memory:\n${memoryContext.longTermMemories.map((item) => `- ${item.key}: ${item.value}`).join("\n")}`
      : "",
    plan.attachment_context ? `Attachment context:\n${plan.attachment_context}` : "",
    completedToolContext,
    goal,
    referenceBlock,
  ].filter(Boolean).join("\n\n");

  if (plan.task_type === "general_assistant") {
    try {
      const response = await invokeModelText({
        model: plan.model || getModelDescriptor().id,
        capability: "agent_llm",
        systemPrompt: template?.system_prompt || "You are a helpful content and product assistant.",
        userPrompt: [
          template?.task_prompt || "",
          goal,
          referenceBlock,
          "Reply directly in Chinese. Do not create a blog draft unless the user explicitly asks for one.",
        ].filter(Boolean).join("\n\n"),
      });

      return {
        title: "对话回复",
        content: response.output.trim(),
        tags: "Assistant,Chat",
        seo: {
          title: "对话回复",
          description: response.output.trim().slice(0, 120),
          keywords: ["Assistant", "Chat"],
        },
        coverPrompt: "简洁对话助手界面，深色科技风",
        keywords: ["Assistant", "Chat"],
        outline: ["理解问题", "直接回答"],
        videoPrompt: "",
        references: activeReferences.map((item) => ({
          title: item.title,
          citation: item.citation,
        })),
        ...ragMeta,
      };
    } catch {
      return {
        title: "对话回复",
        content: `我已收到你的问题：${goal}`,
        tags: "Assistant,Chat",
        seo: {
          title: "对话回复",
          description: `关于“${goal}”的直接回复`,
          keywords: ["Assistant", "Chat"],
        },
        coverPrompt: "简洁对话助手界面，深色科技风",
        keywords: ["Assistant", "Chat"],
        outline: ["理解问题", "直接回答"],
        videoPrompt: "",
        references: activeReferences.map((item) => ({
          title: item.title,
          citation: item.citation,
        })),
        ...ragMeta,
      };
    }
  }

  try {
    const draft = await generateAgentDraft(prompt, "writing");
    return {
      ...draft,
      videoPrompt: `${draft.title}\n${draft.coverPrompt}`,
      references: activeReferences.map((item) => ({
        title: item.title,
        citation: item.citation,
      })),
      ...ragMeta,
    };
  } catch {
    return {
      title: goal.slice(0, 60),
      content: `# ${goal}\n\n这是由 AI 内容工作台生成的回退草稿。`,
      tags: "AI,Content",
      seo: {
        title: goal.slice(0, 60),
        description: `${goal} 的内容草稿`,
        keywords: ["AI", "Content"],
      },
      coverPrompt: `为主题“${goal}”生成简洁科技风封面`,
      keywords: ["AI", "Content"],
      outline: ["背景", "洞察", "正文", "总结"],
      videoPrompt: `将“${goal}”转成 60 秒短视频脚本`,
      references: activeReferences.map((item) => ({
        title: item.title,
        citation: item.citation,
      })),
      ...ragMeta,
    };
  }
}
async function resolveStepInput(
  username: string,
  goalId: string,
  conversationId: string | null,
  goal: string,
  plan: StoredPlan,
  step: PlannedStep,
  draftCache: DraftBundle | null
) {
  if (step.step_key === "create_post") {
    const draft =
      draftCache || (await synthesizeDraft(username, goal, plan, plan.template_id || undefined, conversationId, goalId));
    return {
      ...step.input,
      title: draft.title,
      content: draft.content,
      tags: draft.tags,
      excerpt: draft.seo.description,
      status: "draft",
    };
  }

  if (step.step_key === "create_video") {
    const draft =
      draftCache || (await synthesizeDraft(username, goal, plan, plan.template_id || undefined, conversationId, goalId));
    return {
      ...step.input,
      prompt: draft.videoPrompt || draft.coverPrompt || goal,
    };
  }

  if (step.tool_name === "file.read") {
    return {
      ...step.input,
      attachments: plan.attachments || [],
      limit:
        typeof step.input.limit === "number"
          ? step.input.limit
          : Math.min((plan.attachments || []).length || 1, 4),
    };
  }

  if (step.tool_name === "web.search") {
    return {
      ...step.input,
      query: readString(step.input.query) || goal,
      limit: typeof step.input.limit === "number" ? step.input.limit : 5,
    };
  }

  if (step.tool_name === "integrations.n8n_dispatch") {
    return {
      ...step.input,
      goal_id: goalId,
    };
  }

  return step.input;
}

export async function createAgentGoal(
  username: string,
  input: {
    goal: string;
    conversationId?: string;
    executionMode?: GoalExecutionMode;
    templateId?: string;
    taskType?: ContentTaskType;
    attachments?: AgentAttachment[];
    attachmentContext?: string;
  }
) {
  const goalId = `goal_${randomUUID().replace(/-/g, "")}`;
  const ts = nowIso();
  const executionMode = input.executionMode || "confirm";
  const taskType = inferAutonomousTaskType(input.goal, input.taskType);
  const plan = await buildPlannerPlan(username, input.goal, taskType, executionMode, {
    templateId: input.templateId,
    attachments: input.attachments,
    attachmentContext: input.attachmentContext,
  });
  const status = plan.steps.some((step) => step.requires_approval) ? "waiting_approval" : "planned";

  await agentPlatformRepository.createGoal({
    id: goalId,
    conversationId: input.conversationId || null,
    username,
    goal: input.goal,
    taskType,
    templateId: input.templateId || null,
    status,
    executionMode,
    requestedToolsJson: JSON.stringify(plan.steps.map((step) => step.tool_name).filter(Boolean)),
    planJson: JSON.stringify(plan),
    summary: plan.summary,
    ts,
  });

  for (const step of plan.steps) {
    await agentPlatformRepository.insertGoalStep({
      goalId,
      stepKey: step.step_key,
      kind: step.kind,
      title: step.title,
      status: step.status,
      inputJson: JSON.stringify(step.input),
      outputJson: JSON.stringify({}),
      startedAt: ts,
      finishedAt: null,
    });

    if (step.requires_approval && step.tool_name) {
      await agentPlatformRepository.createApproval({
        goalId,
        stepKey: step.step_key,
        action: step.tool_name,
        riskLevel: step.risk_level || "publish_or_send",
        status: "pending",
        payloadJson: JSON.stringify(step.input),
        ts,
      });
    }
  }

  if (executionMode === "auto_low_risk") {
    return await executeAgentGoal(goalId, username);
  }

  return await getAgentGoalTimeline(goalId, username);
}

export async function approveAgentAction(approvalId: number, username: string) {
  const ts = nowIso();
  const approval = await agentPlatformRepository.getApprovalById(approvalId, username);
  if (!approval) throw new Error("approval_not_found");
  const ok = await agentPlatformRepository.updateApprovalStatus(approvalId, username, "approved", ts);
  if (!ok) throw new Error("approval_not_found");
  return {
    id: approvalId,
    status: "approved",
    timeline_event: buildApprovalEvent(approval.goal_id, { ...approval, status: "approved" }, "???????????", ts),
  };
}

export async function rejectAgentAction(approvalId: number, username: string) {
  const ts = nowIso();
  const approval = await agentPlatformRepository.getApprovalById(approvalId, username);
  if (!approval) throw new Error("approval_not_found");
  const ok = await agentPlatformRepository.updateApprovalStatus(approvalId, username, "rejected", ts);
  if (!ok) throw new Error("approval_not_found");
  return {
    id: approvalId,
    status: "rejected",
    timeline_event: buildApprovalEvent(approval.goal_id, { ...approval, status: "rejected" }, "??????", ts),
  };
}

async function approvalGranted(goalId: string, stepKey: string) {
  const approval = await agentPlatformRepository.getApprovalByStepKey(goalId, stepKey);
  return approval?.status === "approved";
}

export async function executeAgentGoal(goalId: string, username: string, options?: { onEvent?: GoalEventReporter }) {
  const goal = await agentPlatformRepository.getGoalById(goalId, username);
  if (!goal) throw new Error("goal_not_found");

  const plan = parseJson<StoredPlan>(goal.plan_json, {
    model: getModelDescriptor().id,
    task_type: inferAutonomousTaskType(goal.goal),
    template_id: goal.template_id,
    summary: "",
    steps: [],
  });

  let waitingApproval = false;
  let hasFailure = false;
  let draftCache: DraftBundle | null = null;
  const runtimeEvents: AgentTimelineEvent[] = [];

  const runningTs = nowIso();
  await agentPlatformRepository.updateGoalStatus(goalId, username, "running", goal.summary, goal.plan_json, runningTs);
  await emitGoalEvent(options?.onEvent, buildGoalStatusEvent(goalId, "running", "Goal 开始执行", runningTs), runtimeEvents);

  for (const step of plan.steps) {
    const existing = await agentPlatformRepository.getGoalStepByKey(goalId, step.step_key);
    if (existing?.status === "done") {
      if (step.kind === "llm") {
        draftCache = parseJson(existing.output_json, null);
      }
      continue;
    }

    if (step.requires_approval && !(await approvalGranted(goalId, step.step_key))) {
      waitingApproval = true;
      await agentPlatformRepository.updateGoalStepByKey({
        goalId,
        stepKey: step.step_key,
        status: "skipped_waiting_approval",
        outputJson: JSON.stringify({ waiting_approval: true }),
        finishedAt: nowIso(),
      });
      continue;
    }

    const stepStartedAt = Date.now();
    await agentPlatformRepository.updateGoalStepByKey({
      goalId,
      stepKey: step.step_key,
      status: "running",
      startedAt: nowIso(),
      inputJson: JSON.stringify(step.input),
    });

    try {
      if (step.kind === "llm") {
        draftCache = await synthesizeDraft(
          username,
          goal.goal,
          plan,
          goal.template_id || undefined,
          goal.conversation_id || null,
          goalId
        );
        const finishedAt = nowIso();
        await agentPlatformRepository.updateGoalStepByKey({
          goalId,
          stepKey: step.step_key,
          status: "done",
          outputJson: JSON.stringify({
            ...draftCache,
            latency_ms: Date.now() - stepStartedAt,
          }),
          finishedAt,
        });
        await emitGoalEvent(options?.onEvent, buildStepEvent(goalId, step, "done", "草稿生成完成", finishedAt), runtimeEvents);
        if (draftCache?.title) {
          await emitGoalEvent(
            options?.onEvent,
            buildArtifactEvent(goalId, step.step_key, "title", "文章标题", previewUnknown(draftCache.title), finishedAt),
            runtimeEvents
          );
        }
        if (draftCache?.content) {
          await emitGoalEvent(
            options?.onEvent,
            buildArtifactEvent(goalId, step.step_key, "content", "正文草稿", previewUnknown(draftCache.content), finishedAt),
            runtimeEvents
          );
        }
        if (draftCache?.coverPrompt) {
          await emitGoalEvent(
            options?.onEvent,
            buildArtifactEvent(goalId, step.step_key, "cover_prompt", "封面提示词", previewUnknown(draftCache.coverPrompt), finishedAt),
            runtimeEvents
          );
        }
        if (draftCache?.videoPrompt) {
          await emitGoalEvent(
            options?.onEvent,
            buildArtifactEvent(goalId, step.step_key, "video_prompt", "视频脚本 / 提示词", previewUnknown(draftCache.videoPrompt), finishedAt),
            runtimeEvents
          );
        }
        continue;
      }

      if (step.kind === "analysis") {
        const finishedAt = nowIso();
        await agentPlatformRepository.updateGoalStepByKey({
          goalId,
          stepKey: step.step_key,
          status: "done",
          outputJson: JSON.stringify({
            summary: "References and creator context were prepared.",
            references: plan.knowledge_context || [],
            latency_ms: Date.now() - stepStartedAt,
          }),
          finishedAt,
        });
        await emitGoalEvent(options?.onEvent, buildStepEvent(goalId, step, "done", "参考资料准备完成", finishedAt), runtimeEvents);
        continue;
      }

      if (step.kind === "tool" && step.tool_name) {
        if (AGENT_VIDEO_GENERATION_DISABLED && step.tool_name === "video.generate") {
          const finishedAt = nowIso();
          await agentPlatformRepository.updateGoalStepByKey({
            goalId,
            stepKey: step.step_key,
            status: "done",
            outputJson: JSON.stringify({
              skipped: true,
              reason: "video_generation_disabled_temporarily",
              latency_ms: Date.now() - stepStartedAt,
            }),
            finishedAt,
          });
          await emitGoalEvent(options?.onEvent, buildStepEvent(goalId, step, "done", "视频生成暂未开放，已保留脚本输出", finishedAt), runtimeEvents);
          continue;
        }

        const inputPayload = await resolveStepInput(
          username,
          goalId,
          goal.conversation_id || null,
          goal.goal,
          plan,
          step,
          draftCache
        );
        if (step.requires_approval) {
          await agentPlatformRepository.updateApprovalPayloadByStepKey(
            goalId,
            step.step_key,
            JSON.stringify(inputPayload)
          );
        }
        await emitGoalEvent(
          options?.onEvent,
          buildToolStartEvent(goalId, step, previewUnknown(inputPayload), nowIso()),
          runtimeEvents
        );
        const output = await executeAgentTool(username, step.tool_name, inputPayload);

        const finishedAt = nowIso();
        await agentPlatformRepository.updateGoalStepByKey({
          goalId,
          stepKey: step.step_key,
          status: "done",
          inputJson: JSON.stringify(inputPayload),
          outputJson: JSON.stringify({
            result: output,
            latency_ms: Date.now() - stepStartedAt,
          }),
          finishedAt,
        });
        await emitGoalEvent(
          options?.onEvent,
          buildToolResultEvent(goalId, step, previewUnknown(output), "done", finishedAt),
          runtimeEvents
        );
        await emitGoalEvent(options?.onEvent, buildStepEvent(goalId, step, "done", step.tool_name || "工具执行完成", finishedAt), runtimeEvents);
        if (step.step_key === "create_post") {
          await emitGoalEvent(
            options?.onEvent,
            buildArtifactEvent(goalId, step.step_key, "post_result", "草稿保存结果", previewUnknown(output), finishedAt),
            runtimeEvents
          );
        }
        if (step.step_key === "create_video") {
          await emitGoalEvent(
            options?.onEvent,
            buildArtifactEvent(goalId, step.step_key, "video_result", "视频执行结果", previewUnknown(output), finishedAt),
            runtimeEvents
          );
        }
      }
    } catch (error) {
      hasFailure = true;
      const failedAt = nowIso();
      const errorMessage = error instanceof Error ? error.message : "unknown_error";
      await agentPlatformRepository.updateGoalStepByKey({
        goalId,
        stepKey: step.step_key,
        status: "failed",
        outputJson: JSON.stringify({
          error: errorMessage,
          latency_ms: Date.now() - stepStartedAt,
        }),
        finishedAt: failedAt,
      });
      if (step.kind === "tool" && step.tool_name) {
        await emitGoalEvent(
          options?.onEvent,
          buildToolResultEvent(goalId, step, previewUnknown(errorMessage), "failed", failedAt),
          runtimeEvents
        );
      }
      await emitGoalEvent(options?.onEvent, buildStepEvent(goalId, step, "failed", errorMessage, failedAt), runtimeEvents);
      break;
    }
  }

  const nextStatus = hasFailure ? "failed" : waitingApproval ? "waiting_approval" : "done";
  const nextSummary = hasFailure
    ? "Some steps failed. You can fix and resume the remaining steps."
    : waitingApproval
      ? "Some actions are still waiting for your approval."
      : "Execution completed.";

  const finishedTs = nowIso();
  await agentPlatformRepository.updateGoalStatus(
    goalId,
    username,
    nextStatus,
    nextSummary,
    JSON.stringify(plan),
    finishedTs
  );
  await emitGoalEvent(options?.onEvent, buildGoalStatusEvent(goalId, nextStatus, nextSummary, finishedTs), runtimeEvents);

  const timeline = await getAgentGoalTimeline(goalId, username);
  const mergedTimeline = {
    ...timeline,
    events: sortAgentTimelineEvents([...(timeline.events || []), ...runtimeEvents]),
  };
  if (goal.conversation_id) {
  const assistantSummary =
      nextStatus === "done"
        ? extractGoalCompletionContent(mergedTimeline, draftCache?.content?.trim().slice(0, 320) || nextSummary)
        : nextStatus === "waiting_approval"
          ? "我已生成正文草稿，等待你确认后再保存。"
          : "执行中出现错误。你可以修正后继续执行剩余步骤。";
    await agentPlatformRepository.updateLatestAssistantMessageByGoal({
      conversationId: goal.conversation_id,
      goalId,
      content: assistantSummary,
      metaJson: JSON.stringify({
        rag_strategy: "goal_timeline",
        knowledge_hit_count: 0,
        citation_count: 0,
        retrieval_confidence: 0,
        citations: [],
        execution_stage: nextStatus,
        memory_used: {
          conversation_summary: "",
          long_term_memory_count: 0,
        },
        thinking: {
          current_stage: "goal",
          stages: [
            { key: "intent", title: "识别用户意图", status: "done" },
            { key: "memory", title: "提取用户记忆", status: "done" },
            { key: "goal", title: "规划并执行任务", status: "done" },
          ],
        },
        timeline_events: mergedTimeline.events || [],
      }),
    });
  }

  return mergedTimeline;
}

function buildGoalTimelineEvents(
  goal: { id: string; status: string; summary: string; created_at: string; updated_at: string },
  steps: Array<{ step_key: string; title: string; status: string; started_at: string; finished_at: string | null }>,
  approvals: Array<{ id: number; step_key: string; action: string; status: string; created_at: string; resolved_at: string | null }>,
  deliveries: Array<{ id: string; event_type: string; status: string; created_at: string; updated_at: string | null }>
) {
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
      buildApprovalEvent(goal.id, approval, approval.status === "pending" ? "?????" : `??${approval.status === "approved" ? "???" : "???"}?`, approval.resolved_at || approval.created_at)
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

function extractGoalCompletionContent(
  timeline: Awaited<ReturnType<typeof getAgentGoalTimeline>>,
  fallbackSummary: string
) {
  const llmStep = [...timeline.timeline].reverse().find((step) => step.kind === "llm" && step.status === "done");
  const llmOutput = llmStep?.output as { content?: string } | undefined;
  if (typeof llmOutput?.content === "string" && llmOutput.content.trim()) {
    return llmOutput.content.trim().slice(0, 320);
  }

  const createPostStep = [...timeline.timeline].reverse().find((step) => step.step_key === "create_post" && step.status === "done");
  const createPostInput = createPostStep?.input as { content?: string; title?: string } | undefined;
  if (typeof createPostInput?.content === "string" && createPostInput.content.trim()) {
    return createPostInput.content.trim().slice(0, 320);
  }

  if (typeof createPostInput?.title === "string" && createPostInput.title.trim()) {
    return `${createPostInput.title.trim()} 已生成并保存为草稿。`;
  }

  return fallbackSummary;
}

function extractGoalDeliverable(
  timeline: Awaited<ReturnType<typeof getAgentGoalTimeline>>
): Omit<AgentGalleryItem, "goal_id" | "conversation_id" | "task_type" | "status" | "updated_at"> | null {
  const llmStep = [...timeline.timeline].reverse().find((step) => step.kind === "llm" && step.status === "done");
  const llmOutput = asRecord(llmStep?.output);
  const llmSeo = asRecord(llmOutput?.seo);

  const createPostStep = [...timeline.timeline].reverse().find((step) => step.step_key === "create_post" && step.status === "done");
  const createPostInput = asRecord(createPostStep?.input);
  const createPostOutput = asRecord(createPostStep?.output);
  const createPostResult = asRecord(createPostOutput?.result);

  const createVideoStep = [...timeline.timeline].reverse().find((step) => step.step_key === "create_video" && step.status === "done");
  const createVideoInput = asRecord(createVideoStep?.input);

  const title =
    readString(llmOutput?.title) ||
    readString(createPostInput?.title) ||
    readString(timeline.goal.summary) ||
    readString(timeline.goal.goal) ||
    "未命名作品";
  const content = readString(llmOutput?.content) || readString(createPostInput?.content);
  const videoPrompt = readString(llmOutput?.videoPrompt) || readString(createVideoInput?.prompt);
  const coverPrompt = readString(llmOutput?.coverPrompt);
  const seoTitle = readString(llmSeo?.title);
  const tags = [...new Set([...readTagList(llmOutput?.tags), ...readTagList(createPostInput?.tags)])];
  const summary = content || videoPrompt || readString(timeline.goal.summary) || readString(timeline.goal.goal);
  const hasDeliverable = Boolean(
    content ||
    videoPrompt ||
    coverPrompt ||
    seoTitle ||
    tags.length > 0 ||
    (createPostResult && Object.keys(createPostResult).length > 0)
  );

  if (!hasDeliverable || !summary) {
    return null;
  }

  return {
    title,
    summary,
    tags,
    source: createPostResult ? "post_draft" : videoPrompt ? "video_prompt" : "goal_timeline",
    preview: {
      ...(content ? { content } : {}),
      ...(seoTitle ? { seo_title: seoTitle } : {}),
      ...(coverPrompt ? { cover_prompt: coverPrompt } : {}),
      ...(videoPrompt ? { video_prompt: videoPrompt } : {}),
    },
  };
}

function buildToolStartEvent(
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

function buildToolResultEvent(
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

function buildArtifactEvent(
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

export async function listAgentGoalGalleryItems(
  username: string,
  options?: {
    size?: number;
    status?: "planned" | "waiting_approval" | "running" | "done" | "failed";
  }
): Promise<AgentGalleryItem[]> {
  const size = Math.max(1, Math.min(48, options?.size || 24));
  const candidates = await agentPlatformRepository.listGoalsByUser(username, {
    limit: Math.min(size * 3, 96),
    status: options?.status,
  });

  const timelines = await Promise.all(
    candidates
      .filter((goal) => goal.task_type !== "general_assistant")
      .map(async (goal) => {
        const timeline = await getAgentGoalTimeline(goal.id, username);
        const deliverable = extractGoalDeliverable(timeline);
        if (!deliverable) return null;

        return {
          goal_id: goal.id,
          conversation_id: goal.conversation_id,
          task_type: goal.task_type,
          status: goal.status,
          updated_at: goal.updated_at,
          ...deliverable,
        } satisfies AgentGalleryItem;
      })
  );

  return timelines.filter(Boolean).slice(0, size) as AgentGalleryItem[];
}

export async function getAgentGoalTimeline(goalId: string, username: string) {
  const goal = await agentPlatformRepository.getGoalById(goalId, username);
  if (!goal) throw new Error("goal_not_found");

  const steps = await agentPlatformRepository.getGoalSteps(goalId);
  const approvals = await agentPlatformRepository.getGoalApprovals(goalId);
  const deliveries = await listRecentContentDeliveries(username, goalId);
  const parsedPlan = parseJson<StoredPlan>(goal.plan_json, {
    model: getModelDescriptor().id,
    task_type: inferAutonomousTaskType(goal.goal, goal.task_type as ContentTaskType | undefined),
    template_id: goal.template_id,
    summary: "",
    steps: [],
  });
  const latestStepStatus = new Map(steps.map((step) => [step.step_key, step.status]));
  const hydratedPlan = {
    ...parsedPlan,
    steps: parsedPlan.steps.map((step) => ({
      ...step,
      status: latestStepStatus.get(step.step_key) || step.status,
    })),
  };

  return {
    goal: {
      ...goal,
      requested_tools: parseJson<string[]>(goal.requested_tools_json, []),
      plan: hydratedPlan,
    },
    timeline: steps.map((step) => ({
      ...step,
      input: parseJson(step.input_json, {}),
      output: parseJson(step.output_json, {}),
    })),
    approvals: approvals.map((approval) => ({
      ...approval,
      payload: parseJson(approval.payload_json, {}),
    })),
    deliveries,
    events: buildGoalTimelineEvents(goal, steps, approvals, deliveries),
  };
}


