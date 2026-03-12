/**
 * 视频任务核心仓储
 *
 * 提供视频生成任务的完整数据操作：
 * - 任务的创建、状态更新、删除
 * - 任务查询与列表
 * - 任务结果管理
 * - 用户统计数据
 */

import { randomUUID } from "crypto";
import { pgQuery, pgQueryOne, pgRun, withPgTransaction } from "@/lib/postgres-query";
import type { VideoResult, VideoTask, VideoTaskType } from "@/types";
import type { PaginatedResult } from "./types";
import { normalizeVideoPagination } from "./video-task-repository.shared";
import type { CreateVideoTaskData, UpdateVideoTaskData } from "./video-task-repository.types";

/**
 * 视频任务核心数据访问类
 *
 * 提供视频任务和结果的全部 CRUD 操作
 */
export class VideoTaskCoreRepository {
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
    const fields: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [];
    if (data.status !== undefined) { fields.push("status = ?"); params.push(data.status); }
    if (data.progress !== undefined) { fields.push("progress = ?"); params.push(data.progress); }
    if (data.result_json !== undefined) { fields.push("result_json = ?"); params.push(data.result_json); }
    if (data.failure_reason !== undefined) { fields.push("failure_reason = ?"); params.push(data.failure_reason); }
    if (data.error !== undefined) { fields.push("error = ?"); params.push(data.error); }
    params.push(id);
    return (await pgRun(`UPDATE video_tasks SET ${fields.join(", ")} WHERE id = ?`, params)).changes > 0;
  }

  async deleteById(id: string, username?: string): Promise<boolean> {
    return await withPgTransaction(async (client) => {
      if (username) {
        const task = await pgQueryOne<VideoTask>("SELECT * FROM video_tasks WHERE id = ? AND username = ?", [id, username], client);
        if (!task) return false;
      }
      await pgRun("DELETE FROM video_results WHERE task_id = ?", [id], client);
      return (await pgRun("DELETE FROM video_tasks WHERE id = ?", [id], client)).changes > 0;
    });
  }

  async listByUser(username: string, page = 1, size = 20, taskType?: VideoTaskType): Promise<PaginatedResult<VideoTask>> {
    const { page: validPage, size: validSize, offset } = normalizeVideoPagination(page, size);
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
      for (const result of results) {
        await pgRun(
          "INSERT INTO video_results (task_id, url, remove_watermark, pid, character_id) VALUES (?, ?, ?, ?, ?)",
          [taskId, result.url, result.remove_watermark || false, result.pid || null, result.character_id || null],
          client
        );
      }
    });
  }

  async deleteResultsByTaskId(taskId: string): Promise<number> {
    return (await pgRun("DELETE FROM video_results WHERE task_id = ?", [taskId])).changes;
  }

  async getUserStats(username: string): Promise<{ total: number; pending: number; succeeded: number; failed: number }> {
    const total = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM video_tasks WHERE username = ?", [username]))?.cnt || 0;
    const pending = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM video_tasks WHERE username = ? AND status IN ('pending', 'running')", [username]))?.cnt || 0;
    const succeeded = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM video_tasks WHERE username = ? AND status = 'succeeded'", [username]))?.cnt || 0;
    const failed = (await pgQueryOne<{ cnt: number }>("SELECT COUNT(*)::int AS cnt FROM video_tasks WHERE username = ? AND status = 'failed'", [username]))?.cnt || 0;
    return { total, pending, succeeded, failed };
  }
}
