import "server-only";
import { getStudioDb } from "@/lib/db";

export type AgentType = "topic" | "writing" | "publish";
export type AgentStatus = "queued" | "running" | "done" | "failed";
export type AgentStepStatus = "running" | "done" | "failed";
export type ArtifactKind = "title" | "content" | "tags" | "seo" | "cover_prompt";

export type AgentRunRow = {
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

export type AgentStepRow = {
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

export type AgentArtifactRow = {
  id: number;
  run_id: string;
  kind: ArtifactKind;
  content: string;
  meta_json: string;
  created_at: string;
};

class AgentRepository {
  private db() {
    return getStudioDb();
  }

  createRunRecord(runId: string, username: string, goal: string, agentType: AgentType, model: string, ts: string): void {
    this.db()
      .prepare(
        `INSERT INTO agent_runs (id, username, goal, agent_type, status, model, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'running', ?, ?, ?)`
      )
      .run(runId, username, goal, agentType, model, ts, ts);
  }

  insertStepDone(
    runId: string,
    stepKey: string,
    stepTitle: string,
    inputJson: string,
    outputJson: string,
    ts: string
  ): void {
    this.db()
      .prepare(
        `INSERT INTO agent_steps (
           run_id, step_key, step_title, status, input_json, output_json, started_at, finished_at
         ) VALUES (?, ?, ?, 'done', ?, ?, ?, ?)`
      )
      .run(runId, stepKey, stepTitle, inputJson, outputJson, ts, ts);
  }

  insertArtifact(runId: string, kind: ArtifactKind, content: string, metaJson: string, ts: string): void {
    this.db()
      .prepare(
        `INSERT INTO agent_artifacts (run_id, kind, content, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(runId, kind, content, metaJson, ts);
  }

  markRunDone(runId: string, ts: string): void {
    this.db().prepare("UPDATE agent_runs SET status = 'done', updated_at = ? WHERE id = ?").run(ts, runId);
  }

  markRunFailed(runId: string, message: string, ts: string): void {
    this.db()
      .prepare("UPDATE agent_runs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
      .run(message, ts, runId);
  }

  getRunById(runId: string): AgentRunRow | null {
    return (this.db().prepare("SELECT * FROM agent_runs WHERE id = ?").get(runId) as AgentRunRow | undefined) || null;
  }

  getRunByIdAndUser(runId: string, username: string): AgentRunRow | null {
    return (
      this.db().prepare("SELECT * FROM agent_runs WHERE id = ? AND username = ?").get(runId, username) as
        | AgentRunRow
        | undefined
    ) || null;
  }

  listRunsByUser(username: string, page: number, size: number): {
    items: Array<Omit<AgentRunRow, "username">>;
    total: number;
    page: number;
    size: number;
  } {
    const offset = (page - 1) * size;
    const db = this.db();

    const total =
      (db.prepare("SELECT COUNT(*) AS cnt FROM agent_runs WHERE username = ?").get(username) as
        | { cnt: number }
        | undefined)?.cnt || 0;

    const items = db
      .prepare(
        `SELECT id, goal, agent_type, status, model, error_message, created_at, updated_at
         FROM agent_runs
         WHERE username = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(username, size, offset) as Array<Omit<AgentRunRow, "username">>;

    return { items, total, page, size };
  }

  getRunSteps(runId: string): AgentStepRow[] {
    return this.db().prepare("SELECT * FROM agent_steps WHERE run_id = ? ORDER BY id ASC").all(runId) as AgentStepRow[];
  }

  getRunArtifacts(runId: string): AgentArtifactRow[] {
    return this.db().prepare("SELECT * FROM agent_artifacts WHERE run_id = ? ORDER BY id DESC").all(runId) as AgentArtifactRow[];
  }

  getLatestArtifact(runId: string, kind: ArtifactKind): { id: number; content: string } | null {
    return (
      this.db()
        .prepare("SELECT id, content FROM agent_artifacts WHERE run_id = ? AND kind = ? ORDER BY id DESC LIMIT 1")
        .get(runId, kind) as { id: number; content: string } | undefined
    ) || null;
  }

  getArtifactContentById(runId: string, kind: ArtifactKind, artifactId: number): string | null {
    const row = this.db()
      .prepare("SELECT content FROM agent_artifacts WHERE id = ? AND run_id = ? AND kind = ?")
      .get(artifactId, runId, kind) as { content: string } | undefined;
    return row?.content || null;
  }

  getLatestArtifactContent(runId: string, kind: ArtifactKind): string {
    const row = this.db()
      .prepare("SELECT content FROM agent_artifacts WHERE run_id = ? AND kind = ? ORDER BY id DESC LIMIT 1")
      .get(runId, kind) as { content: string } | undefined;
    return row?.content || "";
  }

  deleteRunWithRelations(runId: string, username: string): boolean {
    const db = this.db();
    const run = db
      .prepare("SELECT id FROM agent_runs WHERE id = ? AND username = ?")
      .get(runId, username) as { id: string } | undefined;
    if (!run) return false;

    db.transaction(() => {
      db.prepare("DELETE FROM agent_artifacts WHERE run_id = ?").run(runId);
      db.prepare("DELETE FROM agent_steps WHERE run_id = ?").run(runId);
      db.prepare("DELETE FROM agent_runs WHERE id = ? AND username = ?").run(runId, username);
    })();

    return true;
  }
}

export const agentRepository = new AgentRepository();
