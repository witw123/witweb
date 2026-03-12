/**
 * Agent 运行管理模块
 *
 * 负责 AI Agent 运行的生命周期管理，包括创建运行、记录步骤、保存产物和导出发布
 * 数据持久化到数据库
 */

import "server-only";
import { randomUUID } from "crypto";
import {
  agentRepository,
  drizzleAgentRepository,
  type AgentRunRow,
  type AgentStepRow,
  type AgentArtifactRow,
} from "@/lib/repositories";
import { AGENT_MODELS, generateAgentDraft, type AgentDraftBundle, type AgentModel } from "./agent-llm";

/** Agent 运行类型 */
export type AgentType = "topic" | "writing" | "publish";
/** Agent 运行状态 */
export type AgentStatus = "queued" | "running" | "done" | "failed";
/** Agent 步骤状态 */
export type AgentStepStatus = "running" | "done" | "failed";
/** 产物类型 */
export type ArtifactKind = "title" | "content" | "tags" | "seo" | "cover_prompt";

function nowIso() {
  return new Date().toISOString();
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function assertRunOwner(runId: string, username: string): Promise<AgentRunRow> {
  const run = await drizzleAgentRepository.getRunByIdAndUser(runId, username);
  if (!run) {
    throw new Error("run_not_found");
  }
  return run;
}

async function insertStep(
  runId: string,
  stepKey: string,
  stepTitle: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>
) {
  const ts = nowIso();
  await agentRepository.insertStepDone(runId, stepKey, stepTitle, JSON.stringify(input), JSON.stringify(output), ts);
}

async function insertArtifact(runId: string, kind: ArtifactKind, content: string, meta: Record<string, unknown> = {}) {
  await agentRepository.insertArtifact(runId, kind, content, JSON.stringify(meta), nowIso());
}

/**
 * 创建 Agent 运行记录
 *
 * 初始化一个新的运行记录，用于追踪整个 Agent 执行过程
 *
 * @param username - 用户名
 * @param goal - 目标/主题
 * @param agentType - Agent 类型
 * @param model - 使用的模型
 * @returns 运行 ID
 */
export async function createRunRecord(username: string, goal: string, agentType: AgentType, model: string) {
  const runId = `run_${randomUUID().replace(/-/g, "")}`;
  const ts = nowIso();
  await agentRepository.createRunRecord(runId, username, goal, agentType, model, ts);
  return runId;
}

/**
 * 从草稿完成运行
 *
 * 将 AI 生成的草稿内容保存到数据库，包括步骤记录和产物
 *
 * @param runId - 运行 ID
 * @param goal - 目标
 * @param agentType - Agent 类型
 * @param draft - 生成的草稿内容
 */
export async function finalizeRunFromDraft(runId: string, goal: string, agentType: AgentType, draft: AgentDraftBundle) {
  await insertStep(runId, "research", "主题研究", { goal, agentType }, { keywords: draft.keywords });
  await insertStep(runId, "outline", "大纲生成", { goal }, { outline: draft.outline });
  await insertStep(runId, "draft", "正文生成", { goal }, { title: draft.title, tags: draft.tags });
  await insertStep(runId, "seo", "SEO 生成", { title: draft.title }, draft.seo);

  await insertArtifact(runId, "title", draft.title, { source: "agent", version: 1 });
  await insertArtifact(runId, "content", draft.content, { source: "agent", version: 1 });
  await insertArtifact(runId, "tags", Array.isArray(draft.tags) ? draft.tags.join(",") : draft.tags, { source: "agent", version: 1 });
  await insertArtifact(runId, "seo", JSON.stringify(draft.seo, null, 2), { source: "agent", version: 1 });
  await insertArtifact(runId, "cover_prompt", draft.coverPrompt, { source: "agent", version: 1 });

  await agentRepository.markRunDone(runId, nowIso());
}

/**
 * 标记运行失败
 *
 * @param runId - 运行 ID
 * @param message - 错误信息
 */
export async function markRunFailed(runId: string, message: string) {
  await agentRepository.markRunFailed(runId, message, nowIso());
}

/**
 * 创建并执行 Agent 运行
 *
 * 完整的运行流程：创建记录 -> 调用 LLM -> 保存结果
 *
 * @param username - 用户名
 * @param goal - 目标
 * @param agentType - Agent 类型
 * @param model - AI 模型
 * @param options.assistantName - 助手名称（可选）
 * @param options.customSystemPrompt - 自定义系统提示词（可选）
 * @returns 运行结果
 */
export async function createRun(
  username: string,
  goal: string,
  agentType: AgentType,
  model: AgentModel,
  options: { assistantName?: string; customSystemPrompt?: string } = {}
) {
  const runId = await createRunRecord(username, goal, agentType, model);
  try {
    const draft = await generateAgentDraft(goal, agentType, {
      model,
      assistantName: options.assistantName,
      customSystemPrompt: options.customSystemPrompt,
    });
    await finalizeRunFromDraft(runId, goal, agentType, draft);
  } catch (error) {
    await markRunFailed(runId, error instanceof Error ? error.message : "unknown_error");
    throw error;
  }
  return { runId, status: "done" as AgentStatus };
}

/**
 * 获取用户运行列表
 *
 * @param username - 用户名
 * @param page - 页码
 * @param size - 每页数量
 * @returns 运行记录列表（分页）
 */
export async function listRuns(username: string, page: number, size: number) {
  return await drizzleAgentRepository.listRunsByUser(username, page, size);
}

/**
 * 获取运行详情
 *
 * 获取运行记录、步骤和产物的完整信息
 *
 * @param runId - 运行 ID
 * @param username - 用户名（用于权限验证）
 * @returns 运行详情对象
 * @throws 无权限时抛出错误
 */
export async function getRunDetail(runId: string, username: string) {
  const run = await assertRunOwner(runId, username);

  const steps = (await drizzleAgentRepository.getRunSteps(runId)) as AgentStepRow[];
  const artifacts = (await drizzleAgentRepository.getRunArtifacts(runId)) as AgentArtifactRow[];

  return {
    run,
    steps: steps.map((step) => ({
      ...step,
      input: parseJson(step.input_json, {}),
      output: parseJson(step.output_json, {}),
    })),
    artifacts: artifacts.map((artifact) => ({
      ...artifact,
      meta: parseJson<Record<string, unknown>>(artifact.meta_json, {}),
    })),
  };
}

/**
 * 删除运行记录
 *
 * 同时删除运行、步骤和产物
 *
 * @param runId - 运行 ID
 * @param username - 用户名
 * @returns 删除结果
 * @throws 不存在时抛出错误
 */
export async function deleteRun(runId: string, username: string) {
  const deleted = await agentRepository.deleteRunWithRelations(runId, username);
  if (!deleted) {
    throw new Error("run_not_found");
  }
  return { runId, deleted: true };
}

/**
 * 继续优化运行
 *
 * 基于现有内容继续生成优化版本
 *
 * @param runId - 运行 ID
 * @param username - 用户名
 * @param instruction - 优化指令
 * @param model - AI 模型（可选）
 * @param options - 其他选项
 * @returns 运行结果
 */
export async function continueRun(
  runId: string,
  username: string,
  instruction: string,
  model?: AgentModel,
  options: { assistantName?: string; customSystemPrompt?: string } = {}
) {
  const run = await assertRunOwner(runId, username);
  const latestContent = await drizzleAgentRepository.getLatestArtifact(runId, "content");

  const runModel = AGENT_MODELS.includes(run.model as AgentModel) ? (run.model as AgentModel) : undefined;
  const selectedModel = model || runModel;
  const generated = await generateAgentDraft(
    `${run.goal}\nAdditional requirement: ${instruction}`,
    run.agent_type,
    {
      model: selectedModel,
      assistantName: options.assistantName,
      customSystemPrompt: options.customSystemPrompt,
    }
  );
  const enhanced = generated.content || `${latestContent?.content || ""}\n\n## Refinement\n${instruction}`;

  await insertStep(runId, "refine", "继续优化", { instruction }, { updated: true });
  await insertArtifact(runId, "content", enhanced, { source: "agent", instruction, base_id: latestContent?.id || null });
  if (generated.title) {
    await insertArtifact(runId, "title", generated.title, { source: "agent", instruction });
  }
  if (generated.tags) {
    await insertArtifact(runId, "tags", Array.isArray(generated.tags) ? generated.tags.join(",") : generated.tags, { source: "agent", instruction });
  }
  if (generated.seo) {
    await insertArtifact(runId, "seo", JSON.stringify(generated.seo, null, 2), { source: "agent", instruction });
  }

  await agentRepository.markRunDone(runId, nowIso());
  return { runId, status: "done" as AgentStatus };
}

async function pickArtifactContent(runId: string, kind: ArtifactKind, artifactId?: number) {
  if (artifactId) {
    const content = await drizzleAgentRepository.getArtifactContentById(runId, kind, artifactId);
    if (content) return content;
  }

  return await drizzleAgentRepository.getLatestArtifactContent(runId, kind);
}

/**
 * 导出运行结果用于发布
 *
 * 获取运行中的标题、正文和标签，准备发布到博客
 *
 * @param runId - 运行 ID
 * @param username - 用户名
 * @param options.titleArtifactId - 指定标题版本 ID（可选）
 * @param options.contentArtifactId - 指定正文版本 ID（可选）
 * @param options.tagsArtifactId - 指定标签版本 ID（可选）
 * @returns 发布数据
 */
export async function exportToPublish(
  runId: string,
  username: string,
  options: {
    titleArtifactId?: number;
    contentArtifactId?: number;
    tagsArtifactId?: number;
  } = {}
) {
  await assertRunOwner(runId, username);

  const title = await pickArtifactContent(runId, "title", options.titleArtifactId);
  const content = await pickArtifactContent(runId, "content", options.contentArtifactId);
  const tags = await pickArtifactContent(runId, "tags", options.tagsArtifactId);

  return {
    run_id: runId,
    title,
    content,
    tags,
    redirect: "/publish?from_agent=1",
  };
}
