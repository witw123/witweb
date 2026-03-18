import "server-only";

import { randomUUID } from "crypto";
import {
  AGENT_THINKING_PHASE_MAP,
  AGENT_INPUT_TEXT,
  createAgentThinkingStages,
  type AgentThinkingPhaseKey,
} from "@/features/agent/constants";
import type { AgentAttachment, AgentMessageMeta } from "@/features/agent/types";
import { buildAgentAttachmentFallbackMessage } from "@/lib/agent-attachment-utils";
import { buildAgentAttachmentContext } from "@/lib/agent-attachments";
import {
  extractAndPersistUserMemories,
  getRagMemoryContext,
  shouldExtractExplicitMemory,
  updateConversationMemory,
} from "@/lib/agent-memory";
import { createAgentGoal, getAgentGoalTimeline, inferAutonomousTaskType, type ContentTaskType } from "@/lib/agent-goals";
import { getModelDescriptor } from "@/lib/ai-models";
import { searchKnowledge } from "@/lib/knowledge";
import { invokeModelJson, invokeModelText } from "@/lib/model-runtime";
import { isLangChainRagEnabled, runLangChainRagReply } from "@/lib/rag/langchain-rag";
import { getPromptTemplate } from "@/lib/prompt-templates";
import { agentPlatformRepository, type AgentConversationRow } from "@/lib/repositories";
import { z } from "@/lib/validate";

function nowIso() {
  return new Date().toISOString();
}

function buildConversationTitle(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return AGENT_INPUT_TEXT.newConversation;
  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}...` : trimmed;
}

function buildPreview(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed;
}

function buildGoalAssistantSummary(summary: string, status: string) {
  if (status === "waiting_approval") {
    return summary || "我已生成正文草稿，等待你确认后再保存。";
  }
  if (status === "failed") {
    return summary || "这一轮任务执行失败，你可以修改目标后继续。";
  }
  return summary || "我已完成这一轮任务。";
}

function looksLikeCasualConversation(content: string) {
  const normalized = content.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.length <= 16) {
    const directPatterns = [
      /^你好[呀吗]?$/,
      /^嗨[呀吗]?$/,
      /^hello$/,
      /^hi$/,
      /^你是谁[？?]?$/,
      /^你是？$/,
      /^介绍一下你自己$/,
      /^你能做什么[？?]?$/,
      /^你会什么[？?]?$/,
      /^在吗[？?]?$/,
      /^帮我介绍一下你自己$/,
    ];
    if (directPatterns.some((pattern) => pattern.test(normalized))) {
      return true;
    }
  }

  return /(你是谁|介绍一下你自己|你能做什么|你会什么|自我介绍|介绍你自己)/.test(normalized);
}

async function generateCasualReply(
  username: string,
  conversationId: string,
  content: string,
  templateId?: string,
  options?: {
    onDelta?: (chunk: string) => void | Promise<void>;
  }
) {
  const template = templateId ? await getPromptTemplate(username, templateId) : null;
  const memoryContext = await getRagMemoryContext(username, conversationId).catch(() => ({
    conversationSummary: "",
    conversationKeyPoints: [],
    longTermMemories: [],
  }));

  const response = await invokeModelText({
    model: getModelDescriptor().id,
    capability: "agent_llm",
    systemPrompt:
      template?.system_prompt ||
      "You are a helpful Chinese assistant for creators. Handle greetings, self-introduction, and casual chat naturally.",
    userPrompt: [
      template?.task_prompt || "",
      content,
      memoryContext.conversationSummary ? `Conversation memory:\n${memoryContext.conversationSummary}` : "",
      memoryContext.longTermMemories.length
        ? `Long-term memory:\n${memoryContext.longTermMemories.map((item) => `- ${item.key}: ${item.value}`).join("\n")}`
        : "",
      "Reply directly in Chinese. This is casual conversation, so do not require knowledge-base citations.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    onChunk: options?.onDelta,
  });

  return {
    content: response.output.trim(),
    meta: {
      rag_strategy: "langchain_hybrid_chat_fallback",
      knowledge_hit_count: 0,
      citation_count: 0,
      retrieval_confidence: 0,
      memory_used: {
        conversation_summary: memoryContext.conversationSummary,
        long_term_memory_count: memoryContext.longTermMemories.length,
      },
      citations: [],
      fallback_reason: "empty_retrieval",
      thinking: buildDoneThinking(["intent", "memory", "search", "compose"]),
      timeline_events: [
        { id: `phase_intent_${conversationId}`, source: "conversation", kind: "phase", title: "识别用户意图", status: "done", created_at: nowIso() },
        { id: `phase_memory_${conversationId}`, source: "conversation", kind: "phase", title: "提取用户记忆", status: "done", created_at: nowIso() },
        { id: `phase_search_${conversationId}`, source: "conversation", kind: "phase", title: "检索知识与上下文", status: "done", created_at: nowIso() },
        { id: `phase_compose_${conversationId}`, source: "conversation", kind: "phase", title: "生成最终回答", status: "done", created_at: nowIso() },
      ],
    },
  };
}

function requiresManualConfirmation(taskType: ContentTaskType) {
  return taskType === "hot_topic_article" || taskType === "continue_article" || taskType === "publish_draft";
}

const intentSchema = z.object({
  mode: z.enum(["chat", "execute"]),
  task_type: z.enum(["general_assistant", "hot_topic_article", "continue_article", "article_to_video", "publish_draft"]).optional(),
  reason: z.string().optional(),
});

export type AgentConversationPhaseEvent = {
  key: string;
  title: string;
  status: "pending" | "running" | "done";
};

type AgentConversationPhaseReporter = (event: AgentConversationPhaseEvent) => void | Promise<void>;
type AgentConversationDeltaReporter = (chunk: string, messageId: string) => void | Promise<void>;

export type AgentConversationIncrementalResult = {
  conversation: {
    id: string;
    title: string;
    last_message_preview: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  user_message: {
    id: string;
    conversation_id: string;
    role: "user";
    content: string;
    goal_id: string | null;
    created_at: string;
    meta?: AgentMessageMeta;
  };
  assistant_message: {
    id: string;
    conversation_id: string;
    role: "assistant";
    content: string;
    goal_id: string | null;
    created_at: string;
    meta: Record<string, unknown>;
  };
  reply_meta: Record<string, unknown>;
  goals?: ReturnType<typeof getAgentGoalTimeline> extends Promise<infer T> ? T[] : never;
};

function buildDoneThinking(keys: AgentThinkingPhaseKey[]) {
  return {
    current_stage: keys[keys.length - 1],
    stages: createAgentThinkingStages(keys).map((item) => ({ ...item, status: "done" as const })),
  };
}

function emitConversationTrace(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[agent.conversation] ${event}`, payload);
}

function runInBackground(task: () => Promise<unknown>) {
  void Promise.resolve()
    .then(task)
    .catch(() => null);
}

function splitStreamChunks(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return [];
  return trimmed.match(/.{1,14}/g) || [trimmed];
}

async function reportPhase(onPhase: AgentConversationPhaseReporter | undefined, key: AgentThinkingPhaseKey, status: "pending" | "running" | "done") {
  await onPhase?.({ key, title: AGENT_THINKING_PHASE_MAP[key].title, status });
}

async function classifyConversationIntent(
  username: string,
  content: string,
  templateId?: string
): Promise<ContentTaskType> {
  const model = getModelDescriptor();
  if (!model.configured) {
    return inferAutonomousTaskType(content);
  }

  const template = templateId ? await getPromptTemplate(username, templateId) : null;

  try {
    const response = await invokeModelJson(
      {
        model: model.id,
        capability: "agent_llm",
        systemPrompt: [
          "You are an intent router for WitWeb agent conversations.",
          "Decide whether the user wants a normal conversational reply or wants the agent to execute tools.",
          "Default to chat when uncertain.",
          "Return JSON only.",
        ].join("\n"),
        userPrompt: [
          `User message: ${content}`,
          template?.task_prompt ? `Template hint:\n${template.task_prompt}` : "",
          "Rules:",
          "- mode=chat for greetings, explanations, questions, discussions, brainstorming, or general conversation.",
          "- mode=execute only when the user clearly asks to create, save, publish, analyze, search, draft, or operate on content.",
          "- If mode=execute, choose task_type from: hot_topic_article, continue_article, article_to_video, publish_draft.",
          "- If uncertain, choose chat.",
          "Fields: mode, task_type, reason.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
      (value) => intentSchema.parse(value)
    );

    if (response.parsed.mode === "chat") {
      return "general_assistant";
    }

    return response.parsed.task_type || inferAutonomousTaskType(content);
  } catch {
    return inferAutonomousTaskType(content);
  }
}

async function generateDirectReply(
  username: string,
  conversationId: string,
  content: string,
  templateId?: string,
  options?: {
    onBeforeCompose?: () => void | Promise<void>;
    onDelta?: (chunk: string) => void | Promise<void>;
  }
) {
  const template = templateId ? await getPromptTemplate(username, templateId) : null;
  if (isLangChainRagEnabled()) {
    try {
      const ragReply = await runLangChainRagReply({
        username,
        conversationId,
        query: [
          template?.task_prompt || "",
          content,
          "Reply directly in Chinese. Do not trigger tools or create drafts unless explicitly requested.",
        ]
          .filter(Boolean)
          .join("\n\n"),
        model: getModelDescriptor().id,
        limit: 3,
        streamAnswer: Boolean(options?.onDelta),
        onChunk: options?.onDelta
          ? async (chunk) => {
              await options.onBeforeCompose?.();
              await options.onDelta?.(chunk);
            }
          : undefined,
      });

      if (ragReply.fallback_reason === "empty_retrieval" && looksLikeCasualConversation(content)) {
        return generateCasualReply(username, conversationId, content, templateId, {
          onDelta: options?.onDelta,
        });
      }

      return {
        content: ragReply.answer.trim(),
        meta: {
          rag_strategy: ragReply.rag_strategy,
          knowledge_hit_count: ragReply.knowledge_hit_count,
          citation_count: ragReply.citation_count,
          retrieval_confidence: ragReply.retrieval_confidence,
          citations: ragReply.citations,
          memory_used: ragReply.memory_used,
          fallback_reason: ragReply.fallback_reason,
          thinking: buildDoneThinking(["intent", "memory", "search", "compose"]),
          timeline_events: [
            { id: `phase_intent_${conversationId}`, source: "conversation", kind: "phase", title: "识别用户意图", status: "done", created_at: nowIso() },
            { id: `phase_memory_${conversationId}`, source: "conversation", kind: "phase", title: "提取用户记忆", status: "done", created_at: nowIso() },
            { id: `phase_search_${conversationId}`, source: "conversation", kind: "phase", title: "检索知识与上下文", status: "done", created_at: nowIso() },
            { id: `phase_compose_${conversationId}`, source: "conversation", kind: "phase", title: "生成最终回答", status: "done", created_at: nowIso() },
          ],
        },
      };
    } catch {
      // Fall back to legacy retrieval + generation path for resilience.
    }
  }

  const knowledge = await searchKnowledge(username, { query: content, limit: 3 }).catch(() => ({ items: [] }));
  const memoryContext = await getRagMemoryContext(username, conversationId).catch(() => ({
    conversationSummary: "",
    conversationKeyPoints: [],
    longTermMemories: [],
  }));

  const response = await invokeModelText({
    model: getModelDescriptor().id,
    capability: "agent_llm",
    systemPrompt: template?.system_prompt || "You are a helpful Chinese content and product assistant.",
    userPrompt: [
      template?.task_prompt || "",
      content,
      memoryContext.conversationSummary ? `Conversation memory:\n${memoryContext.conversationSummary}` : "",
      memoryContext.longTermMemories.length
        ? `Long-term memory:\n${memoryContext.longTermMemories.map((item) => `- ${item.key}: ${item.value}`).join("\n")}`
        : "",
      knowledge.items.length
        ? `References:\n${knowledge.items.map((item) => `- ${item.title}: ${item.content}`).join("\n")}`
        : "",
      "Reply directly in Chinese. Do not trigger tools or create drafts unless the user explicitly asks for execution.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    onChunk: options?.onDelta
      ? async (chunk) => {
          await options.onBeforeCompose?.();
          await options.onDelta?.(chunk);
        }
      : undefined,
  });

  return {
    content: response.output.trim(),
    meta: {
      rag_strategy: "legacy_hybrid",
      knowledge_hit_count: knowledge.items.length,
      citation_count: knowledge.items.length,
      retrieval_confidence: 0,
      memory_used: {
        conversation_summary: memoryContext.conversationSummary,
        long_term_memory_count: memoryContext.longTermMemories.length,
      },
      citations: knowledge.items.map((item) => ({
        document_id: item.citation.document_id,
        chunk_index: item.citation.chunk_index,
        title: item.title,
        source_type: item.source_type,
        slug: typeof item.metadata?.slug === "string" ? item.metadata.slug : undefined,
        href:
          typeof item.metadata?.url === "string"
            ? item.metadata.url
            : item.source_type === "blog_post" && typeof item.metadata?.slug === "string"
              ? `/post/${item.metadata.slug}`
              : undefined,
      })),
      thinking: buildDoneThinking(["intent", "memory", "search", "compose"]),
      timeline_events: [
        { id: `phase_intent_${conversationId}`, source: "conversation", kind: "phase", title: "识别用户意图", status: "done", created_at: nowIso() },
        { id: `phase_memory_${conversationId}`, source: "conversation", kind: "phase", title: "提取用户记忆", status: "done", created_at: nowIso() },
        { id: `phase_search_${conversationId}`, source: "conversation", kind: "phase", title: "检索知识与上下文", status: "done", created_at: nowIso() },
        { id: `phase_compose_${conversationId}`, source: "conversation", kind: "phase", title: "生成最终回答", status: "done", created_at: nowIso() },
      ],
    },
  };
}

async function hydrateConversation(conversation: AgentConversationRow, username: string) {
  const [messages, conversationMemory, userMemories] = await Promise.all([
    agentPlatformRepository.listMessages(conversation.id),
    agentPlatformRepository.getConversationMemory(conversation.id, username),
    agentPlatformRepository.listUserMemories(username, 8),
  ]);
  const goals = await agentPlatformRepository.getGoalsByConversationId(conversation.id, username);
  const timelines = await Promise.all(goals.map((goal) => getAgentGoalTimeline(goal.id, username)));

  return {
    conversation,
    messages: messages.map((message) => ({
      ...message,
      meta: (() => {
        try {
          return JSON.parse(message.meta_json || "{}");
        } catch {
          return {};
        }
      })(),
    })),
    goals: timelines,
    conversation_memory: conversationMemory
      ? {
          summary: conversationMemory.summary,
          key_points: (() => {
            try {
              return JSON.parse(conversationMemory.key_points_json || "[]");
            } catch {
              return [];
            }
          })(),
          turn_count: conversationMemory.turn_count,
        }
      : null,
    long_term_memories: userMemories.map((item) => ({
      key: item.memory_key,
      value: item.memory_value,
      confidence: item.confidence,
      source: item.source,
    })),
  };
}

export async function createAgentConversation(username: string, title = AGENT_INPUT_TEXT.newConversation) {
  const id = `conv_${randomUUID().replace(/-/g, "")}`;
  const ts = nowIso();

  await agentPlatformRepository.createConversation({
    id,
    username,
    title,
    lastMessagePreview: "",
    status: "active",
    ts,
  });

  const conversation = await agentPlatformRepository.getConversationById(id, username);
  if (!conversation) throw new Error("conversation_not_found");
  return hydrateConversation(conversation, username);
}

export async function listAgentConversations(username: string) {
  return agentPlatformRepository.listConversations(username, 50);
}

export async function ensureConversationForGoal(goalId: string, username: string) {
  const goal = await agentPlatformRepository.getGoalById(goalId, username);
  if (!goal) throw new Error("goal_not_found");

  if (goal.conversation_id) {
    const conversation = await agentPlatformRepository.getConversationById(goal.conversation_id, username);
    if (conversation) return conversation.id;
  }

  const conversationId = `conv_${randomUUID().replace(/-/g, "")}`;
  const title = buildConversationTitle(goal.goal);
  const preview = buildPreview(goal.summary || goal.goal);
  const ts = goal.updated_at || nowIso();

  await agentPlatformRepository.createConversation({
    id: conversationId,
    username,
    title,
    lastMessagePreview: preview,
    status: goal.status || "active",
    ts,
  });
  await agentPlatformRepository.setGoalConversation(goalId, username, conversationId);
  await agentPlatformRepository.createMessage({
    id: `msg_${randomUUID().replace(/-/g, "")}`,
    conversationId,
    role: "user",
    content: goal.goal,
    goalId,
    metaJson: JSON.stringify({}),
    ts: goal.created_at || ts,
  });
  if ((goal.summary || "").trim()) {
    await agentPlatformRepository.createMessage({
      id: `msg_${randomUUID().replace(/-/g, "")}`,
      conversationId,
      role: "assistant",
      content: goal.summary,
      goalId,
      metaJson: JSON.stringify({}),
      ts,
    });
  }

  return conversationId;
}

export async function getAgentConversation(conversationId: string, username: string) {
  const conversation = await agentPlatformRepository.getConversationById(conversationId, username);
  if (!conversation) throw new Error("conversation_not_found");
  return hydrateConversation(conversation, username);
}

export async function deleteAgentConversation(conversationId: string, username: string) {
  return agentPlatformRepository.deleteConversation(conversationId, username);
}

export async function appendAgentConversationMessage(
  conversationId: string,
  username: string,
  input: {
    content: string;
    templateId?: string;
    taskType?: ContentTaskType;
    attachments?: AgentAttachment[];
  },
  options?: {
    onPhase?: AgentConversationPhaseReporter;
  }
) {
  const result = await appendAgentConversationMessageIncremental(conversationId, username, input, options);
  const conversation = await getAgentConversation(conversationId, username);
  return {
    ...conversation,
    reply_meta: result.reply_meta,
  };
}

export async function appendAgentConversationMessageIncremental(
  conversationId: string,
  username: string,
  input: {
    content: string;
    templateId?: string;
    taskType?: ContentTaskType;
    attachments?: AgentAttachment[];
  },
  options?: {
    onPhase?: AgentConversationPhaseReporter;
    onDelta?: AgentConversationDeltaReporter;
  }
) {
  const conversation = await agentPlatformRepository.getConversationById(conversationId, username);
  if (!conversation) throw new Error("conversation_not_found");

  const content = input.content.trim();
  const attachments = input.attachments || [];
  const userContent = content || buildAgentAttachmentFallbackMessage(attachments);
  const attachmentContext = await buildAgentAttachmentContext(attachments);
  const contentForAgent = [userContent, attachmentContext].filter(Boolean).join("\n\n");
  const ts = nowIso();
  const userMessageId = `msg_${randomUUID().replace(/-/g, "")}`;
  const assistantMessageId = `msg_${randomUUID().replace(/-/g, "")}`;
  const userMessageMeta = attachments.length > 0 ? { attachments } : undefined;
  const userMessageMetaJson = JSON.stringify(userMessageMeta || {});
  await reportPhase(options?.onPhase, "intent", "running");
  const taskType = input.taskType || (await classifyConversationIntent(username, contentForAgent, input.templateId));
  await reportPhase(options?.onPhase, "intent", "done");

  if (taskType === "general_assistant") {
    await agentPlatformRepository.createMessage({
      id: userMessageId,
      conversationId,
      role: "user",
      content: userContent,
      metaJson: userMessageMetaJson,
      ts,
    });
    await reportPhase(options?.onPhase, "memory", "running");
    if (content && shouldExtractExplicitMemory(content)) {
      await extractAndPersistUserMemories(username, content).catch(() => null);
    }
    await reportPhase(options?.onPhase, "memory", "done");

    await reportPhase(options?.onPhase, "search", "running");
    let composeStarted = false;
    const startCompose = async () => {
      if (composeStarted) return;
      composeStarted = true;
      await reportPhase(options?.onPhase, "search", "done");
      await reportPhase(options?.onPhase, "compose", "running");
    };
    const reply = await generateDirectReply(username, conversationId, contentForAgent, input.templateId, {
      onBeforeCompose: startCompose,
      onDelta: options?.onDelta
        ? async (chunk) => {
            await options.onDelta?.(chunk, assistantMessageId);
          }
        : undefined,
    });
    if (!composeStarted) {
      await startCompose();
    }
    const replyTs = nowIso();
    await agentPlatformRepository.createMessage({
      id: assistantMessageId,
      conversationId,
      role: "assistant",
      content: reply.content,
      metaJson: JSON.stringify(reply.meta),
      ts: replyTs,
    });
    await agentPlatformRepository.updateConversation({
      id: conversationId,
      username,
      title: conversation.title || buildConversationTitle(userContent),
      lastMessagePreview: buildPreview(reply.content),
      status: "active",
      updatedAt: replyTs,
    });
    runInBackground(() => updateConversationMemory(username, conversationId));
    await reportPhase(options?.onPhase, "compose", "done");

    emitConversationTrace("reply", {
      conversation_id: conversationId,
      task_type: taskType,
      rag_strategy: reply.meta.rag_strategy || null,
      knowledge_hit_count: reply.meta.knowledge_hit_count || 0,
      citation_count: reply.meta.citation_count || 0,
      retrieval_confidence: reply.meta.retrieval_confidence || 0,
      fallback_reason: reply.meta.fallback_reason || null,
      memory_summary_used: Boolean(reply.meta.memory_used?.conversation_summary),
      long_term_memory_count: reply.meta.memory_used?.long_term_memory_count || 0,
    });

    return {
      conversation: {
        id: conversationId,
        title: conversation.title || buildConversationTitle(userContent),
        last_message_preview: buildPreview(reply.content),
        status: "active",
        created_at: conversation.created_at,
        updated_at: replyTs,
      },
      user_message: {
        id: userMessageId,
        conversation_id: conversationId,
        role: "user",
        content: userContent,
        goal_id: null,
        created_at: ts,
        meta: userMessageMeta,
      },
      assistant_message: {
        id: assistantMessageId,
        conversation_id: conversationId,
        role: "assistant",
        content: reply.content,
        goal_id: null,
        created_at: replyTs,
        meta: reply.meta,
      },
      reply_meta: reply.meta,
    };
  }

  const goalTimeline = await createAgentGoal(username, {
    goal: userContent,
    conversationId,
    executionMode: requiresManualConfirmation(taskType) ? "confirm" : "auto_low_risk",
    templateId: input.templateId,
    taskType,
    attachments,
    attachmentContext,
  });

  await agentPlatformRepository.createMessage({
    id: userMessageId,
    conversationId,
    role: "user",
    content: userContent,
    goalId: goalTimeline.goal.id,
    metaJson: userMessageMetaJson,
    ts,
  });
  await reportPhase(options?.onPhase, "memory", "running");
  if (content && shouldExtractExplicitMemory(content)) {
    await extractAndPersistUserMemories(username, content).catch(() => null);
  }
  await reportPhase(options?.onPhase, "memory", "done");
  await reportPhase(options?.onPhase, "goal", "running");

  const assistantSummary = buildGoalAssistantSummary(goalTimeline.goal.summary, goalTimeline.goal.status);
  for (const chunk of splitStreamChunks(assistantSummary)) {
    await options?.onDelta?.(chunk, assistantMessageId);
  }
  const replyTs = nowIso();
  const goalReplyMeta = {
    rag_strategy: "goal_timeline",
    knowledge_hit_count: 0,
    citation_count: 0,
    retrieval_confidence: 0,
    citations: [],
    execution_stage: goalTimeline.goal.status,
    memory_used: {
      conversation_summary: "",
      long_term_memory_count: 0,
    },
    thinking: buildDoneThinking(["intent", "memory", "goal"]),
    timeline_events: goalTimeline.events || [],
  };
  await agentPlatformRepository.createMessage({
    id: assistantMessageId,
    conversationId,
    role: "assistant",
    content: assistantSummary,
    goalId: goalTimeline.goal.id,
    metaJson: JSON.stringify(goalReplyMeta),
    ts: replyTs,
  });

  await agentPlatformRepository.updateConversation({
    id: conversationId,
    username,
    title: conversation.title || buildConversationTitle(userContent),
    lastMessagePreview: buildPreview(assistantSummary),
    status: goalTimeline.goal.status || "active",
    updatedAt: replyTs,
  });
  const memoryContext = await getRagMemoryContext(username, conversationId).catch(() => null);
  runInBackground(() => updateConversationMemory(username, conversationId));
  await reportPhase(options?.onPhase, "goal", "done");

  goalReplyMeta.memory_used = {
    conversation_summary: memoryContext?.conversationSummary || "",
    long_term_memory_count: memoryContext?.longTermMemories.length || 0,
  };

  emitConversationTrace("goal", {
    conversation_id: conversationId,
    task_type: taskType,
    rag_strategy: goalReplyMeta.rag_strategy,
    knowledge_hit_count: goalReplyMeta.knowledge_hit_count,
    citation_count: goalReplyMeta.citation_count,
    retrieval_confidence: goalReplyMeta.retrieval_confidence,
    fallback_reason: null,
    memory_summary_used: Boolean(goalReplyMeta.memory_used.conversation_summary),
    long_term_memory_count: goalReplyMeta.memory_used.long_term_memory_count,
  });

  return {
    conversation: {
      id: conversationId,
      title: conversation.title || buildConversationTitle(userContent),
      last_message_preview: buildPreview(assistantSummary),
      status: goalTimeline.goal.status || "active",
      created_at: conversation.created_at,
      updated_at: replyTs,
    },
    user_message: {
      id: userMessageId,
      conversation_id: conversationId,
      role: "user",
      content: userContent,
      goal_id: goalTimeline.goal.id,
      created_at: ts,
      meta: userMessageMeta,
    },
    assistant_message: {
      id: assistantMessageId,
      conversation_id: conversationId,
      role: "assistant",
      content: assistantSummary,
      goal_id: goalTimeline.goal.id,
      created_at: replyTs,
      meta: goalReplyMeta,
    },
    reply_meta: goalReplyMeta,
    goals: [goalTimeline],
  };
}
