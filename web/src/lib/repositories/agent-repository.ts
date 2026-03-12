/**
 * Agent 任务仓储层 (PostgreSQL 原生实现)
 *
 * 负责 AI Agent 任务运行的数据持久化，包括：
 * - Agent 运行记录 (agent_runs)
 * - 运行步骤 (agent_steps)
 * - 生成产物 (agent_artifacts)
 *
 * 使用 PostgreSQL 原生 SQL 进行数据操作，支持事务
 */

import "server-only";
import { pgQuery, pgQueryOne, pgRun, withPgTransaction } from "@/lib/postgres-query";

/** Agent 类型：topic-主题生成, writing-写作, publish-发布 */
export type AgentType = "topic" | "writing" | "publish";
/** Agent 运行状态 */
export type AgentStatus = "queued" | "running" | "done" | "failed";
/** Agent 步骤状态 */
export type AgentStepStatus = "running" | "done" | "failed";
/** 产物类型：title-标题, content-内容, tags-标签, seo-SEO, cover_prompt-封面提示词 */
export type ArtifactKind = "title" | "content" | "tags" | "seo" | "cover_prompt";

/** Agent 运行记录数据库行 */
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

/** Agent 步骤记录数据库行 */
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

/** Agent 产物记录数据库行 */
export type AgentArtifactRow = {
  id: number;
  run_id: string;
  kind: ArtifactKind;
  content: string;
  meta_json: string;
  created_at: string;
};

/**
 * Agent 任务数据访问类
 *
 * 提供运行记录、步骤、产物的 CRUD 操作
 */
class AgentRepository {
  async createRunRecord(runId: string, username: string, goal: string, agentType: AgentType, model: string, ts: string): Promise<void> {
    await pgRun(
      `INSERT INTO agent_runs (id, username, goal, agent_type, status, model, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'running', ?, ?, ?)`,
      [runId, username, goal, agentType, model, ts, ts]
    );
  }

  async insertStepDone(
    runId: string,
    stepKey: string,
    stepTitle: string,
    inputJson: string,
    outputJson: string,
    ts: string
  ): Promise<void> {
    await pgRun(
      `INSERT INTO agent_steps (
         run_id, step_key, step_title, status, input_json, output_json, started_at, finished_at
       ) VALUES (?, ?, ?, 'done', ?, ?, ?, ?)`,
      [runId, stepKey, stepTitle, inputJson, outputJson, ts, ts]
    );
  }

  async insertArtifact(runId: string, kind: ArtifactKind, content: string, metaJson: string, ts: string): Promise<void> {
    await pgRun(
      `INSERT INTO agent_artifacts (run_id, kind, content, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [runId, kind, content, metaJson, ts]
    );
  }

  async markRunDone(runId: string, ts: string): Promise<void> {
    await pgRun("UPDATE agent_runs SET status = 'done', updated_at = ? WHERE id = ?", [ts, runId]);
  }

  async markRunFailed(runId: string, message: string, ts: string): Promise<void> {
    await pgRun("UPDATE agent_runs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?", [message, ts, runId]);
  }

  async getRunById(runId: string): Promise<AgentRunRow | null> {
    return await pgQueryOne<AgentRunRow>("SELECT * FROM agent_runs WHERE id = ?", [runId]);
  }

  async getRunByIdAndUser(runId: string, username: string): Promise<AgentRunRow | null> {
    return await pgQueryOne<AgentRunRow>("SELECT * FROM agent_runs WHERE id = ? AND username = ?", [runId, username]);
  }

  async listRunsByUser(
    username: string,
    page: number,
    size: number
  ): Promise<{ items: Array<Omit<AgentRunRow, "username">>; total: number; page: number; size: number }> {
    const offset = (page - 1) * size;
    const total = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM agent_runs WHERE username = ?", [username]))?.cnt || 0;
    const items = await pgQuery<Array<Omit<AgentRunRow, "username">> extends (infer R)[] ? R : never>(
      `SELECT id, goal, agent_type, status, model, error_message, created_at, updated_at
       FROM agent_runs
       WHERE username = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [username, size, offset]
    );
    return { items: items as Array<Omit<AgentRunRow, "username">>, total, page, size };
  }

  async getRunSteps(runId: string): Promise<AgentStepRow[]> {
    return await pgQuery<AgentStepRow>("SELECT * FROM agent_steps WHERE run_id = ? ORDER BY id ASC", [runId]);
  }

  async getRunArtifacts(runId: string): Promise<AgentArtifactRow[]> {
    return await pgQuery<AgentArtifactRow>("SELECT * FROM agent_artifacts WHERE run_id = ? ORDER BY id DESC", [runId]);
  }

  async getLatestArtifact(runId: string, kind: ArtifactKind): Promise<{ id: number; content: string } | null> {
    return await pgQueryOne<{ id: number; content: string }>(
      "SELECT id, content FROM agent_artifacts WHERE run_id = ? AND kind = ? ORDER BY id DESC LIMIT 1",
      [runId, kind]
    );
  }

  async getArtifactContentById(runId: string, kind: ArtifactKind, artifactId: number): Promise<string | null> {
    const row = await pgQueryOne<{ content: string }>(
      "SELECT content FROM agent_artifacts WHERE id = ? AND run_id = ? AND kind = ?",
      [artifactId, runId, kind]
    );
    return row?.content || null;
  }

  async getLatestArtifactContent(runId: string, kind: ArtifactKind): Promise<string> {
    const row = await pgQueryOne<{ content: string }>(
      "SELECT content FROM agent_artifacts WHERE run_id = ? AND kind = ? ORDER BY id DESC LIMIT 1",
      [runId, kind]
    );
    return row?.content || "";
  }

  async deleteRunWithRelations(runId: string, username: string): Promise<boolean> {
    return await withPgTransaction(async (client) => {
      const run = await pgQueryOne<{ id: string }>("SELECT id FROM agent_runs WHERE id = ? AND username = ?", [runId, username], client);
      if (!run) return false;
      await pgRun("DELETE FROM agent_artifacts WHERE run_id = ?", [runId], client);
      await pgRun("DELETE FROM agent_steps WHERE run_id = ?", [runId], client);
      await pgRun("DELETE FROM agent_runs WHERE id = ? AND username = ?", [runId, username], client);
      return true;
    });
  }
}

export const agentRepository = new AgentRepository();
