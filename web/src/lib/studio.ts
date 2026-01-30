import path from "path";
import fs from "fs";
import { getStudioDb } from "./db";

const HOSTS = {
  overseas: "https://grsaiapi.com",
  domestic: "https://grsai.dakka.com.cn",
};

const CREATE_API = "/v1/video/sora-video";
const UPLOAD_CHARACTER_API = "/v1/video/sora-upload-character";
const CREATE_CHARACTER_API = "/v1/video/sora-create-character";
const RESULT_API = "/v1/draw/result";
const OPENAPI_CREATE_KEY = "/client/openapi/createAPIKey";
const OPENAPI_APIKEY_CREDITS = "/client/openapi/getAPIKeyCredits";
const OPENAPI_CREDITS = "/client/openapi/getCredits";
const MODEL_STATUS = "/client/common/getModelStatus";

const baseDir = path.resolve(process.cwd(), "..");
const downloadDir = path.join(baseDir, "downloads");

function ensureDirs() {
  fs.mkdirSync(downloadDir, { recursive: true });
}

type StudioConfig = {
  api_key?: string;
  token?: string;
  host_mode?: string;
  query_defaults?: Record<string, any>;
};

function getConfigRows() {
  const db = getStudioDb();
  return db.prepare("SELECT key, value FROM studio_config").all() as any[];
}

export function getConfig(): StudioConfig {
  const rows = getConfigRows();
  const cfg: StudioConfig = {};
  rows.forEach((row) => {
    try {
      cfg[row.key as keyof StudioConfig] = JSON.parse(row.value);
    } catch {
      cfg[row.key as keyof StudioConfig] = row.value;
    }
  });
  return cfg;
}

function setConfigValue(key: string, value: any) {
  const db = getStudioDb();
  const payload = JSON.stringify(value);
  db.prepare("INSERT INTO studio_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, payload);
}

export function setApiKey(api_key: string) {
  setConfigValue("api_key", api_key);
}

export function setToken(token: string) {
  setConfigValue("token", token);
}

export function setHostMode(host_mode: string) {
  setConfigValue("host_mode", host_mode);
}

export function setQueryDefaults(data: Record<string, any>) {
  const cfg = getConfig();
  const current = typeof cfg.query_defaults === "object" && cfg.query_defaults ? cfg.query_defaults : {};
  setConfigValue("query_defaults", { ...current, ...data });
}

function getHostMode() {
  const cfg = getConfig();
  return cfg.host_mode || "auto";
}

function iterHosts() {
  const mode = getHostMode();
  if (mode === "domestic") return [HOSTS.domestic];
  if (mode === "overseas") return [HOSTS.overseas];
  return [HOSTS.domestic, HOSTS.overseas];
}

async function postJson(pathname: string, payload: any, headers: Record<string, string> = {}) {
  const cfg = getConfig();
  const authHeader = cfg.api_key ? { Authorization: `Bearer ${cfg.api_key}` } : undefined;
  let lastErr: any = null;
  for (const host of iterHosts()) {
    for (let i = 0; i < 3; i += 1) {
      try {
        const requestHeaders: HeadersInit = { "Content-Type": "application/json", ...(authHeader || {}), ...headers };
        const res = await fetch(host + pathname, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && typeof data === "object" && data.code && data.code !== 0) {
          throw new Error(data.msg || "API error");
        }
        return data;
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr || new Error("Network error");
}

async function getJson(pathname: string, params: Record<string, any>) {
  const cfg = getConfig();
  const authHeader = cfg.api_key ? { Authorization: `Bearer ${cfg.api_key}` } : undefined;
  const qs = new URLSearchParams(params as any).toString();
  let lastErr: any = null;
  for (const host of iterHosts()) {
    for (let i = 0; i < 3; i += 1) {
      try {
        const requestHeaders: HeadersInit = authHeader ? { ...authHeader } : {};
        const res = await fetch(host + pathname + (qs ? `?${qs}` : ""), {
          headers: requestHeaders,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && typeof data === "object" && data.code && data.code !== 0) {
          throw new Error(data.msg || "API error");
        }
        return data;
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr || new Error("Network error");
}

function extractData(resp: any) {
  if (resp && typeof resp === "object" && "data" in resp) return resp.data;
  return resp;
}

function saveTaskTime(taskId: string, ts: number) {
  const db = getStudioDb();
  db.prepare("INSERT OR REPLACE INTO studio_task_times (task_id, ts) VALUES (?, ?)").run(taskId, ts);
}

function getTaskTime(taskId: string) {
  const db = getStudioDb();
  const row = db.prepare("SELECT ts FROM studio_task_times WHERE task_id = ?").get(taskId) as any;
  return row?.ts as number | undefined;
}

function deleteTaskTime(taskId: string) {
  const db = getStudioDb();
  db.prepare("DELETE FROM studio_task_times WHERE task_id = ?").run(taskId);
}

export async function createVideoTask(payload: any) {
  const data = extractData(await postJson(CREATE_API, payload));
  const taskId = data?.id;
  if (!taskId) throw new Error("Missing task id");
  saveTaskTime(taskId, Math.floor(Date.now() / 1000));
  return taskId;
}

export async function getResult(taskId: string) {
  return extractData(await postJson(RESULT_API, { id: taskId }));
}

export async function pollResult(taskId: string) {
  while (true) {
    await new Promise((r) => setTimeout(r, 10000));
    const result = await getResult(taskId);
    const status = result?.status;
    if (status === "succeeded") return result;
    if (status === "failed") throw new Error(result?.error || result?.failure_reason || "Task failed");
  }
}

export function addActiveTask(taskId: string, prompt: string) {
  const db = getStudioDb();
  db.prepare("INSERT OR IGNORE INTO studio_active_tasks (id, prompt, start_time) VALUES (?, ?, ?)")
    .run(taskId, prompt, Math.floor(Date.now() / 1000));
}

export function removeActiveTask(taskId: string) {
  const db = getStudioDb();
  db.prepare("DELETE FROM studio_active_tasks WHERE id = ?").run(taskId);
}

export function getActiveTasks() {
  const db = getStudioDb();
  return db.prepare("SELECT id, prompt, start_time FROM studio_active_tasks ORDER BY start_time DESC").all();
}

function download(url: string, target: string) {
  return fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(target, buf);
  });
}

function saveHistory(file: string, prompt: string, taskId?: string, pid?: string, url?: string, durationSeconds?: number | null) {
  const db = getStudioDb();
  db.prepare("INSERT INTO studio_history (file, prompt, time, task_id, pid, url, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(file, prompt, Math.floor(Date.now() / 1000), taskId || null, pid || null, url || null, durationSeconds ?? null);
}

export async function finalizeVideo(taskId: string, prompt: string) {
  const db = getStudioDb();
  const history = db.prepare("SELECT file, url, pid FROM studio_history WHERE task_id = ? ORDER BY time DESC").get(taskId) as any;
  if (history?.file && fs.existsSync(history.file)) {
    return { id: taskId, file: history.file, url: history.url, pid: history.pid };
  }
  const result = await getResult(taskId);
  if (result.status !== "succeeded") {
    return { id: taskId, status: result.status, progress: result.progress || 0, error: result.error || result.failure_reason };
  }
  const results = result.results || [];
  if (!results[0]?.url) throw new Error("Empty results");
  const videoUrl = results[0].url;
  const pid = results[0].pid;
  const filename = path.join(downloadDir, `sora_${Date.now()}.mp4`);
  ensureDirs();
  await download(videoUrl, filename);
  const startTs = getTaskTime(taskId);
  deleteTaskTime(taskId);
  removeActiveTask(taskId);
  const duration = startTs ? Math.max(0, Math.floor(Date.now() / 1000) - startTs) : null;
  saveHistory(filename, prompt, taskId, pid, videoUrl, duration);
  return { id: taskId, file: filename, url: videoUrl, pid };
}

export async function generateVideo(payload: any) {
  const start = Math.floor(Date.now() / 1000);
  const taskId = await createVideoTask(payload);
  const result = await pollResult(taskId);
  const results = result.results || [];
  if (!results[0]?.url) throw new Error("Empty results");
  const videoUrl = results[0].url;
  const pid = results[0].pid;
  const filename = path.join(downloadDir, `sora_${Date.now()}.mp4`);
  ensureDirs();
  await download(videoUrl, filename);
  const duration = Math.max(0, Math.floor(Date.now() / 1000) - start);
  saveHistory(filename, payload.prompt, taskId, pid, videoUrl, duration);
  removeActiveTask(taskId);
  return { id: taskId, file: filename, url: videoUrl, pid };
}

export async function uploadCharacterTask(payload: any) {
  const data = extractData(await postJson(UPLOAD_CHARACTER_API, payload));
  const taskId = data?.id;
  if (!taskId) throw new Error("Missing task id");
  return taskId;
}

export async function uploadCharacter(payload: any) {
  const taskId = await uploadCharacterTask(payload);
  return await pollResult(taskId);
}

export async function createCharacterTask(payload: any) {
  const data = extractData(await postJson(CREATE_CHARACTER_API, payload));
  const taskId = data?.id;
  if (!taskId) throw new Error("Missing task id");
  return taskId;
}

export async function createCharacter(payload: any) {
  const taskId = await createCharacterTask(payload);
  return await pollResult(taskId);
}

export async function createApiKey(payload: any) {
  return extractData(await postJson(OPENAPI_CREATE_KEY, payload));
}

export async function getApiKeyCredits(apiKey: string) {
  return extractData(await postJson(OPENAPI_APIKEY_CREDITS, { apiKey }));
}

export async function getCredits(token: string) {
  if (!token) throw new Error("missing token");
  return extractData(await postJson(OPENAPI_CREDITS, { token }));
}

export async function getModelStatus(model: string) {
  return extractData(await getJson(MODEL_STATUS, { model }));
}

export function getHistory() {
  const db = getStudioDb();
  return db.prepare("SELECT file, prompt, time, task_id as id, pid, url, duration_seconds FROM studio_history ORDER BY time DESC").all();
}

export function getLocalVideos() {
  ensureDirs();
  if (!fs.existsSync(downloadDir)) return [];
  const names = fs.readdirSync(downloadDir).filter((n) => n.toLowerCase().endsWith('.mp4'));
  const history = getHistory() as any[];
  const map = new Map<string, any>();
  history.forEach((h) => {
    if (h.file) map.set(h.file, h);
    map.set(path.basename(h.file || ""), h);
  });
  const items = names.map((name) => {
    const full = path.join(downloadDir, name);
    const st = fs.statSync(full);
    const h = map.get(name) || map.get(full);
    return {
      name,
      size: st.size,
      mtime: Math.floor(st.mtimeMs / 1000),
      url: `/downloads/${name}`,
      generated_time: h?.time || Math.floor(st.mtimeMs / 1000),
      duration_seconds: h?.duration_seconds ?? null,
      prompt: h?.prompt || "",
    };
  });
  return items.sort((a, b) => b.mtime - a.mtime);
}

export function deleteVideo(name: string) {
  const base = path.basename(name || "");
  if (base !== name) throw new Error("invalid name");
  const file = path.join(downloadDir, name);
  if (!fs.existsSync(file)) throw new Error("file not found");
  fs.unlinkSync(file);
  const db = getStudioDb();
  db.prepare("DELETE FROM studio_history WHERE file = ?").run(file);
}
