import { randomUUID } from "crypto";
import { pgQuery, pgQueryOne, pgRun, withPgTransaction } from "@/lib/postgres-query";
import type { Character, StudioConfig, StudioHistory, VideoResult, VideoTask, VideoTaskStatus, VideoTaskType } from "@/types";
import type { PaginatedResult } from "./types";

export interface CreateVideoTaskData {
  id?: string;
  username: string;
  task_type: VideoTaskType;
  status?: VideoTaskStatus;
  progress?: number;
  prompt?: string | null;
  model?: string | null;
  url?: string | null;
  aspect_ratio?: string | null;
  duration?: number | null;
  remix_target_id?: string | null;
  size?: string | null;
  pid?: string | null;
  timestamps?: string | null;
}

export interface UpdateVideoTaskData {
  status?: VideoTaskStatus;
  progress?: number;
  result_json?: string;
  failure_reason?: string;
  error?: string;
}

export interface CreateCharacterData {
  username: string;
  character_id: string;
  name?: string | null;
  source_task_id?: string | null;
}

function normalizePagination(page = 1, size = 20): { page: number; size: number; offset: number } {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(50, size));
  const offset = (validPage - 1) * validSize;
  return { page: validPage, size: validSize, offset };
}

export class VideoTaskRepository {
  async findById(id: string): Promise<VideoTask | null> {
    return await pgQueryOne<VideoTask>("SELECT * FROM video_tasks WHERE id = ?", [id]);
  }

  async findByIdAndUser(id: string, username: string): Promise<VideoTask | null> {
    return await pgQueryOne<VideoTask>("SELECT * FROM video_tasks WHERE id = ? AND username = ?", [id, username]);
  }

  async create(data: CreateVideoTaskData): Promise<string> {
    const id = data.id || randomUUID();
    await pgRun(
      `INSERT INTO video_tasks (
        id, username, task_type, status, progress,
        prompt, model, url, aspect_ratio, duration,
        remix_target_id, size, pid, timestamps
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.username,
        data.task_type,
        data.status || "pending",
        data.progress || 0,
        data.prompt || null,
        data.model || null,
        data.url || null,
        data.aspect_ratio || null,
        data.duration || null,
        data.remix_target_id || null,
        data.size || null,
        data.pid || null,
        data.timestamps || null,
      ]
    );
    return id;
  }

  async updateStatus(id: string, data: UpdateVideoTaskData): Promise<boolean> {
    const fields: string[] = ["updated_at = NOW()"]; const params: unknown[] = [];
    if (data.status !== undefined) { fields.push("status = ?"); params.push(data.status); }
    if (data.progress !== undefined) { fields.push("progress = ?"); params.push(data.progress); }
    if (data.result_json !== undefined) { fields.push("result_json = ?"); params.push(data.result_json); }
    if (data.failure_reason !== undefined) { fields.push("failure_reason = ?"); params.push(data.failure_reason); }
    if (data.error !== undefined) { fields.push("error = ?"); params.push(data.error); }
    params.push(id);
    const result = await pgRun(`UPDATE video_tasks SET ${fields.join(", ")} WHERE id = ?`, params);
    return result.changes > 0;
  }

  async deleteById(id: string, username?: string): Promise<boolean> {
    return await withPgTransaction(async (client) => {
      if (username) {
        const task = await pgQueryOne<VideoTask>("SELECT * FROM video_tasks WHERE id = ? AND username = ?", [id, username], client);
        if (!task) return false;
      }
      await pgRun("DELETE FROM video_results WHERE task_id = ?", [id], client);
      const result = await pgRun("DELETE FROM video_tasks WHERE id = ?", [id], client);
      return result.changes > 0;
    });
  }

  async listByUser(username: string, page = 1, size = 20, taskType?: VideoTaskType): Promise<PaginatedResult<VideoTask>> {
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    let whereClause = "WHERE username = ?";
    const params: unknown[] = [username];
    if (taskType) {
      whereClause += " AND task_type = ?";
      params.push(taskType);
    }
    const total = (await pgQueryOne<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM video_tasks ${whereClause}`, params))?.cnt || 0;
    const items = await pgQuery<VideoTask>(
      `SELECT * FROM video_tasks ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, validSize, offset]
    );
    return { items, total, page: validPage, size: validSize };
  }

  async getRecentByUser(username: string, limit = 5): Promise<VideoTask[]> {
    return await pgQuery<VideoTask>("SELECT * FROM video_tasks WHERE username = ? ORDER BY created_at DESC LIMIT ?", [username, limit]);
  }

  async getPendingTasks(): Promise<VideoTask[]> {
    return await pgQuery<VideoTask>("SELECT * FROM video_tasks WHERE status IN ('pending', 'running') ORDER BY created_at ASC");
  }

  async getResultsByTaskId(taskId: string): Promise<VideoResult[]> {
    return await pgQuery<VideoResult>("SELECT * FROM video_results WHERE task_id = ? ORDER BY created_at ASC", [taskId]);
  }

  async addResult(taskId: string, url: string, data?: { remove_watermark?: boolean; pid?: string; character_id?: string }): Promise<number> {
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO video_results (task_id, url, remove_watermark, pid, character_id)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [taskId, url, data?.remove_watermark || false, data?.pid || null, data?.character_id || null]
    );
    return Number(row?.id || 0);
  }

  async addResults(taskId: string, results: Array<{ url: string; remove_watermark?: boolean; pid?: string; character_id?: string }>): Promise<void> {
    await withPgTransaction(async (client) => {
      for (const r of results) {
        await pgRun(
          "INSERT INTO video_results (task_id, url, remove_watermark, pid, character_id) VALUES (?, ?, ?, ?, ?)",
          [taskId, r.url, r.remove_watermark || false, r.pid || null, r.character_id || null],
          client
        );
      }
    });
  }

  async deleteResultsByTaskId(taskId: string): Promise<number> {
    return (await pgRun("DELETE FROM video_results WHERE task_id = ?", [taskId])).changes;
  }

  async listCharacters(username: string): Promise<Character[]> {
    return await pgQuery<Character>("SELECT * FROM characters WHERE username = ? ORDER BY created_at DESC", [username]);
  }

  async getCharacterById(characterId: string, username?: string): Promise<Character | null> {
    if (!username) return await pgQueryOne<Character>("SELECT * FROM characters WHERE character_id = ?", [characterId]);
    return await pgQueryOne<Character>("SELECT * FROM characters WHERE character_id = ? AND username = ?", [characterId, username]);
  }

  async createCharacter(data: CreateCharacterData): Promise<number> {
    const row = await pgQueryOne<{ id: number }>(
      "INSERT INTO characters (username, character_id, name, source_task_id) VALUES (?, ?, ?, ?) RETURNING id",
      [data.username, data.character_id, data.name || null, data.source_task_id || null]
    );
    return Number(row?.id || 0);
  }

  async updateCharacterName(characterId: string, name: string): Promise<boolean> {
    return (await pgRun("UPDATE characters SET name = ? WHERE character_id = ?", [name, characterId])).changes > 0;
  }

  async deleteCharacter(characterId: string, username?: string): Promise<boolean> {
    if (!username) return (await pgRun("DELETE FROM characters WHERE character_id = ?", [characterId])).changes > 0;
    return (await pgRun("DELETE FROM characters WHERE character_id = ? AND username = ?", [characterId, username])).changes > 0;
  }

  async addActiveTask(taskId: string, prompt: string): Promise<boolean> {
    const result = await pgRun("INSERT INTO studio_active_tasks (id, prompt, start_time) VALUES (?, ?, ?)", [taskId, prompt, Math.floor(Date.now() / 1000)]);
    return result.changes > 0;
  }

  async removeActiveTask(taskId: string): Promise<boolean> {
    return (await pgRun("DELETE FROM studio_active_tasks WHERE id = ?", [taskId])).changes > 0;
  }

  async getActiveTasks(): Promise<Array<{ id: string; prompt: string; start_time: number }>> {
    return await pgQuery("SELECT id, prompt, start_time FROM studio_active_tasks ORDER BY start_time DESC");
  }

  async getConfig(): Promise<StudioConfig> {
    const rows = await pgQuery<Array<{ key: string; value: string }> extends (infer R)[] ? R : never>("SELECT key, value FROM studio_config");
    const cfg: Record<string, unknown> = {};
    for (const row of rows as Array<{ key: string; value: string }>) {
      try { cfg[row.key] = JSON.parse(row.value); } catch { cfg[row.key] = row.value; }
    }
    return cfg as StudioConfig;
  }

  async getConfigValue(key: keyof StudioConfig): Promise<unknown> {
    const result = await pgQueryOne<{ value: string }>("SELECT value FROM studio_config WHERE key = ?", [key]);
    if (!result) return undefined;
    try { return JSON.parse(result.value); } catch { return result.value; }
  }

  async setConfigValue(key: keyof StudioConfig, value: unknown): Promise<boolean> {
    const result = await pgRun(
      `INSERT INTO studio_config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, JSON.stringify(value)]
    );
    return result.changes > 0;
  }

  async deleteConfig(key: keyof StudioConfig): Promise<boolean> {
    return (await pgRun("DELETE FROM studio_config WHERE key = ?", [key])).changes > 0;
  }

  async addHistory(data: { file?: string; prompt?: string; task_id?: string; pid?: string; url?: string; duration_seconds?: number }): Promise<number> {
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO studio_history (file, prompt, time, task_id, pid, url, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [data.file || null, data.prompt || null, Math.floor(Date.now() / 1000), data.task_id || null, data.pid || null, data.url || null, data.duration_seconds ?? null]
    );
    return Number(row?.id || 0);
  }

  async getHistory(): Promise<StudioHistory[]> {
    return await pgQuery<StudioHistory>("SELECT * FROM studio_history ORDER BY time DESC");
  }

  async getHistoryByTaskId(taskId: string): Promise<StudioHistory | null> {
    return await pgQueryOne<StudioHistory>("SELECT * FROM studio_history WHERE task_id = ? ORDER BY time DESC LIMIT 1", [taskId]);
  }

  async deleteHistory(id: number): Promise<boolean> {
    return (await pgRun("DELETE FROM studio_history WHERE id = ?", [id])).changes > 0;
  }

  async deleteHistoryByFile(file: string): Promise<boolean> {
    return (await pgRun("DELETE FROM studio_history WHERE file = ?", [file])).changes > 0;
  }

  async recordTaskTime(taskId: string, timestamp?: number): Promise<boolean> {
    const result = await pgRun(
      `INSERT INTO studio_task_times (task_id, ts) VALUES (?, ?)
       ON CONFLICT(task_id) DO UPDATE SET ts = excluded.ts`,
      [taskId, timestamp || Math.floor(Date.now() / 1000)]
    );
    return result.changes > 0;
  }

  async getTaskTime(taskId: string): Promise<number | null> {
    return (await pgQueryOne<{ ts: number }>("SELECT ts FROM studio_task_times WHERE task_id = ?", [taskId]))?.ts || null;
  }

  async deleteTaskTime(taskId: string): Promise<boolean> {
    return (await pgRun("DELETE FROM studio_task_times WHERE task_id = ?", [taskId])).changes > 0;
  }

  async getUserStats(username: string): Promise<{ total: number; pending: number; succeeded: number; failed: number }> {
    const total = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM video_tasks WHERE username = ?", [username]))?.cnt || 0;
    const pending = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM video_tasks WHERE username = ? AND status IN ('pending', 'running')", [username]))?.cnt || 0;
    const succeeded = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM video_tasks WHERE username = ? AND status = 'succeeded'", [username]))?.cnt || 0;
    const failed = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM video_tasks WHERE username = ? AND status = 'failed'", [username]))?.cnt || 0;
    return { total, pending, succeeded, failed };
  }
}

export const videoTaskRepository = new VideoTaskRepository();

