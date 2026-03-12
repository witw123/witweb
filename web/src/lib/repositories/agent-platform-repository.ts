import "server-only";

import { pgQuery, pgQueryOne, pgRun, withPgTransaction } from "@/lib/postgres-query";

export type AgentGoalStatus = "planned" | "waiting_approval" | "running" | "done" | "failed";
export type AgentApprovalStatus = "pending" | "approved" | "rejected";

export interface AgentGoalRow {
  id: string;
  conversation_id: string | null;
  username: string;
  goal: string;
  task_type: string | null;
  template_id: string | null;
  status: AgentGoalStatus;
  execution_mode: string;
  requested_tools_json: string;
  plan_json: string;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface AgentConversationRow {
  id: string;
  username: string;
  title: string;
  last_message_preview: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AgentMessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  goal_id: string | null;
  meta_json: string;
  created_at: string;
}

export interface AgentConversationMemoryRow {
  conversation_id: string;
  username: string;
  summary: string;
  key_points_json: string;
  turn_count: number;
  last_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentUserMemoryRow {
  id: number;
  username: string;
  memory_key: string;
  memory_value: string;
  source: string;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface AgentGoalStepRow {
  id: number;
  goal_id: string;
  step_key: string;
  kind: string;
  title: string;
  status: string;
  input_json: string;
  output_json: string;
  started_at: string;
  finished_at: string | null;
}

export interface AgentApprovalRow {
  id: number;
  goal_id: string;
  step_key: string;
  action: string;
  risk_level: string;
  status: AgentApprovalStatus;
  payload_json: string;
  created_at: string;
  resolved_at: string | null;
}

export interface KnowledgeDocumentRow {
  id: string;
  username: string;
  source_type: string;
  title: string;
  body: string;
  metadata_json: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunkRow {
  id: number;
  document_id: string;
  chunk_index: number;
  content: string;
  metadata_json: string;
  created_at: string;
}

export interface PromptTemplateRow {
  id: string;
  username: string;
  scenario: string;
  name: string;
  assistant_name: string;
  version: number;
  system_prompt: string;
  task_prompt: string;
  tool_prompt: string;
  output_schema_prompt: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ContentDeliveryRow {
  id: string;
  username: string;
  goal_id: string | null;
  event_type: string;
  target_url: string;
  status: string;
  payload_json: string;
  response_code: number | null;
  response_body_preview: string;
  created_at: string;
  updated_at: string;
}

class AgentPlatformRepository {
  async createGoal(params: {
    id: string;
    conversationId?: string | null;
    username: string;
    goal: string;
    taskType?: string | null;
    templateId?: string | null;
    status: AgentGoalStatus;
    executionMode: string;
    requestedToolsJson: string;
    planJson: string;
    summary: string;
    ts: string;
  }) {
    await pgRun(
      `INSERT INTO agent_goals
       (id, conversation_id, username, goal, task_type, template_id, status, execution_mode, requested_tools_json, plan_json, summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.conversationId || null,
        params.username,
        params.goal,
        params.taskType || null,
        params.templateId || null,
        params.status,
        params.executionMode,
        params.requestedToolsJson,
        params.planJson,
        params.summary,
        params.ts,
        params.ts,
      ]
    );
  }

  async createConversation(params: {
    id: string;
    username: string;
    title: string;
    lastMessagePreview?: string;
    status?: string;
    ts: string;
  }) {
    await pgRun(
      `INSERT INTO agent_conversations
       (id, username, title, last_message_preview, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.username,
        params.title,
        params.lastMessagePreview || "",
        params.status || "active",
        params.ts,
        params.ts,
      ]
    );
  }

  async updateConversation(params: {
    id: string;
    username: string;
    title?: string;
    lastMessagePreview?: string;
    status?: string;
    updatedAt: string;
  }) {
    const fields = ["updated_at = ?"];
    const values: unknown[] = [params.updatedAt];
    if (params.title !== undefined) {
      fields.push("title = ?");
      values.push(params.title);
    }
    if (params.lastMessagePreview !== undefined) {
      fields.push("last_message_preview = ?");
      values.push(params.lastMessagePreview);
    }
    if (params.status !== undefined) {
      fields.push("status = ?");
      values.push(params.status);
    }
    values.push(params.id, params.username);
    await pgRun(
      `UPDATE agent_conversations
       SET ${fields.join(", ")}
       WHERE id = ? AND username = ?`,
      values
    );
  }

  async getConversationById(conversationId: string, username: string) {
    return await pgQueryOne<AgentConversationRow>(
      "SELECT * FROM agent_conversations WHERE id = ? AND username = ?",
      [conversationId, username]
    );
  }

  async listConversations(username: string, limit = 50) {
    return await pgQuery<AgentConversationRow>(
      `SELECT * FROM agent_conversations
       WHERE username = ?
       ORDER BY updated_at DESC
       LIMIT ?`,
      [username, limit]
    );
  }

  async createMessage(params: {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    goalId?: string | null;
    metaJson?: string;
    ts: string;
  }) {
    await pgRun(
      `INSERT INTO agent_messages
       (id, conversation_id, role, content, goal_id, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.conversationId,
        params.role,
        params.content,
        params.goalId || null,
        params.metaJson || "{}",
        params.ts,
      ]
    );
  }

  async listMessages(conversationId: string) {
    return await pgQuery<AgentMessageRow>(
      `SELECT * FROM agent_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`,
      [conversationId]
    );
  }

  async updateLatestAssistantMessageByGoal(params: {
    conversationId: string;
    goalId: string;
    content?: string;
    metaJson?: string;
  }) {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (params.content !== undefined) {
      fields.push("content = ?");
      values.push(params.content);
    }

    if (params.metaJson !== undefined) {
      fields.push("meta_json = ?");
      values.push(params.metaJson);
    }

    if (fields.length === 0) return;

    await pgRun(
      `WITH latest AS (
         SELECT id
         FROM agent_messages
         WHERE conversation_id = ? AND goal_id = ? AND role = 'assistant'
         ORDER BY created_at DESC, id DESC
         LIMIT 1
       )
       UPDATE agent_messages
       SET ${fields.join(", ")}
       WHERE id IN (SELECT id FROM latest)`,
      [params.conversationId, params.goalId, ...values]
    );
  }

  async getConversationMemory(conversationId: string, username: string) {
    return await pgQueryOne<AgentConversationMemoryRow>(
      `SELECT cm.*
       FROM agent_conversation_memory cm
       INNER JOIN agent_conversations c ON c.id = cm.conversation_id
       WHERE cm.conversation_id = ? AND c.username = ?`,
      [conversationId, username]
    );
  }

  async upsertConversationMemory(params: {
    conversationId: string;
    username: string;
    summary: string;
    keyPointsJson: string;
    turnCount: number;
    lastMessageId?: string | null;
    ts: string;
  }) {
    await pgRun(
      `INSERT INTO agent_conversation_memory
       (conversation_id, username, summary, key_points_json, turn_count, last_message_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (conversation_id) DO UPDATE SET
         summary = EXCLUDED.summary,
         key_points_json = EXCLUDED.key_points_json,
         turn_count = EXCLUDED.turn_count,
         last_message_id = EXCLUDED.last_message_id,
         updated_at = EXCLUDED.updated_at`,
      [
        params.conversationId,
        params.username,
        params.summary,
        params.keyPointsJson,
        params.turnCount,
        params.lastMessageId || null,
        params.ts,
        params.ts,
      ]
    );
  }

  async listUserMemories(username: string, limit = 12) {
    return await pgQuery<AgentUserMemoryRow>(
      `SELECT *
       FROM agent_user_memory
       WHERE username = ?
       ORDER BY confidence DESC, updated_at DESC, id DESC
       LIMIT ?`,
      [username, limit]
    );
  }

  async upsertUserMemory(params: {
    username: string;
    memoryKey: string;
    memoryValue: string;
    source: string;
    confidence: number;
    ts: string;
  }) {
    await pgRun(
      `INSERT INTO agent_user_memory
       (username, memory_key, memory_value, source, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (username, memory_key, memory_value) DO UPDATE SET
         source = EXCLUDED.source,
         confidence = EXCLUDED.confidence,
         updated_at = EXCLUDED.updated_at`,
      [
        params.username,
        params.memoryKey,
        params.memoryValue,
        params.source,
        params.confidence,
        params.ts,
        params.ts,
      ]
    );
  }

  async getGoalsByConversationId(conversationId: string, username: string) {
    return await pgQuery<AgentGoalRow>(
      `SELECT * FROM agent_goals
       WHERE conversation_id = ? AND username = ?
       ORDER BY created_at ASC`,
      [conversationId, username]
    );
  }

  async setGoalConversation(goalId: string, username: string, conversationId: string) {
    await pgRun(
      `UPDATE agent_goals
       SET conversation_id = ?
       WHERE id = ? AND username = ?`,
      [conversationId, goalId, username]
    );
  }

  async deleteConversation(conversationId: string, username: string) {
    return await withPgTransaction(async (client) => {
      const conversation = await pgQueryOne<{ id: string }>(
        "SELECT id FROM agent_conversations WHERE id = ? AND username = ?",
        [conversationId, username],
        client
      );
      if (!conversation) return false;

      await pgRun(
        `DELETE FROM content_deliveries
         WHERE goal_id IN (
           SELECT id FROM agent_goals WHERE conversation_id = ? AND username = ?
         )`,
        [conversationId, username],
        client
      );

      const result = await pgRun(
        "DELETE FROM agent_conversations WHERE id = ? AND username = ?",
        [conversationId, username],
        client
      );
      return result.changes > 0;
    });
  }

  async insertGoalStep(params: {
    goalId: string;
    stepKey: string;
    kind: string;
    title: string;
    status: string;
    inputJson: string;
    outputJson: string;
    startedAt: string;
    finishedAt?: string | null;
  }) {
    await pgRun(
      `INSERT INTO agent_goal_steps
       (goal_id, step_key, kind, title, status, input_json, output_json, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.goalId,
        params.stepKey,
        params.kind,
        params.title,
        params.status,
        params.inputJson,
        params.outputJson,
        params.startedAt,
        params.finishedAt ?? null,
      ]
    );
  }

  async updateGoalStepByKey(params: {
    goalId: string;
    stepKey: string;
    status: string;
    inputJson?: string;
    outputJson?: string;
    startedAt?: string;
    finishedAt?: string | null;
  }) {
    const fields = ["status = ?"];
    const values: unknown[] = [params.status];

    if (params.inputJson !== undefined) {
      fields.push("input_json = ?");
      values.push(params.inputJson);
    }
    if (params.outputJson !== undefined) {
      fields.push("output_json = ?");
      values.push(params.outputJson);
    }
    if (params.startedAt !== undefined) {
      fields.push("started_at = ?");
      values.push(params.startedAt);
    }
    if (params.finishedAt !== undefined) {
      fields.push("finished_at = ?");
      values.push(params.finishedAt);
    }

    values.push(params.goalId, params.stepKey);
    await pgRun(
      `UPDATE agent_goal_steps
       SET ${fields.join(", ")}
       WHERE goal_id = ? AND step_key = ?`,
      values
    );
  }

  async getGoalStepByKey(goalId: string, stepKey: string) {
    return await pgQueryOne<AgentGoalStepRow>(
      `SELECT * FROM agent_goal_steps
       WHERE goal_id = ? AND step_key = ?
       ORDER BY id DESC
       LIMIT 1`,
      [goalId, stepKey]
    );
  }

  async createApproval(params: {
    goalId: string;
    stepKey: string;
    action: string;
    riskLevel: string;
    status: AgentApprovalStatus;
    payloadJson: string;
    ts: string;
  }) {
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO agent_approvals
       (goal_id, step_key, action, risk_level, status, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [params.goalId, params.stepKey, params.action, params.riskLevel, params.status, params.payloadJson, params.ts]
    );
    return Number(row?.id || 0);
  }

  async updateApprovalStatus(id: number, username: string, status: AgentApprovalStatus, ts: string) {
    return await withPgTransaction(async (client) => {
      const approval = await pgQueryOne<AgentApprovalRow>(
        `SELECT a.* FROM agent_approvals a
         INNER JOIN agent_goals g ON g.id = a.goal_id
         WHERE a.id = ? AND g.username = ?`,
        [id, username],
        client
      );
      if (!approval) return false;
      await pgRun(
        "UPDATE agent_approvals SET status = ?, resolved_at = ? WHERE id = ?",
        [status, ts, id],
        client
      );
      return true;
    });
  }

  async getApprovalById(id: number, username: string) {
    return await pgQueryOne<AgentApprovalRow>(
      `SELECT a.* FROM agent_approvals a
       INNER JOIN agent_goals g ON g.id = a.goal_id
       WHERE a.id = ? AND g.username = ?`,
      [id, username]
    );
  }

  async updateApprovalPayloadByStepKey(goalId: string, stepKey: string, payloadJson: string) {
    await pgRun(
      `UPDATE agent_approvals
       SET payload_json = ?
       WHERE id = (
         SELECT id FROM agent_approvals
         WHERE goal_id = ? AND step_key = ?
         ORDER BY id DESC
         LIMIT 1
       )`,
      [payloadJson, goalId, stepKey]
    );
  }

  async updateGoalStatus(goalId: string, username: string, status: AgentGoalStatus, summary: string, planJson: string, ts: string) {
    await pgRun(
      `UPDATE agent_goals
       SET status = ?, summary = ?, plan_json = ?, updated_at = ?
       WHERE id = ? AND username = ?`,
      [status, summary, planJson, ts, goalId, username]
    );
  }

  async getGoalById(goalId: string, username: string) {
    return await pgQueryOne<AgentGoalRow>(
      "SELECT * FROM agent_goals WHERE id = ? AND username = ?",
      [goalId, username]
    );
  }

  async getGoalSteps(goalId: string) {
    return await pgQuery<AgentGoalStepRow>(
      "SELECT * FROM agent_goal_steps WHERE goal_id = ? ORDER BY id ASC",
      [goalId]
    );
  }

  async getGoalApprovals(goalId: string) {
    return await pgQuery<AgentApprovalRow>(
      "SELECT * FROM agent_approvals WHERE goal_id = ? ORDER BY id ASC",
      [goalId]
    );
  }

  async getApprovalByStepKey(goalId: string, stepKey: string) {
    return await pgQueryOne<AgentApprovalRow>(
      `SELECT * FROM agent_approvals
       WHERE goal_id = ? AND step_key = ?
       ORDER BY id DESC
       LIMIT 1`,
      [goalId, stepKey]
    );
  }

  async createKnowledgeDocument(params: {
    id: string;
    username: string;
    sourceType: string;
    title: string;
    body: string;
    metadataJson: string;
    status: string;
    ts: string;
  }) {
    await pgRun(
      `INSERT INTO knowledge_documents
       (id, username, source_type, title, body, metadata_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.username,
        params.sourceType,
        params.title,
        params.body,
        params.metadataJson,
        params.status,
        params.ts,
        params.ts,
      ]
    );
  }

  async upsertKnowledgeDocument(params: {
    id: string;
    username: string;
    sourceType: string;
    title: string;
    body: string;
    metadataJson: string;
    status: string;
    ts: string;
  }) {
    await pgRun(
      `INSERT INTO knowledge_documents
       (id, username, source_type, title, body, metadata_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         metadata_json = EXCLUDED.metadata_json,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        params.id,
        params.username,
        params.sourceType,
        params.title,
        params.body,
        params.metadataJson,
        params.status,
        params.ts,
        params.ts,
      ]
    );
  }

  async listKnowledgeDocuments(
    username: string,
    input?: {
      limit?: number;
      offset?: number;
      sourceTypes?: string[];
    }
  ) {
    const limit = Math.max(1, Math.min(500, input?.limit || 100));
    const offset = Math.max(0, input?.offset || 0);
    const sourceTypes = (input?.sourceTypes || []).filter(Boolean);

    if (sourceTypes.length > 0) {
      const placeholders = sourceTypes.map(() => "?").join(", ");
      return await pgQuery<KnowledgeDocumentRow>(
        `SELECT *
         FROM knowledge_documents
         WHERE username = ? AND source_type IN (${placeholders})
         ORDER BY updated_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [username, ...sourceTypes, limit, offset]
      );
    }

    return await pgQuery<KnowledgeDocumentRow>(
      `SELECT *
       FROM knowledge_documents
       WHERE username = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [username, limit, offset]
    );
  }

  async replaceKnowledgeChunks(documentId: string, chunks: Array<{ index: number; content: string; metadataJson: string }>, ts: string) {
    return await withPgTransaction(async (client) => {
      await pgRun("DELETE FROM knowledge_chunks WHERE document_id = ?", [documentId], client);
      const inserted: Array<{ id: number; chunkIndex: number; content: string }> = [];
      for (const chunk of chunks) {
        const row = await pgQueryOne<{ id: number }>(
          `INSERT INTO knowledge_chunks (document_id, chunk_index, content, metadata_json, created_at)
           VALUES (?, ?, ?, ?, ?)
           RETURNING id`,
          [documentId, chunk.index, chunk.content, chunk.metadataJson, ts],
          client
        );
        inserted.push({
          id: Number(row?.id || 0),
          chunkIndex: chunk.index,
          content: chunk.content,
        });
      }
      return inserted;
    });
  }

  async replaceKnowledgeChunkEmbeddings(
    documentId: string,
    embeddings: Array<{ chunkId: number; model: string; embedding: string }>,
    ts: string
  ) {
    await withPgTransaction(async (client) => {
      await pgRun(
        `DELETE FROM knowledge_chunk_embeddings
         WHERE chunk_id IN (
           SELECT id FROM knowledge_chunks WHERE document_id = ?
         )`,
        [documentId],
        client
      );

      for (const item of embeddings) {
        await pgRun(
          `INSERT INTO knowledge_chunk_embeddings (chunk_id, model, embedding, created_at)
           VALUES (?, ?, ?::vector, ?)`,
          [item.chunkId, item.model, item.embedding, ts],
          client
        );
      }
    });
  }

  async searchKnowledgeVector(username: string, embedding: string, limit: number) {
    return await pgQuery<
      KnowledgeChunkRow & {
        document_title: string;
        document_source_type: string;
        similarity: number;
      }
    >(
      `SELECT
         kc.*,
         kd.title AS document_title,
         kd.source_type AS document_source_type,
         1 - (kce.embedding <=> ?::vector) AS similarity
       FROM knowledge_chunk_embeddings kce
       INNER JOIN knowledge_chunks kc ON kc.id = kce.chunk_id
       INNER JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kd.username = ?
       ORDER BY kce.embedding <=> ?::vector ASC
       LIMIT ?`,
      [embedding, username, embedding, limit]
    );
  }

  async searchKnowledgeLexical(username: string, query: string, limit: number) {
    const normalized = `%${query.trim()}%`;
    return await pgQuery<
      KnowledgeChunkRow & {
        document_title: string;
        document_source_type: string;
      }
    >(
      `SELECT kc.*, kd.title AS document_title, kd.source_type AS document_source_type
       FROM knowledge_chunks kc
       INNER JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kd.username = ?
         AND (kc.content ILIKE ? OR kd.title ILIKE ? OR kd.body ILIKE ?)
       ORDER BY kc.id DESC
       LIMIT ?`,
      [username, normalized, normalized, normalized, limit]
    );
  }

  async createPromptTemplate(params: {
    id: string;
    username: string;
    scenario: string;
    name: string;
    assistantName: string;
    version: number;
    systemPrompt: string;
    taskPrompt: string;
    toolPrompt: string;
    outputSchemaPrompt: string;
    isActive: boolean;
    ts: string;
  }) {
    await pgRun(
      `INSERT INTO prompt_templates
       (id, username, scenario, name, assistant_name, version, system_prompt, task_prompt, tool_prompt, output_schema_prompt, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.username,
        params.scenario,
        params.name,
        params.assistantName,
        params.version,
        params.systemPrompt,
        params.taskPrompt,
        params.toolPrompt,
        params.outputSchemaPrompt,
        params.isActive ? 1 : 0,
        params.ts,
        params.ts,
      ]
    );
  }

  async listPromptTemplates(username: string, scenario?: string) {
    const filters = ["username = ?"];
    const values: unknown[] = [username];

    if (scenario) {
      filters.push("scenario = ?");
      values.push(scenario);
    }

    return await pgQuery<PromptTemplateRow>(
      `SELECT * FROM prompt_templates
       WHERE ${filters.join(" AND ")}
       ORDER BY is_active DESC, scenario ASC, name ASC, version DESC, updated_at DESC`,
      values
    );
  }

  async getPromptTemplateById(id: string, username: string) {
    return await pgQueryOne<PromptTemplateRow>(
      "SELECT * FROM prompt_templates WHERE id = ? AND username = ?",
      [id, username]
    );
  }

  async getNextPromptTemplateVersion(username: string, scenario: string, name: string) {
    const row = await pgQueryOne<{ max_version: number | null }>(
      `SELECT MAX(version) AS max_version
       FROM prompt_templates
       WHERE username = ? AND scenario = ? AND name = ?`,
      [username, scenario, name]
    );
    return Number(row?.max_version || 0) + 1;
  }

  async activatePromptTemplate(id: string, username: string) {
    return await withPgTransaction(async (client) => {
      const template = await pgQueryOne<PromptTemplateRow>(
        "SELECT * FROM prompt_templates WHERE id = ? AND username = ?",
        [id, username],
        client
      );
      if (!template) return null;

      await pgRun(
        `UPDATE prompt_templates
         SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END,
             updated_at = NOW()
         WHERE username = ? AND scenario = ?`,
        [id, username, template.scenario],
        client
      );

      return template;
    });
  }

  async insertPromptTestRun(params: {
    id: string;
    username: string;
    templateId?: string | null;
    model: string;
    inputJson: string;
    outputJson: string;
    score: number;
    ts: string;
  }) {
    await pgRun(
      `INSERT INTO prompt_test_runs
       (id, username, template_id, model, input_json, output_json, score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.username,
        params.templateId || null,
        params.model,
        params.inputJson,
        params.outputJson,
        params.score,
        params.ts,
      ]
    );
  }

  async getRecentPromptTestRuns(username: string, templateId?: string, limit = 12) {
    const filters = ["username = ?"];
    const values: unknown[] = [username];

    if (templateId) {
      filters.push("template_id = ?");
      values.push(templateId);
    }

    values.push(limit);
    return await pgQuery<{
      id: string;
      model: string;
      score: number;
      output_json: string;
      created_at: string;
    }>(
      `SELECT id, model, score, output_json, created_at
       FROM prompt_test_runs
       WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ?`,
      values
    );
  }

  async createContentDelivery(params: {
    id: string;
    username: string;
    goalId?: string | null;
    eventType: string;
    targetUrl: string;
    status: string;
    payloadJson: string;
    responseCode?: number | null;
    responseBodyPreview?: string;
    ts: string;
  }) {
    await pgRun(
      `INSERT INTO content_deliveries
       (id, username, goal_id, event_type, target_url, status, payload_json, response_code, response_body_preview, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.username,
        params.goalId || null,
        params.eventType,
        params.targetUrl,
        params.status,
        params.payloadJson,
        params.responseCode || null,
        params.responseBodyPreview || "",
        params.ts,
        params.ts,
      ]
    );
  }

  async updateContentDelivery(params: {
    id: string;
    status: string;
    responseCode?: number | null;
    responseBodyPreview?: string;
    ts: string;
  }) {
    await pgRun(
      `UPDATE content_deliveries
       SET status = ?, response_code = ?, response_body_preview = ?, updated_at = ?
       WHERE id = ?`,
      [
        params.status,
        params.responseCode || null,
        params.responseBodyPreview || "",
        params.ts,
        params.id,
      ]
    );
  }

  async listContentDeliveries(username: string, goalId?: string | null, limit = 10) {
    const filters = ["username = ?"];
    const values: unknown[] = [username];

    if (goalId) {
      filters.push("goal_id = ?");
      values.push(goalId);
    }

    values.push(limit);
    return await pgQuery<ContentDeliveryRow>(
      `SELECT * FROM content_deliveries
       WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ?`,
      values
    );
  }
}

export const agentPlatformRepository = new AgentPlatformRepository();
