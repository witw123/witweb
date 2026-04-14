import "server-only";

import type { AgentAttachment } from "@/features/agent/types";
import type { ToolRiskLevel } from "@/lib/agent-tools";
import { getAgentTool, listAgentTools } from "@/lib/agent-tools";
import { getModelDescriptor } from "@/lib/ai-models";
import { resolveApiConfig } from "@/lib/api-registry";
import { searchKnowledge } from "@/lib/knowledge";
import { invokeModelJson } from "@/lib/model-runtime";
import { getPromptTemplate } from "@/lib/prompt-templates";
import { publicProfile } from "@/lib/user";
import type { ContentTaskType, GoalExecutionMode, PlannedStep, StoredPlan } from "./types";
import { plannerResponseSchema } from "./types";

const AGENT_VIDEO_GENERATION_DISABLED = true;

// Step builders
function withoutDisabledVideoSteps(steps: PlannedStep[]): PlannedStep[] {
  return AGENT_VIDEO_GENERATION_DISABLED
    ? steps.filter((step) => step.tool_name !== "video.generate")
    : steps;
}

function needsPublicWebContext(taskType: ContentTaskType, goal: string): boolean {
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
): PlannedStep[] {
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

function hasExplicitExecutionIntent(goal: string): boolean {
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

function looksLikeConversationGoal(goal: string): boolean {
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
      return ensureContextualReadSteps(
        withoutDisabledVideoSteps([
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
            risk_level: "publish_or_send" as ToolRiskLevel,
            input: { status: "draft" },
          },
        ]),
        taskType,
        goal,
        attachments
      );
    case "article_to_video":
      return ensureContextualReadSteps(
        withoutDisabledVideoSteps([
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
            risk_level: "publish_or_send" as ToolRiskLevel,
            input: { duration: 10, aspectRatio: "9:16" },
          },
        ]),
        taskType,
        goal,
        attachments
      );
    case "publish_draft":
      return ensureContextualReadSteps(
        withoutDisabledVideoSteps([
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
            risk_level: "publish_or_send" as ToolRiskLevel,
            input: { status: "draft" },
          },
        ]),
        taskType,
        goal,
        attachments
      );
    case "hot_topic_article":
    default:
      return ensureContextualReadSteps(
        withoutDisabledVideoSteps([
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
            risk_level: "publish_or_send" as ToolRiskLevel,
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
            risk_level: "publish_or_send" as ToolRiskLevel,
            input: { duration: 10, aspectRatio: "9:16" },
          },
        ]),
        taskType,
        goal,
        attachments
      );
  }
}

export function inferAutonomousTaskType(goal: string, inputTaskType?: ContentTaskType): ContentTaskType {
  if (inputTaskType) return inputTaskType;
  if (looksLikeConversationGoal(goal)) return "general_assistant";
  const normalized = goal.trim().toLowerCase();
  const hasExecutionIntent = [
    "写",
    "生成",
    "创建",
    "保存",
    "发布",
    "发送",
    "搜索",
    "分析",
    "整理",
    "查",
    "草稿",
    "文章",
    "热点",
    "视频",
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

  const looksLikeConversation =
    !hasExecutionIntent &&
    (normalized.length <= 12 ||
      [
        "你是",
        "你好",
        "在吗",
        "是谁",
        "怎么",
        "为什么",
        "能不能",
        "是什么",
        "帮我解释",
        "聊聊",
        "介绍一下",
        "hello",
        "hi",
        "who are you",
        "what are you",
        "why",
        "how",
        "can you",
        "?",
        "？",
      ].some((keyword) => normalized.includes(keyword)));

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
    return ensureContextualReadSteps(
      [
        {
          step_key: "reply_directly",
          kind: "llm",
          title: "生成对话回复",
          rationale: "这是普通提问或闲聊，直接回复即可，不需要调用站内工具。",
          status: "planned",
          input: { mode: "general_assistant" },
        },
      ],
      taskType,
      goal,
      attachments
    );
  }

  return buildTaskFallbackPlan(taskType, executionMode, goal, attachments);
}

function isWritingTaskType(taskType: ContentTaskType): boolean {
  return taskType === "hot_topic_article" || taskType === "continue_article" || taskType === "publish_draft";
}

function ensureWritingPlanSteps(
  steps: PlannedStep[],
  taskType: ContentTaskType,
  executionMode: GoalExecutionMode,
  goal: string,
  attachments: AgentAttachment[] = []
): PlannedStep[] {
  if (!isWritingTaskType(taskType)) return steps;

  const fallbackSteps = buildAutonomousFallbackPlan(taskType, executionMode, goal, attachments);
  const hasCompose = steps.some((step) => step.step_key === "compose_content" || step.kind === "llm");
  const hasCreatePost = steps.some(
    (step) => step.step_key === "create_post" || step.tool_name === "blog.create_post"
  );
  const nextSteps = [...steps];

  if (!hasCompose) {
    const fallbackCompose = fallbackSteps.find((step) => step.step_key === "compose_content");
    if (fallbackCompose) {
      const createPostIndex = nextSteps.findIndex(
        (step) => step.step_key === "create_post" || step.tool_name === "blog.create_post"
      );
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
  rawStep: (typeof plannerResponseSchema)["_output"]["steps"][number],
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

export async function buildPlannerPlan(
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
        ]
          .filter(Boolean)
          .join("\n\n"),
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
