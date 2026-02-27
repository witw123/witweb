/**
 */

import type Database from "better-sqlite3";
import { BaseRepository, type QueryOptions, type PaginatedResult } from "./base-repository";
import { getStudioDb } from "@/lib/db";
import type { VideoTask, VideoResult, Character, StudioConfig, StudioHistory, VideoTaskStatus, VideoTaskType } from "@/types";

/**
 */
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

/**
 */
export interface UpdateVideoTaskData {
  status?: VideoTaskStatus;
  progress?: number;
  result_json?: string;
  failure_reason?: string;
  error?: string;
}

/**
 */
export interface CreateCharacterData {
  username: string;
  character_id: string;
  name?: string | null;
  source_task_id?: string | null;
}

/**
 */
export class VideoTaskRepository extends BaseRepository<VideoTask, string> {
  protected readonly tableName = "video_tasks";
  protected readonly primaryKey = "id";

  protected getDb(options?: QueryOptions): Database {
    return options?.db || getStudioDb();
  }


  /**
   */
  findById(id: string, options?: QueryOptions): VideoTask | null {
    return this.findOne("id = ?", [id], options);
  }

  /**
   */
  findByIdAndUser(id: string, username: string, options?: QueryOptions): VideoTask | null {
    return this.findOne("id = ? AND username = ?", [id, username], options);
  }

  /**
   */
  create(data: CreateVideoTaskData, options?: QueryOptions): string {
    const sql = `
      INSERT INTO video_tasks (
        id, username, task_type, status, progress,
        prompt, model, url, aspect_ratio, duration,
        remix_target_id, size, pid, timestamps
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const id = data.id || crypto.randomUUID();
    this.run(sql, [
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
    ], options);
    return id;
  }

  /**
   */
  updateStatus(
    id: string,
    data: UpdateVideoTaskData,
    options?: QueryOptions
  ): boolean {
    const fields: string[] = ["updated_at = datetime('now', 'localtime')"];
    const params: unknown[] = [];

    if (data.status !== undefined) {
      fields.push("status = ?");
      params.push(data.status);
    }
    if (data.progress !== undefined) {
      fields.push("progress = ?");
      params.push(data.progress);
    }
    if (data.result_json !== undefined) {
      fields.push("result_json = ?");
      params.push(data.result_json);
    }
    if (data.failure_reason !== undefined) {
      fields.push("failure_reason = ?");
      params.push(data.failure_reason);
    }
    if (data.error !== undefined) {
      fields.push("error = ?");
      params.push(data.error);
    }

    params.push(id);

    const sql = `UPDATE video_tasks SET ${fields.join(", ")} WHERE id = ?`;
    const result = this.run(sql, params, options);
    return result.changes > 0;
  }

  /**
   */
  deleteById(id: string, username?: string, options?: QueryOptions): boolean {
    const db = this.getDb(options);
    
    return db.transaction(() => {
      if (username) {
        const task = this.findByIdAndUser(id, username, { db });
        if (!task) return false;
      }
      
      db.prepare("DELETE FROM video_results WHERE task_id = ?").run(id);
      const result = db.prepare("DELETE FROM video_tasks WHERE id = ?").run(id);
      return result.changes > 0;
    })();
  }

  /**
   */
  listByUser(
    username: string,
    page = 1,
    size = 20,
    taskType?: VideoTaskType,
    options?: QueryOptions
  ): PaginatedResult<VideoTask> {
    const { page: validPage, size: validSize, offset } = this.normalizePagination(page, size);
    const db = this.getDb(options);

    let whereClause = "WHERE username = ?";
    const params: unknown[] = [username];

    if (taskType) {
      whereClause += " AND task_type = ?";
      params.push(taskType);
    }

    const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM video_tasks ${whereClause}`).get(...params) as { cnt: number })?.cnt || 0;

    const sql = `SELECT * FROM video_tasks ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const items = db.prepare(sql).all(...params, validSize, offset) as VideoTask[];

    return { items, total, page: validPage, size: validSize };
  }

  /**
   */
  getRecentByUser(username: string, limit = 5, options?: QueryOptions): VideoTask[] {
    const sql = `SELECT * FROM video_tasks WHERE username = ? ORDER BY created_at DESC LIMIT ?`;
    return this.query<VideoTask>(sql, [username, limit], options);
  }

  /**
   */
  getPendingTasks(options?: QueryOptions): VideoTask[] {
    const sql = `SELECT * FROM video_tasks WHERE status IN ('pending', 'running') ORDER BY created_at ASC`;
    return this.query<VideoTask>(sql, [], options);
  }


  /**
   */
  getResultsByTaskId(taskId: string, options?: QueryOptions): VideoResult[] {
    const sql = `SELECT * FROM video_results WHERE task_id = ? ORDER BY created_at ASC`;
    return this.query<VideoResult>(sql, [taskId], options);
  }

  /**
   */
  addResult(taskId: string, url: string, data?: { remove_watermark?: boolean; pid?: string; character_id?: string }, options?: QueryOptions): number {
    const sql = `
      INSERT INTO video_results (task_id, url, remove_watermark, pid, character_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = this.run(sql, [
      taskId,
      url,
      data?.remove_watermark || false,
      data?.pid || null,
      data?.character_id || null,
    ], options);
    return Number(result.lastInsertRowid);
  }

  /**
   */
  addResults(taskId: string, results: Array<{ url: string; remove_watermark?: boolean; pid?: string; character_id?: string }>, options?: QueryOptions): void {
    const db = this.getDb(options);
    const sql = `
      INSERT INTO video_results (task_id, url, remove_watermark, pid, character_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    const stmt = db.prepare(sql);
    
    const insertMany = db.transaction(() => {
      for (const r of results) {
        stmt.run(taskId, r.url, r.remove_watermark || false, r.pid || null, r.character_id || null);
      }
    });
    
    insertMany();
  }

  /**
   */
  deleteResultsByTaskId(taskId: string, options?: QueryOptions): number {
    const sql = `DELETE FROM video_results WHERE task_id = ?`;
    const result = this.run(sql, [taskId], options);
    return result.changes;
  }


  /**
   */
  listCharacters(username: string, options?: QueryOptions): Character[] {
    const sql = `SELECT * FROM characters WHERE username = ? ORDER BY created_at DESC`;
    return this.query<Character>(sql, [username], options);
  }

  /**
   */
  getCharacterById(characterId: string, username?: string, options?: QueryOptions): Character | null {
    const db = this.getDb(options);
    
    let sql = `SELECT * FROM characters WHERE character_id = ?`;
    const params: unknown[] = [characterId];
    
    if (username) {
      sql += " AND username = ?";
      params.push(username);
    }
    
    return db.prepare(sql).get(...params) as Character | null;
  }

  /**
   */
  createCharacter(data: CreateCharacterData, options?: QueryOptions): number {
    const sql = `
      INSERT INTO characters (username, character_id, name, source_task_id)
      VALUES (?, ?, ?, ?)
    `;
    const result = this.run(sql, [
      data.username,
      data.character_id,
      data.name || null,
      data.source_task_id || null,
    ], options);
    return Number(result.lastInsertRowid);
  }

  /**
   */
  updateCharacterName(characterId: string, name: string, options?: QueryOptions): boolean {
    const sql = `UPDATE characters SET name = ? WHERE character_id = ?`;
    const result = this.run(sql, [name, characterId], options);
    return result.changes > 0;
  }

  /**
   */
  deleteCharacter(characterId: string, username?: string, options?: QueryOptions): boolean {
    let sql = `DELETE FROM characters WHERE character_id = ?`;
    const params: unknown[] = [characterId];
    
    if (username) {
      sql += " AND username = ?";
      params.push(username);
    }
    
    const result = this.run(sql, params, options);
    return result.changes > 0;
  }


  /**
   */
  addActiveTask(taskId: string, prompt: string, options?: QueryOptions): boolean {
    const sql = `
      INSERT INTO studio_active_tasks (id, prompt, start_time)
      VALUES (?, ?, ?)
    `;
    const result = this.run(sql, [taskId, prompt, Math.floor(Date.now() / 1000)], options);
    return result.changes > 0;
  }

  /**
   */
  removeActiveTask(taskId: string, options?: QueryOptions): boolean {
    const sql = `DELETE FROM studio_active_tasks WHERE id = ?`;
    const result = this.run(sql, [taskId], options);
    return result.changes > 0;
  }

  /**
   */
  getActiveTasks(options?: QueryOptions): Array<{ id: string; prompt: string; start_time: number }> {
    const sql = `SELECT id, prompt, start_time FROM studio_active_tasks ORDER BY start_time DESC`;
    return this.query(sql, [], options);
  }


  /**
   */
  getConfig(options?: QueryOptions): StudioConfig {
    const db = this.getDb(options);
    const rows = db.prepare("SELECT key, value FROM studio_config").all() as Array<{ key: string; value: string }>;
    
    const cfg: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        cfg[row.key] = JSON.parse(row.value);
      } catch {
        cfg[row.key] = row.value;
      }
    }
    return cfg as StudioConfig;
  }

  /**
   */
  getConfigValue(key: keyof StudioConfig, options?: QueryOptions): unknown {
    const sql = `SELECT value FROM studio_config WHERE key = ?`;
    const result = this.queryOne<{ value: string }>(sql, [key], options);
    if (!result) return undefined;
    
    try {
      return JSON.parse(result.value);
    } catch {
      return result.value;
    }
  }

  /**
   */
  setConfigValue(key: keyof StudioConfig, value: unknown, options?: QueryOptions): boolean {
    const sql = `
      INSERT INTO studio_config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `;
    const result = this.run(sql, [key, JSON.stringify(value)], options);
    return result.changes > 0;
  }

  /**
   */
  deleteConfig(key: keyof StudioConfig, options?: QueryOptions): boolean {
    const sql = `DELETE FROM studio_config WHERE key = ?`;
    const result = this.run(sql, [key], options);
    return result.changes > 0;
  }


  /**
   */
  addHistory(data: {
    file?: string;
    prompt?: string;
    task_id?: string;
    pid?: string;
    url?: string;
    duration_seconds?: number;
  }, options?: QueryOptions): number {
    const sql = `
      INSERT INTO studio_history (file, prompt, time, task_id, pid, url, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = this.run(sql, [
      data.file || null,
      data.prompt || null,
      Math.floor(Date.now() / 1000),
      data.task_id || null,
      data.pid || null,
      data.url || null,
      data.duration_seconds ?? null,
    ], options);
    return Number(result.lastInsertRowid);
  }

  /**
   */
  getHistory(options?: QueryOptions): StudioHistory[] {
    const sql = `SELECT * FROM studio_history ORDER BY time DESC`;
    return this.query<StudioHistory>(sql, [], options);
  }

  /**
   */
  getHistoryByTaskId(taskId: string, options?: QueryOptions): StudioHistory | null {
    const sql = `SELECT * FROM studio_history WHERE task_id = ? ORDER BY time DESC LIMIT 1`;
    return this.queryOne<StudioHistory>(sql, [taskId], options);
  }

  /**
   */
  deleteHistory(id: number, options?: QueryOptions): boolean {
    const sql = `DELETE FROM studio_history WHERE id = ?`;
    const result = this.run(sql, [id], options);
    return result.changes > 0;
  }

  deleteHistoryByFile(file: string, options?: QueryOptions): boolean {
    const sql = `DELETE FROM studio_history WHERE file = ?`;
    const result = this.run(sql, [file], options);
    return result.changes > 0;
  }


  /**
   */
  recordTaskTime(taskId: string, timestamp?: number, options?: QueryOptions): boolean {
    const sql = `INSERT OR REPLACE INTO studio_task_times (task_id, ts) VALUES (?, ?)`;
    const result = this.run(sql, [taskId, timestamp || Math.floor(Date.now() / 1000)], options);
    return result.changes > 0;
  }

  /**
   */
  getTaskTime(taskId: string, options?: QueryOptions): number | null {
    const sql = `SELECT ts FROM studio_task_times WHERE task_id = ?`;
    const result = this.queryOne<{ ts: number }>(sql, [taskId], options);
    return result?.ts || null;
  }

  /**
   */
  deleteTaskTime(taskId: string, options?: QueryOptions): boolean {
    const sql = `DELETE FROM studio_task_times WHERE task_id = ?`;
    const result = this.run(sql, [taskId], options);
    return result.changes > 0;
  }


  /**
   */
  getUserStats(username: string, options?: QueryOptions): {
    total: number;
    pending: number;
    succeeded: number;
    failed: number;
  } {
    const db = this.getDb(options);
    
    const total = (db.prepare("SELECT COUNT(*) AS cnt FROM video_tasks WHERE username = ?").get(username) as { cnt: number })?.cnt || 0;
    const pending = (db.prepare("SELECT COUNT(*) AS cnt FROM video_tasks WHERE username = ? AND status IN ('pending', 'running')").get(username) as { cnt: number })?.cnt || 0;
    const succeeded = (db.prepare("SELECT COUNT(*) AS cnt FROM video_tasks WHERE username = ? AND status = 'succeeded'").get(username) as { cnt: number })?.cnt || 0;
    const failed = (db.prepare("SELECT COUNT(*) AS cnt FROM video_tasks WHERE username = ? AND status = 'failed'").get(username) as { cnt: number })?.cnt || 0;
    
    return { total, pending, succeeded, failed };
  }
}

export const videoTaskRepository = new VideoTaskRepository();
