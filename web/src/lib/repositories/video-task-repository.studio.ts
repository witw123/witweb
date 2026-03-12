/**
 * 视频任务 Studio 仓储
 *
 * 提供视频 Studio 相关的辅助数据操作：
 * - 角色（Character）管理
 * - Studio 配置管理
 * - 生成历史记录
 * - 活跃任务跟踪
 */

import { pgQuery, pgQueryOne, pgRun } from "@/lib/postgres-query";
import type { Character, StudioConfig, StudioHistory } from "@/types";
import type { CreateCharacterData } from "./video-task-repository.types";

/**
 * 视频 Studio 数据访问类
 *
 * 提供角色管理、配置、历史记录等辅助功能
 */
export class VideoTaskStudioRepository {
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
    return (await pgRun("INSERT INTO studio_active_tasks (id, prompt, start_time) VALUES (?, ?, ?)", [taskId, prompt, Math.floor(Date.now() / 1000)])).changes > 0;
  }

  async removeActiveTask(taskId: string): Promise<boolean> {
    return (await pgRun("DELETE FROM studio_active_tasks WHERE id = ?", [taskId])).changes > 0;
  }

  async getActiveTasks(): Promise<Array<{ id: string; prompt: string; start_time: number }>> {
    return await pgQuery("SELECT id, prompt, start_time FROM studio_active_tasks ORDER BY start_time DESC");
  }

  async getConfig(): Promise<StudioConfig> {
    const rows = await pgQuery<Array<{ key: string; value: string }> extends (infer Row)[] ? Row : never>("SELECT key, value FROM studio_config");
    const config: Record<string, unknown> = {};
    for (const row of rows as Array<{ key: string; value: string }>) {
      try {
        config[row.key] = JSON.parse(row.value);
      } catch {
        config[row.key] = row.value;
      }
    }
    return config as StudioConfig;
  }

  async getConfigValue(key: keyof StudioConfig): Promise<unknown> {
    const result = await pgQueryOne<{ value: string }>("SELECT value FROM studio_config WHERE key = ?", [key]);
    if (!result) return undefined;
    try {
      return JSON.parse(result.value);
    } catch {
      return result.value;
    }
  }

  async setConfigValue(key: keyof StudioConfig, value: unknown): Promise<boolean> {
    return (
      await pgRun(
        `INSERT INTO studio_config (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, JSON.stringify(value)]
      )
    ).changes > 0;
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
    return (
      await pgRun(
        `INSERT INTO studio_task_times (task_id, ts) VALUES (?, ?)
         ON CONFLICT(task_id) DO UPDATE SET ts = excluded.ts`,
        [taskId, timestamp || Math.floor(Date.now() / 1000)]
      )
    ).changes > 0;
  }

  async getTaskTime(taskId: string): Promise<number | null> {
    return (await pgQueryOne<{ ts: number }>("SELECT ts FROM studio_task_times WHERE task_id = ?", [taskId]))?.ts || null;
  }

  async deleteTaskTime(taskId: string): Promise<boolean> {
    return (await pgRun("DELETE FROM studio_task_times WHERE task_id = ?", [taskId])).changes > 0;
  }
}
