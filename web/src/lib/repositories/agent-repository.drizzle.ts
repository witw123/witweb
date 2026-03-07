import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/drizzle";
import { agentArtifacts, agentRuns, agentSteps } from "@/lib/db/schema";
import type {
  AgentArtifactRow,
  AgentRunRow,
  AgentStepRow,
  ArtifactKind,
} from "./agent-repository";

type AgentRunListItem = Omit<AgentRunRow, "username">;

function normalizeRun(row: {
  id: string;
  username: string;
  goal: string;
  agent_type: string;
  status: string;
  model: string;
  error_message: string;
  created_at: string;
  updated_at: string;
}): AgentRunRow {
  return {
    ...row,
    agent_type: row.agent_type as AgentRunRow["agent_type"],
    status: row.status as AgentRunRow["status"],
  };
}

function normalizeRunListItem(row: {
  id: string;
  goal: string;
  agent_type: string;
  status: string;
  model: string;
  error_message: string;
  created_at: string;
  updated_at: string;
}): AgentRunListItem {
  return {
    ...row,
    agent_type: row.agent_type as AgentRunRow["agent_type"],
    status: row.status as AgentRunRow["status"],
  };
}

function normalizeStep(row: {
  id: number;
  run_id: string;
  step_key: string;
  step_title: string;
  status: string;
  input_json: string;
  output_json: string;
  started_at: string;
  finished_at: string | null;
}): AgentStepRow {
  return {
    ...row,
    status: row.status as AgentStepRow["status"],
  };
}

function normalizeArtifact(row: {
  id: number;
  run_id: string;
  kind: string;
  content: string;
  meta_json: string;
  created_at: string;
}): AgentArtifactRow {
  return {
    ...row,
    kind: row.kind as AgentArtifactRow["kind"],
  };
}

export class DrizzleAgentRepository {
  async getRunByIdAndUser(runId: string, username: string): Promise<AgentRunRow | null> {
    const db = getDb();
    const rows = await db
      .select({
        id: agentRuns.id,
        username: agentRuns.username,
        goal: agentRuns.goal,
        agent_type: agentRuns.agentType,
        status: agentRuns.status,
        model: agentRuns.model,
        error_message: agentRuns.errorMessage,
        created_at: agentRuns.createdAt,
        updated_at: agentRuns.updatedAt,
      })
      .from(agentRuns)
      .where(eq(agentRuns.id, runId))
      .limit(1);

    const run = rows[0];
    if (!run || run.username !== username) return null;
    return normalizeRun(run);
  }

  async listRunsByUser(
    username: string,
    page: number,
    size: number
  ): Promise<{ items: AgentRunListItem[]; total: number; page: number; size: number }> {
    const db = getDb();
    const validPage = Math.max(1, page);
    const validSize = Math.max(1, Math.min(50, size));
    const offset = (validPage - 1) * validSize;

    const [totalRow] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(agentRuns)
      .where(eq(agentRuns.username, username));

    const items = await db
      .select({
        id: agentRuns.id,
        goal: agentRuns.goal,
        agent_type: agentRuns.agentType,
        status: agentRuns.status,
        model: agentRuns.model,
        error_message: agentRuns.errorMessage,
        created_at: agentRuns.createdAt,
        updated_at: agentRuns.updatedAt,
      })
      .from(agentRuns)
      .where(eq(agentRuns.username, username))
      .orderBy(desc(agentRuns.createdAt))
      .limit(validSize)
      .offset(offset);

    return {
      items: items.map(normalizeRunListItem),
      total: Number(totalRow?.cnt || 0),
      page: validPage,
      size: validSize,
    };
  }

  async getRunSteps(runId: string): Promise<AgentStepRow[]> {
    const db = getDb();
    const rows = await db
      .select({
        id: agentSteps.id,
        run_id: agentSteps.runId,
        step_key: agentSteps.stepKey,
        step_title: agentSteps.stepTitle,
        status: agentSteps.status,
        input_json: agentSteps.inputJson,
        output_json: agentSteps.outputJson,
        started_at: agentSteps.startedAt,
        finished_at: agentSteps.finishedAt,
      })
      .from(agentSteps)
      .where(eq(agentSteps.runId, runId))
      .orderBy(asc(agentSteps.id));

    return rows.map(normalizeStep);
  }

  async getRunArtifacts(runId: string): Promise<AgentArtifactRow[]> {
    const db = getDb();
    const rows = await db
      .select({
        id: agentArtifacts.id,
        run_id: agentArtifacts.runId,
        kind: agentArtifacts.kind,
        content: agentArtifacts.content,
        meta_json: agentArtifacts.metaJson,
        created_at: agentArtifacts.createdAt,
      })
      .from(agentArtifacts)
      .where(eq(agentArtifacts.runId, runId))
      .orderBy(desc(agentArtifacts.id));

    return rows.map(normalizeArtifact);
  }

  async getLatestArtifact(
    runId: string,
    kind: ArtifactKind
  ): Promise<{ id: number; content: string } | null> {
    const db = getDb();
    const rows = await db
      .select({
        id: agentArtifacts.id,
        content: agentArtifacts.content,
      })
      .from(agentArtifacts)
      .where(and(eq(agentArtifacts.runId, runId), eq(agentArtifacts.kind, kind)))
      .orderBy(desc(agentArtifacts.id))
      .limit(1);

    return rows[0] || null;
  }

  async getArtifactContentById(
    runId: string,
    kind: ArtifactKind,
    artifactId: number
  ): Promise<string | null> {
    const db = getDb();
    const rows = await db
      .select({
        content: agentArtifacts.content,
      })
      .from(agentArtifacts)
      .where(
        and(
          eq(agentArtifacts.id, artifactId),
          eq(agentArtifacts.runId, runId),
          eq(agentArtifacts.kind, kind)
        )
      )
      .limit(1);

    return rows[0]?.content || null;
  }

  async getLatestArtifactContent(runId: string, kind: ArtifactKind): Promise<string> {
    const artifact = await this.getLatestArtifact(runId, kind);
    return artifact?.content || "";
  }
}

export const drizzleAgentRepository = new DrizzleAgentRepository();
