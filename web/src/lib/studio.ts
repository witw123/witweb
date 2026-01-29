import fs from "fs";
import path from "path";

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
const dataDir = path.join(baseDir, "data");
const downloadDir = path.join(baseDir, "downloads");

const configFile = path.join(dataDir, "config.json");
const historyFile = path.join(dataDir, "history.json");
const taskTimesFile = path.join(dataDir, "task_times.json");
const activeTasksFile = path.join(dataDir, "active_tasks.json");

function ensureDirs() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(downloadDir, { recursive: true });
}

function loadJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function saveJson(file: string, data: any) {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function getConfig() {
  return loadJson(configFile, {});
}

export function setApiKey(api_key: string) {
  const cfg = getConfig();
  cfg.api_key = api_key;
  saveJson(configFile, cfg);
}

export function setToken(token: string) {
  const cfg = getConfig();
  cfg.token = token;
  saveJson(configFile, cfg);
}

export function setHostMode(host_mode: string) {
  const cfg = getConfig();
  cfg.host_mode = host_mode;
  saveJson(configFile, cfg);
}

export function setQueryDefaults(data: Record<string, any>) {
  const cfg = getConfig();
  const current = typeof cfg.query_defaults === "object" && cfg.query_defaults ? cfg.query_defaults : {};
  cfg.query_defaults = { ...current, ...data };
  saveJson(configFile, cfg);
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
  const authHeader = cfg.api_key ? { Authorization: `Bearer ${cfg.api_key}` } : {};
  let lastErr: any = null;
  for (const host of iterHosts()) {
    for (let i = 0; i < 3; i += 1) {
      try {
        const res = await fetch(host + pathname, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader, ...headers },
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
  const authHeader = cfg.api_key ? { Authorization: `Bearer ${cfg.api_key}` } : {};
  const qs = new URLSearchParams(params as any).toString();
  let lastErr: any = null;
  for (const host of iterHosts()) {
    for (let i = 0; i < 3; i += 1) {
      try {
        const res = await fetch(host + pathname + (qs ? `?${qs}` : ""), {
          headers: { ...authHeader },
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

export async function createVideoTask(payload: any) {
  const data = extractData(await postJson(CREATE_API, payload));
  const taskId = data?.id;
  if (!taskId) throw new Error("Missing task id");
  const taskTimes = loadJson(taskTimesFile, {} as Record<string, number>);
  taskTimes[taskId] = Math.floor(Date.now() / 1000);
  saveJson(taskTimesFile, taskTimes);
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
  const items = loadJson(activeTasksFile, [] as any[]);
  if (!items.some((i) => i.id === taskId)) {
    items.push({ id: taskId, prompt, start_time: Math.floor(Date.now() / 1000) });
    saveJson(activeTasksFile, items);
  }
}

export function removeActiveTask(taskId: string) {
  const items = loadJson(activeTasksFile, [] as any[]).filter((i: any) => i.id !== taskId);
  saveJson(activeTasksFile, items);
}

export function getActiveTasks() {
  return loadJson(activeTasksFile, [] as any[]);
}

function download(url: string, target: string) {
  return fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(target, buf);
  });
}

function saveHistory(file: string, prompt: string, taskId?: string, pid?: string, url?: string, durationSeconds?: number | null) {
  const history = loadJson(historyFile, [] as any[]);
  history.push({
    file,
    prompt,
    time: Math.floor(Date.now() / 1000),
    id: taskId,
    pid,
    url,
    duration_seconds: durationSeconds ?? null,
  });
  saveJson(historyFile, history);
}

export async function finalizeVideo(taskId: string, prompt: string) {
  const history = loadJson(historyFile, [] as any[]);
  for (const item of history) {
    if (item.id === taskId && item.file && fs.existsSync(item.file)) {
      return { id: taskId, file: item.file, url: item.url, pid: item.pid };
    }
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
  await download(videoUrl, filename);
  const taskTimes = loadJson(taskTimesFile, {} as Record<string, number>);
  const startTs = taskTimes[taskId];
  delete taskTimes[taskId];
  saveJson(taskTimesFile, taskTimes);
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
  return loadJson(historyFile, [] as any[]);
}

export function getLocalVideos() {
  if (!fs.existsSync(downloadDir)) return [];
  const names = fs.readdirSync(downloadDir).filter((n) => n.toLowerCase().endsWith('.mp4'));
  const history = loadJson(historyFile, [] as any[]);
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
  const history = loadJson(historyFile, [] as any[]).filter((h: any) => path.basename(h.file || "") !== name);
  saveJson(historyFile, history);
}
