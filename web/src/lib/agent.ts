import "server-only";
import { randomUUID } from "crypto";
import {
  agentRepository,
  type AgentRunRow,
  type AgentStepRow,
  type AgentArtifactRow,
} from "@/lib/repositories";
import { AGENT_MODELS, generateAgentDraft, type AgentDraftBundle, type AgentModel } from "./agent-llm";

export type AgentType = "topic" | "writing" | "publish";
export type AgentStatus = "queued" | "running" | "done" | "failed";
export type AgentStepStatus = "running" | "done" | "failed";
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

function assertRunOwner(runId: string, username: string): AgentRunRow {
  const run = agentRepository.getRunByIdAndUser(runId, username);
  if (!run) {
    throw new Error("run_not_found");
  }
  return run;
}

function insertStep(
  runId: string,
  stepKey: string,
  stepTitle: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>
) {
  const ts = nowIso();
  agentRepository.insertStepDone(runId, stepKey, stepTitle, JSON.stringify(input), JSON.stringify(output), ts);
}

function insertArtifact(runId: string, kind: ArtifactKind, content: string, meta: Record<string, unknown> = {}) {
  agentRepository.insertArtifact(runId, kind, content, JSON.stringify(meta), nowIso());
}

export function createRunRecord(username: string, goal: string, agentType: AgentType, model: string) {
  const runId = `run_${randomUUID().replace(/-/g, "")}`;
  const ts = nowIso();
  agentRepository.createRunRecord(runId, username, goal, agentType, model, ts);
  return runId;
}

export function finalizeRunFromDraft(runId: string, goal: string, agentType: AgentType, draft: AgentDraftBundle) {
  insertStep(runId, "research", "主题研究", { goal, agentType }, { keywords: draft.keywords });
  insertStep(runId, "outline", "大纲生成", { goal }, { outline: draft.outline });
  insertStep(runId, "draft", "正文生成", { goal }, { title: draft.title, tags: draft.tags });
  insertStep(runId, "seo", "SEO 生成", { title: draft.title }, draft.seo);

  insertArtifact(runId, "title", draft.title, { source: "agent", version: 1 });
  insertArtifact(runId, "content", draft.content, { source: "agent", version: 1 });
  insertArtifact(runId, "tags", draft.tags, { source: "agent", version: 1 });
  insertArtifact(runId, "seo", JSON.stringify(draft.seo, null, 2), { source: "agent", version: 1 });
  insertArtifact(runId, "cover_prompt", draft.coverPrompt, { source: "agent", version: 1 });

  agentRepository.markRunDone(runId, nowIso());
}

export function markRunFailed(runId: string, message: string) {
  agentRepository.markRunFailed(runId, message, nowIso());
}

export async function createRun(
  username: string,
  goal: string,
  agentType: AgentType,
  model: AgentModel,
  options: { assistantName?: string; customSystemPrompt?: string } = {}
) {
  const runId = createRunRecord(username, goal, agentType, model);
  try {
    const draft = await generateAgentDraft(goal, agentType, {
      model,
      assistantName: options.assistantName,
      customSystemPrompt: options.customSystemPrompt,
    });
    finalizeRunFromDraft(runId, goal, agentType, draft);
  } catch (error) {
    markRunFailed(runId, error instanceof Error ? error.message : "unknown_error");
    throw error;
  }
  return { runId, status: "done" as AgentStatus };
}

export function listRuns(username: string, page: number, size: number) {
  return agentRepository.listRunsByUser(username, page, size);
}

export function getRunDetail(runId: string, username: string) {
  const run = assertRunOwner(runId, username);

  const steps = agentRepository.getRunSteps(runId) as AgentStepRow[];
  const artifacts = agentRepository.getRunArtifacts(runId) as AgentArtifactRow[];

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

export function deleteRun(runId: string, username: string) {
  const deleted = agentRepository.deleteRunWithRelations(runId, username);
  if (!deleted) {
    throw new Error("run_not_found");
  }
  return { runId, deleted: true };
}

export async function continueRun(
  runId: string,
  username: string,
  instruction: string,
  model?: AgentModel,
  options: { assistantName?: string; customSystemPrompt?: string } = {}
) {
  const run = assertRunOwner(runId, username);
  const latestContent = agentRepository.getLatestArtifact(runId, "content");

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

  insertStep(runId, "refine", "继续优化", { instruction }, { updated: true });
  insertArtifact(runId, "content", enhanced, { source: "agent", instruction, base_id: latestContent?.id || null });
  if (generated.title) {
    insertArtifact(runId, "title", generated.title, { source: "agent", instruction });
  }
  if (generated.tags) {
    insertArtifact(runId, "tags", generated.tags, { source: "agent", instruction });
  }
  if (generated.seo) {
    insertArtifact(runId, "seo", JSON.stringify(generated.seo, null, 2), { source: "agent", instruction });
  }

  agentRepository.markRunDone(runId, nowIso());
  return { runId, status: "done" as AgentStatus };
}

function pickArtifactContent(runId: string, kind: ArtifactKind, artifactId?: number) {
  if (artifactId) {
    const content = agentRepository.getArtifactContentById(runId, kind, artifactId);
    if (content) return content;
  }

  return agentRepository.getLatestArtifactContent(runId, kind);
}

export function exportToPublish(
  runId: string,
  username: string,
  options: {
    titleArtifactId?: number;
    contentArtifactId?: number;
    tagsArtifactId?: number;
  } = {}
) {
  assertRunOwner(runId, username);

  const title = pickArtifactContent(runId, "title", options.titleArtifactId);
  const content = pickArtifactContent(runId, "content", options.contentArtifactId);
  const tags = pickArtifactContent(runId, "tags", options.tagsArtifactId);

  return {
    run_id: runId,
    title,
    content,
    tags,
    redirect: "/publish?from_agent=1",
  };
}
