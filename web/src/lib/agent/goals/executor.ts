import "server-only";

import { randomUUID } from "crypto";
import type { AgentAttachment, AgentGalleryItem } from "@/features/agent/types";
import type { AgentTimelineEvent } from "@/features/agent/timeline";
import { sortAgentTimelineEvents } from "@/features/agent/timeline";
import { getRagMemoryContext } from "@/lib/agent-memory";
import { generateAgentDraft } from "@/lib/agent-llm";
import { getModelDescriptor } from "@/lib/ai-models";
import { executeAgentTool } from "@/lib/agent-tools";
import { listRecentContentDeliveries } from "@/lib/integrations/n8n";
import { invokeModelText } from "@/lib/model-runtime";
import { getPromptTemplate } from "@/lib/prompt-templates";
import {
  isLangChainRagEnabled,
  retrieveKnowledgeContextWithLangChain,
} from "@/lib/rag/langchain-rag";
import { agentPlatformRepository, type AgentGoalStepRow } from "@/lib/repositories";
import type { ContentTaskType, GoalExecutionMode, PlannedStep, StoredPlan } from "./types";
import {
  buildPlannerPlan,
  inferAutonomousTaskType,
} from "./planner";
import {
  nowIso,
  parseJson,
  asRecord,
  readString,
  readTagList,
  previewUnknown,
  emitGoalEvent,
  buildGoalStatusEvent,
  buildStepEvent,
  buildApprovalEvent,
  buildToolStartEvent,
  buildToolResultEvent,
  buildArtifactEvent,
  buildGoalTimelineEvents,
  type GoalEventReporter,
} from "./timeline";

// Draft bundle type
type DraftBundle = Awaited<ReturnType<typeof generateAgentDraft>> & {
  videoPrompt: string;
  references: Array<{ title: string; citation: { document_id: string; chunk_index: number } }>;
  rag_strategy: string;
  knowledge_hit_count: number;
  citation_count: number;
  retrieval_confidence: number;
};

const AGENT_VIDEO_GENERATION_DISABLED = true;

// Tool context builder
function buildCompletedToolContext(plan: StoredPlan, goalSteps: AgentGoalStepRow[]): string {
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

// Draft synthesis
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
  ]
    .filter(Boolean)
    .join("\n\n");

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
        ]
          .filter(Boolean)
          .join("\n\n"),
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
          description: `关于"${goal}"的直接回复`,
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
      coverPrompt: `为主题"${goal}"生成简洁科技风封面`,
      keywords: ["AI", "Content"],
      outline: ["背景", "洞察", "正文", "总结"],
      videoPrompt: `将"${goal}"转成 60 秒短视频脚本`,
      references: activeReferences.map((item) => ({
        title: item.title,
        citation: item.citation,
      })),
      ...ragMeta,
    };
  }
}

// Step input resolver
async function resolveStepInput(
  username: string,
  goalId: string,
  conversationId: string | null,
  goal: string,
  plan: StoredPlan,
  step: PlannedStep,
  draftCache: DraftBundle | null
): Promise<Record<string, unknown>> {
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

// Approval helper
async function approvalGranted(goalId: string, stepKey: string): Promise<boolean> {
  const approval = await agentPlatformRepository.getApprovalByStepKey(goalId, stepKey);
  return approval?.status === "approved";
}

// Public API: Create Goal
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

  if (executionMode === "auto_low_risk" || executionMode === "confirm") {
    return await executeAgentGoal(goalId, username);
  }

  return await getAgentGoalTimeline(goalId, username);
}

// Public API: Approve Action
export async function approveAgentAction(approvalId: number, username: string) {
  const ts = nowIso();
  const approval = await agentPlatformRepository.getApprovalById(approvalId, username);
  if (!approval) throw new Error("approval_not_found");
  const ok = await agentPlatformRepository.updateApprovalStatus(approvalId, username, "approved", ts);
  if (!ok) throw new Error("approval_not_found");
  return {
    id: approvalId,
    status: "approved",
    timeline_event: buildApprovalEvent(approval.goal_id, { ...approval, status: "approved" }, "已批准", ts),
  };
}

// Public API: Reject Action
export async function rejectAgentAction(approvalId: number, username: string) {
  const ts = nowIso();
  const approval = await agentPlatformRepository.getApprovalById(approvalId, username);
  if (!approval) throw new Error("approval_not_found");
  const ok = await agentPlatformRepository.updateApprovalStatus(approvalId, username, "rejected", ts);
  if (!ok) throw new Error("approval_not_found");
  return {
    id: approvalId,
    status: "rejected",
    timeline_event: buildApprovalEvent(approval.goal_id, { ...approval, status: "rejected" }, "已拒绝", ts),
  };
}

// Public API: Execute Goal
export async function executeAgentGoal(
  goalId: string,
  username: string,
  options?: { onEvent?: GoalEventReporter }
) {
  const goal = await agentPlatformRepository.getGoalById(goalId, username);
  if (!goal) throw new Error("goal_not_found");

  if (goal.status === "done" || goal.status === "running") {
    return await getAgentGoalTimeline(goalId, username);
  }

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
  await agentPlatformRepository.updateGoalStatus(
    goalId,
    username,
    "running",
    goal.summary,
    goal.plan_json,
    runningTs
  );
  await emitGoalEvent(
    options?.onEvent,
    buildGoalStatusEvent(goalId, "running", "Goal 开始执行", runningTs),
    runtimeEvents
  );

  for (const step of plan.steps) {
    const existing = await agentPlatformRepository.getGoalStepByKey(goalId, step.step_key);
    if (existing?.status === "done") {
      if (step.kind === "llm") {
        draftCache = parseJson(existing.output_json, null);
      }
      continue;
    }

    let preapprovedInputPayload: Record<string, unknown> | null = null;
    if (step.requires_approval) {
      const approval = await agentPlatformRepository.getApprovalByStepKey(goalId, step.step_key);
      if (approval?.status === "rejected") {
        hasFailure = true;
        const rejectedAt = nowIso();
        await agentPlatformRepository.updateGoalStepByKey({
          goalId,
          stepKey: step.step_key,
          status: "failed",
          outputJson: JSON.stringify({ error: "approval_rejected" }),
          finishedAt: rejectedAt,
        });
        await emitGoalEvent(
          options?.onEvent,
          buildStepEvent(goalId, step, "failed", "用户已拒绝该操作", rejectedAt),
          runtimeEvents
        );
        break;
      }

      preapprovedInputPayload = await resolveStepInput(
        username,
        goalId,
        goal.conversation_id || null,
        goal.goal,
        plan,
        step,
        draftCache
      );
      if (step.tool_name) {
        await agentPlatformRepository.updateApprovalPayloadByStepKey(
          goalId,
          step.step_key,
          JSON.stringify(preapprovedInputPayload)
        );
      }

      if (!(await approvalGranted(goalId, step.step_key))) {
        waitingApproval = true;
        await agentPlatformRepository.updateGoalStepByKey({
          goalId,
          stepKey: step.step_key,
          status: "skipped_waiting_approval",
          inputJson: JSON.stringify(preapprovedInputPayload),
          outputJson: JSON.stringify({ waiting_approval: true }),
          finishedAt: nowIso(),
        });
        break;
      }
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
        await emitGoalEvent(
          options?.onEvent,
          buildStepEvent(goalId, step, "done", "草稿生成完成", finishedAt),
          runtimeEvents
        );
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
            buildArtifactEvent(
              goalId,
              step.step_key,
              "video_prompt",
              "视频脚本 / 提示词",
              previewUnknown(draftCache.videoPrompt),
              finishedAt
            ),
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
        await emitGoalEvent(
          options?.onEvent,
          buildStepEvent(goalId, step, "done", "参考资料准备完成", finishedAt),
          runtimeEvents
        );
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
          await emitGoalEvent(
            options?.onEvent,
            buildStepEvent(goalId, step, "done", "视频生成暂未开放，已保留脚本输出", finishedAt),
            runtimeEvents
          );
          continue;
        }

        const inputPayload =
          preapprovedInputPayload ||
          (await resolveStepInput(
            username,
            goalId,
            goal.conversation_id || null,
            goal.goal,
            plan,
            step,
            draftCache
          ));
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
        await emitGoalEvent(
          options?.onEvent,
          buildStepEvent(goalId, step, "done", step.tool_name || "工具执行完成", finishedAt),
          runtimeEvents
        );
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
      await emitGoalEvent(
        options?.onEvent,
        buildStepEvent(goalId, step, "failed", errorMessage, failedAt),
        runtimeEvents
      );
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
  await emitGoalEvent(
    options?.onEvent,
    buildGoalStatusEvent(goalId, nextStatus, nextSummary, finishedTs),
    runtimeEvents
  );

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

// Timeline helper
function extractGoalCompletionContent(
  timeline: Awaited<ReturnType<typeof getAgentGoalTimeline>>,
  fallbackSummary: string
): string {
  const llmStep = [...timeline.timeline].reverse().find((step) => step.kind === "llm" && step.status === "done");
  const llmOutput = llmStep?.output as { content?: string } | undefined;
  if (typeof llmOutput?.content === "string" && llmOutput.content.trim()) {
    return llmOutput.content.trim().slice(0, 320);
  }

  const createPostStep = [...timeline.timeline]
    .reverse()
    .find((step) => step.step_key === "create_post" && step.status === "done");
  const createPostInput = createPostStep?.input as { content?: string; title?: string } | undefined;
  if (typeof createPostInput?.content === "string" && createPostInput.content.trim()) {
    return createPostInput.content.trim().slice(0, 320);
  }

  if (typeof createPostInput?.title === "string" && createPostInput.title.trim()) {
    return `${createPostInput.title.trim()} 已生成并保存为草稿。`;
  }

  return fallbackSummary;
}

// Gallery extraction
function extractGoalDeliverable(
  timeline: Awaited<ReturnType<typeof getAgentGoalTimeline>>
): Omit<AgentGalleryItem, "goal_id" | "conversation_id" | "task_type" | "status" | "updated_at"> | null {
  const llmStep = [...timeline.timeline].reverse().find((step) => step.kind === "llm" && step.status === "done");
  const llmOutput = asRecord(llmStep?.output);
  const llmSeo = asRecord(llmOutput?.seo);

  const createPostStep = [...timeline.timeline]
    .reverse()
    .find((step) => step.step_key === "create_post" && step.status === "done");
  const createPostInput = asRecord(createPostStep?.input);
  const createPostOutput = asRecord(createPostStep?.output);
  const createPostResult = asRecord(createPostOutput?.result);

  const createVideoStep = [...timeline.timeline]
    .reverse()
    .find((step) => step.step_key === "create_video" && step.status === "done");
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

// Public API: Get Goal Timeline
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

// Public API: List Gallery Items
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

  return timelines.filter(Boolean) as AgentGalleryItem[];
}
