import { getDb } from "./db";
import { getResult } from "./studio";
import crypto from "crypto";

export function createTask(username: string, taskType: string, params: any, taskId?: string) {
  const db = getDb();
  const id = taskId || crypto.randomUUID();
  db.prepare(`
    INSERT INTO video_tasks (
      id, username, task_type, status, progress,
      prompt, model, url, aspect_ratio, duration,
      remix_target_id, size, pid, timestamps
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    username,
    taskType,
    "pending",
    0,
    params.prompt || null,
    params.model || null,
    params.url || null,
    params.aspect_ratio || null,
    params.duration || null,
    params.remix_target_id || null,
    params.size || null,
    params.pid || null,
    params.timestamps || null
  );
  return id;
}

export function updateTaskStatus(taskId: string, status: string, progress?: number, resultJson?: string, failureReason?: string, error?: string) {
  const db = getDb();
  const fields = ["status = ?", "updated_at = datetime('now', 'localtime')"];
  const params: any[] = [status];
  if (progress !== undefined) { fields.push("progress = ?"); params.push(progress); }
  if (resultJson !== undefined) { fields.push("result_json = ?"); params.push(resultJson); }
  if (failureReason !== undefined) { fields.push("failure_reason = ?"); params.push(failureReason); }
  if (error !== undefined) { fields.push("error = ?"); params.push(error); }
  params.push(taskId);
  db.prepare(`UPDATE video_tasks SET ${fields.join(", ")} WHERE id = ?`).run(...params);
}

export function saveResults(taskId: string, results: any[]) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO video_results (task_id, url, remove_watermark, pid, character_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const r of results) {
    stmt.run(taskId, r.url, r.removeWatermark || false, r.pid, r.character_id || null);
  }
}

export function getTask(taskId: string, username?: string) {
  const db = getDb();
  const row = username
    ? db.prepare("SELECT * FROM video_tasks WHERE id = ? AND username = ?").get(taskId, username)
    : db.prepare("SELECT * FROM video_tasks WHERE id = ?").get(taskId);
  if (!row) return null;
  const results = db.prepare("SELECT * FROM video_results WHERE task_id = ?").all(taskId);
  return { ...row, results };
}

export function listTasks(username: string, page = 1, limit = 20, taskType?: string) {
  const db = getDb();
  const offset = (page - 1) * limit;
  let where = "WHERE username = ?";
  const params: any[] = [username];
  if (taskType) { where += " AND task_type = ?"; params.push(taskType); }
  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM video_tasks ${where}`).get(...params) as any)?.cnt || 0;
  const tasks = db.prepare(`SELECT * FROM video_tasks ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  return { tasks, total, page, limit };
}

export async function pollAndUpdate(taskId: string) {
  const result = await getResult(taskId);
  const status = result?.status || "running";
  const progress = result?.progress || 0;
  updateTaskStatus(taskId, status, progress, JSON.stringify(result), result?.failure_reason, result?.error);
  if (status === "succeeded" && result?.results) {
    saveResults(taskId, result.results);
  }
  return result;
}

export function listCharacters(username: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM characters WHERE username = ? ORDER BY created_at DESC").all(username);
}

export function saveCharacter(username: string, characterId: string, name?: string, sourceTaskId?: string) {
  const db = getDb();
  db.prepare("INSERT INTO characters (username, character_id, name, source_task_id) VALUES (?, ?, ?, ?)")
    .run(username, characterId, name || null, sourceTaskId || null);
}
