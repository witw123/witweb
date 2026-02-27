import path from "path";
import fs from "fs";
import { videoTaskRepository } from "./repositories";
import { apiConfig } from "./config";
import { maskSensitiveValue } from "./security";

const HOSTS = {
  overseas: apiConfig.grsai.overseasUrl,
  domestic: apiConfig.grsai.domesticUrl,
};

const CREATE_API = "/v1/video/sora-video";
const UPLOAD_CHARACTER_API = "/v1/video/sora-upload-character";
const CREATE_CHARACTER_API = "/v1/video/sora-create-character";
const RESULT_API = "/v1/draw/result";

const baseDir = path.resolve(process.cwd(), "..");
const downloadDir = path.join(baseDir, "downloads");

function ensureDirs() {
  fs.mkdirSync(downloadDir, { recursive: true });
}

type StudioConfig = {
  api_key?: string;
  token?: string;
  host_mode?: string;
  query_defaults?: Record<string, unknown>;
};

type ResultEnvelope<T> = {
  code?: number;
  msg?: string;
  data?: T;
};

type TaskIdPayload = { id?: string };

type ResultItem = {
  url: string;
  pid?: string;
};

type RemoteTaskResult = {
  status?: string;
  progress?: number;
  error?: string;
  failure_reason?: string;
  results?: ResultItem[];
};

type HistoryRow = {
  file?: string | null;
  prompt?: string | null;
  time?: number;
  id?: string | null;
  pid?: string | null;
  url?: string | null;
  duration_seconds?: number | null;
};

export function getConfig(): StudioConfig {
  const cfg = videoTaskRepository.getConfig() as StudioConfig;
  if (!cfg.query_defaults || typeof cfg.query_defaults !== "object") {
    cfg.query_defaults = {};
  }
  return cfg;
}

function setConfigValue(key: string, value: unknown) {
  videoTaskRepository.setConfigValue(key as keyof StudioConfig, value);
}

export function setApiKey(api_key: string) {
  console.warn("[DEPRECATED] Storing API keys in database is deprecated. Use SORA2_API_KEY or GRSAI_TOKEN environment variable instead.");
  setConfigValue("api_key", api_key);
}

export function setToken(token: string) {
  console.warn("[DEPRECATED] Storing tokens in database is deprecated. Use GRSAI_TOKEN environment variable instead.");
  setConfigValue("token", token);
}

export function getApiStatus() {
  const apiKey = getApiKey();
  return {
    configured: !!apiKey,
    apiKeyPreview: apiKey ? maskSensitiveValue(apiKey, 4, 4) : null,
    hostMode: getHostMode(),
    hosts: HOSTS,
  };
}

export function setHostMode(host_mode: string) {
  setConfigValue("host_mode", host_mode);
}

export function setQueryDefaults(data: Record<string, unknown>) {
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

function getApiKey(): string | undefined {
  const envKey = apiConfig.sora2.apiKey || apiConfig.grsai.token;
  if (envKey) {
    return envKey;
  }

  const cfg = getConfig();
  return cfg.api_key || cfg.token;
}

async function postJson(pathname: string, payload: unknown, headers: Record<string, string> = {}) {
  const apiKey = getApiKey();
  const authHeader = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

  if (!apiKey && typeof window === "undefined") {
    console.warn("[API WARNING] No API key configured. Set SORA2_API_KEY or GRSAI_TOKEN environment variable.");
  }
  let lastErr: unknown = null;
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
        const data = (await res.json()) as ResultEnvelope<unknown>;
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

function extractData<T>(resp: unknown): T {
  if (resp && typeof resp === "object" && "data" in resp) {
    return (resp as ResultEnvelope<T>).data as T;
  }
  return resp as T;
}

function saveTaskTime(taskId: string, ts: number) {
  videoTaskRepository.recordTaskTime(taskId, ts);
}

function getTaskTime(taskId: string) {
  return videoTaskRepository.getTaskTime(taskId) || undefined;
}

function deleteTaskTime(taskId: string) {
  videoTaskRepository.deleteTaskTime(taskId);
}

export async function createVideoTask(payload: unknown) {
  const data = extractData<TaskIdPayload>(await postJson(CREATE_API, payload));
  const taskId = data?.id;
  if (!taskId) throw new Error("Missing task id");
  saveTaskTime(taskId, Math.floor(Date.now() / 1000));
  return taskId;
}

export async function getResult(taskId: string) {
  return extractData<RemoteTaskResult>(await postJson(RESULT_API, { id: taskId }));
}

export function removeActiveTask(taskId: string) {
  videoTaskRepository.removeActiveTask(taskId);
}

export function getActiveTasks() {
  return videoTaskRepository.getActiveTasks();
}

function download(url: string, target: string) {
  return fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(target, buf);
  });
}

function saveHistory(file: string, prompt: string, taskId?: string, pid?: string, url?: string, durationSeconds?: number | null) {
  videoTaskRepository.addHistory({
    file,
    prompt,
    task_id: taskId,
    pid,
    url,
    duration_seconds: durationSeconds ?? undefined,
  });
}

export async function finalizeVideo(taskId: string, prompt: string) {
  const history = videoTaskRepository.getHistoryByTaskId(taskId) as
    | { file?: string; url?: string; pid?: string }
    | null;
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

export async function uploadCharacterTask(payload: unknown) {
  const data = extractData<TaskIdPayload>(await postJson(UPLOAD_CHARACTER_API, payload));
  const taskId = data?.id;
  if (!taskId) throw new Error("Missing task id");
  return taskId;
}

export async function createCharacterTask(payload: unknown) {
  const data = extractData<TaskIdPayload>(await postJson(CREATE_CHARACTER_API, payload));
  const taskId = data?.id;
  if (!taskId) throw new Error("Missing task id");
  return taskId;
}

export function getHistory() {
  return videoTaskRepository.getHistory().map((item) => ({
    file: item.file,
    prompt: item.prompt,
    time: item.time,
    id: item.task_id,
    pid: item.pid,
    url: item.url,
    duration_seconds: item.duration_seconds,
  }));
}

export function getLocalVideos() {
  ensureDirs();
  if (!fs.existsSync(downloadDir)) return [];
  const names = fs.readdirSync(downloadDir).filter((n) => n.toLowerCase().endsWith(".mp4"));
  const history = getHistory() as HistoryRow[];
  const map = new Map<string, HistoryRow>();
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
  videoTaskRepository.deleteHistoryByFile(file);
}
