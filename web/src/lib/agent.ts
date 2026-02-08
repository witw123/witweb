import "server-only";
import { randomUUID } from "crypto";
import { getStudioDb } from "./db";
import { AGENT_MODELS, generateAgentDraft, type AgentDraftBundle, type AgentModel } from "./agent-llm";

export type AgentType = "topic" | "writing" | "publish";
export type AgentStatus = "queued" | "running" | "done" | "failed";
export type AgentStepStatus = "running" | "done" | "failed";
export type ArtifactKind = "title" | "content" | "tags" | "seo" | "cover_prompt";

type AgentRunRow = {
  id: string;
  username: string;
  goal: string;
  agent_type: AgentType;
  status: AgentStatus;
  model: string;
  error_message: string;
  created_at: string;
  updated_at: string;
};

type AgentStepRow = {
  id: number;
  run_id: string;
  step_key: string;
  step_title: string;
  status: AgentStepStatus;
  input_json: string;
  output_json: string;
  started_at: string;
  finished_at: string | null;
};

type AgentArtifactRow = {
  id: number;
  run_id: string;
  kind: ArtifactKind;
  content: string;
  meta_json: string;
  created_at: string;
};

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
  const db = getStudioDb();
  const run = db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(runId) as AgentRunRow | undefined;
  if (!run || run.username !== username) {
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
  const db = getStudioDb();
  const ts = nowIso();
  db.prepare(
    `
      INSERT INTO agent_steps (
        run_id, step_key, step_title, status, input_json, output_json, started_at, finished_at
      ) VALUES (?, ?, ?, 'done', ?, ?, ?, ?)
    `
  ).run(runId, stepKey, stepTitle, JSON.stringify(input), JSON.stringify(output), ts, ts);
}

function insertArtifact(runId: string, kind: ArtifactKind, content: string, meta: Record<string, unknown> = {}) {
  const db = getStudioDb();
  db.prepare(
    `
      INSERT INTO agent_artifacts (run_id, kind, content, meta_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
  ).run(runId, kind, content, JSON.stringify(meta), nowIso());
}

export function createRunRecord(username: string, goal: string, agentType: AgentType, model: string) {
  const db = getStudioDb();
  const runId = `run_${randomUUID().replace(/-/g, "")}`;
  const ts = nowIso();
  db.prepare(
    `
      INSERT INTO agent_runs (id, username, goal, agent_type, status, model, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'running', ?, ?, ?)
    `
  ).run(runId, username, goal, agentType, model, ts, ts);
  return runId;
}

export function finalizeRunFromDraft(runId: string, goal: string, agentType: AgentType, draft: AgentDraftBundle) {
  const db = getStudioDb();
  const ts = nowIso();

  insertStep(runId, "research", "主题研究", { goal, agentType }, { keywords: draft.keywords });
  insertStep(runId, "outline", "大纲生成", { goal }, { outline: draft.outline });
  insertStep(runId, "draft", "正文生成", { goal }, { title: draft.title, tags: draft.tags });
  insertStep(runId, "seo", "SEO 生成", { title: draft.title }, draft.seo);

  insertArtifact(runId, "title", draft.title, { source: "agent", version: 1 });
  insertArtifact(runId, "content", draft.content, { source: "agent", version: 1 });
  insertArtifact(runId, "tags", draft.tags, { source: "agent", version: 1 });
  insertArtifact(runId, "seo", JSON.stringify(draft.seo, null, 2), { source: "agent", version: 1 });
  insertArtifact(runId, "cover_prompt", draft.coverPrompt, { source: "agent", version: 1 });

  db.prepare("UPDATE agent_runs SET status = 'done', updated_at = ? WHERE id = ?").run(ts, runId);
}

export function markRunFailed(runId: string, message: string) {
  const db = getStudioDb();
  db.prepare("UPDATE agent_runs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
    .run(message, nowIso(), runId);
}

export async function createRun(username: string, goal: string, agentType: AgentType, model: AgentModel) {
  const runId = createRunRecord(username, goal, agentType, model);
  try {
    const draft = await generateAgentDraft(goal, agentType, { model });
    finalizeRunFromDraft(runId, goal, agentType, draft);
  } catch (error) {
    markRunFailed(runId, error instanceof Error ? error.message : "unknown_error");
    throw error;
  }
  return { runId, status: "done" as AgentStatus };
}

export function listRuns(username: string, page: number, size: number) {
  const db = getStudioDb();
  const offset = (page - 1) * size;
  const total = (db.prepare("SELECT COUNT(*) AS cnt FROM agent_runs WHERE username = ?").get(username) as { cnt: number } | undefined)?.cnt || 0;
  const items = db
    .prepare(
      `
        SELECT id, goal, agent_type, status, model, error_message, created_at, updated_at
        FROM agent_runs
        WHERE username = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `
    )
    .all(username, size, offset) as Array<Omit<AgentRunRow, "username">>;

  return { items, total, page, size };
}

export function getRunDetail(runId: string, username: string) {
  const run = assertRunOwner(runId, username);
  const db = getStudioDb();

  const steps = db.prepare("SELECT * FROM agent_steps WHERE run_id = ? ORDER BY id ASC").all(runId) as AgentStepRow[];
  const artifacts = db
    .prepare("SELECT * FROM agent_artifacts WHERE run_id = ? ORDER BY id DESC")
    .all(runId) as AgentArtifactRow[];

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
  const db = getStudioDb();
  const run = db
    .prepare("SELECT id FROM agent_runs WHERE id = ? AND username = ?")
    .get(runId, username) as { id: string } | undefined;

  if (!run) {
    throw new Error("run_not_found");
  }

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM agent_artifacts WHERE run_id = ?").run(runId);
    db.prepare("DELETE FROM agent_steps WHERE run_id = ?").run(runId);
    db.prepare("DELETE FROM agent_runs WHERE id = ? AND username = ?").run(runId, username);
  });

  tx();
  return { runId, deleted: true };
}

export async function continueRun(runId: string, username: string, instruction: string, model?: AgentModel) {
  const run = assertRunOwner(runId, username);
  const db = getStudioDb();
  const latestContent = db
    .prepare("SELECT id, content FROM agent_artifacts WHERE run_id = ? AND kind = 'content' ORDER BY id DESC LIMIT 1")
    .get(runId) as { id: number; content: string } | undefined;

  const runModel = AGENT_MODELS.includes(run.model as AgentModel) ? (run.model as AgentModel) : undefined;
  const selectedModel = model || runModel;
  const generated = await generateAgentDraft(
    `${run.goal}\nAdditional requirement: ${instruction}`,
    run.agent_type,
    { model: selectedModel }
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

  db.prepare("UPDATE agent_runs SET updated_at = ?, status = 'done' WHERE id = ?").run(nowIso(), runId);
  return { runId, status: "done" as AgentStatus };
}

function pickArtifactContent(runId: string, kind: ArtifactKind, artifactId?: number) {
  const db = getStudioDb();
  if (artifactId) {
    const row = db
      .prepare("SELECT content FROM agent_artifacts WHERE id = ? AND run_id = ? AND kind = ?")
      .get(artifactId, runId, kind) as { content: string } | undefined;
    if (row?.content) return row.content;
  }

  const fallback = db
    .prepare("SELECT content FROM agent_artifacts WHERE run_id = ? AND kind = ? ORDER BY id DESC LIMIT 1")
    .get(runId, kind) as { content: string } | undefined;
  return fallback?.content || "";
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


