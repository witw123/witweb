lucide.createIcons();

// --- 状态控�?---
let pollTimer = null;
let currentTaskId = null;
let charMode = 'upload';
let creditsTimer = null;
let characterTaskId = null;
let characterTimer = null;
let activeTasks = [];
let currentCharBase64 = "";
let lastCharacterStatus = "";
let lastCharacterPayloadLogged = false;

const log = (msg) => {
  const el = document.getElementById("log");
  if (!el) {
    console.log(msg);
    return;
  }
  const time = new Date().toLocaleTimeString();
  el.textContent += `[${time}] ${msg}\n`;
  el.scrollTop = el.scrollHeight;
};

const val = (id) => document.getElementById(id).value.trim();

function saveToLocal() {
  const data = {
    hostMode: document.getElementById("hostMode").value,
    charMode: charMode,
    charUrl: document.getElementById("charUrl").value,
    charPid: document.getElementById("charPid").value,
    charTimestamps: document.getElementById("charTimestamps").value,
    charWebHook: document.getElementById("charWebHook").value,
    charShutProgress: document.getElementById("charShutProgress").value,
    characterRef: document.getElementById("characterRef").value,
    prompt: document.getElementById("prompt").value
  };
  localStorage.setItem("sora2_settings", JSON.stringify(data));
}

function loadFromLocal() {
  const raw = localStorage.getItem("sora2_settings");
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.hostMode) document.getElementById("hostMode").value = data.hostMode;
    updateHostBadge(data.hostMode || "auto");
    if (data.charMode) switchCharMode(data.charMode);
    if (data.charUrl !== undefined) document.getElementById("charUrl").value = data.charUrl;
    if (data.charPid !== undefined) document.getElementById("charPid").value = data.charPid;
    if (data.charTimestamps !== undefined) document.getElementById("charTimestamps").value = data.charTimestamps;
    if (data.charWebHook !== undefined) document.getElementById("charWebHook").value = data.charWebHook;
    if (data.charShutProgress !== undefined) document.getElementById("charShutProgress").value = data.charShutProgress;
    if (data.characterRef !== undefined) document.getElementById("characterRef").value = data.characterRef;
    if (data.prompt !== undefined) document.getElementById("prompt").value = data.prompt;
  } catch (e) {}
}

function updateHostBadge(mode) {
  const map = { auto: "自动", domestic: "国内", overseas: "海外" };
  const el = document.getElementById("hostBadge");
  if (el) el.textContent = map[mode] || "自动";
}

function formatCredits(val) {
  if (val === null || val === undefined) return "-";
  const n = Number(val);
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString("zh-CN");
}

function formatDuration(sec) {
  if (sec === null || sec === undefined) return "-";
  const s = Math.max(0, Number(sec));
  if (Number.isNaN(s)) return "-";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let recentCharacterRefs = [];

function parseCharacterRefs(input) {
  const raw = (input || "").replace(/[,��]/g, " ").trim();
  if (!raw) return [];
  const tokens = raw.split(/\s+/).filter(Boolean).map(t => t.replace(/^@/, ""));
  return Array.from(new Set(tokens));
}

function saveRecentRefsToLocal(list) {
  localStorage.setItem("sora2_recent_refs", JSON.stringify(list || []));
}

function loadRecentRefsFromLocal() {
  const raw = localStorage.getItem("sora2_recent_refs");
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function renderCharacterRefList() {
  const el = document.getElementById("characterRefList");
  if (!el) return;
  if (!recentCharacterRefs.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = recentCharacterRefs.map(ref => (
    `<span class="ref-chip" onclick="insertCharacterRefAtCursor('${ref}')">@${ref}<span class="ref-del" onclick="removeRecentRef(event, '${ref}')">×</span></span>`
  )).join("");
}

function insertCharacterRef(ref) {
  if (!ref) return;
  const current = parseCharacterRefs(val("characterRef"));
  if (current === null) return;
  if (!current.includes(ref)) current.push(ref);
  document.getElementById("characterRef").value = current.join(" ");
  saveToLocal();
}

function insertCharacterRefAtCursor(ref) {
  if (!ref) return;
  const promptEl = document.getElementById("prompt");
  if (!promptEl) return;
  const tag = `@${ref}`;
  const value = promptEl.value || "";
  const start = promptEl.selectionStart ?? value.length;
  const end = promptEl.selectionEnd ?? value.length;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const needsSpaceBefore = before && !before.endsWith(" ") ? " " : "";
  const needsSpaceAfter = after && !after.startsWith(" ") ? " " : "";
  promptEl.value = `${before}${needsSpaceBefore}${tag}${needsSpaceAfter}${after}`.trim();
  const cursor = (before + needsSpaceBefore + tag).length;
  promptEl.focus();
  promptEl.setSelectionRange(cursor, cursor);
  saveToLocal();
}

function removeRecentRef(event, ref) {
  if (event) event.stopPropagation();
  recentCharacterRefs = recentCharacterRefs.filter(r => r !== ref);
  renderCharacterRefList();
  saveRecentRefsToLocal(recentCharacterRefs);
  saveCharacterRefsToServer(recentCharacterRefs);
}

async function saveCharacterRefsToServer(list) {
  try {
    await fetch("/config/query-defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { character_refs: list } })
    });
  } catch (e) {}
}

function updateRecentRefs(newRefs) {
  if (!newRefs.length) return;
  const merged = [...newRefs, ...recentCharacterRefs.filter(r => !newRefs.includes(r))].slice(0, 8);
  recentCharacterRefs = merged;
  renderCharacterRefList();
  saveRecentRefsToLocal(merged);
  saveCharacterRefsToServer(merged);
}

// --- 功能函数 ---
function switchCharMode(mode) {
  charMode = mode;
  document.getElementById('charModeUpload').style.display = mode === 'upload' ? 'block' : 'none';
  document.getElementById('charModePid').style.display = mode === 'pid' ? 'block' : 'none';
  document.getElementById('tabUpload').style.background = mode === 'upload' ? 'var(--card)' : 'transparent';
  document.getElementById('tabPid').style.background = mode === 'pid' ? 'var(--card)' : 'transparent';
  saveToLocal();
}

function setCharacterStatus(status) {
  const el = document.getElementById("characterStatus");
  const map = { succeeded: "成功", failed: "失败", running: "处理�? };
  el.textContent = map[status] || "等待�?;
}

function setCharacterProgress(progress) {
  const el = document.getElementById("characterProgress");
  el.textContent = (progress === undefined || progress === null) ? "-" : `${progress}%`;
}

function setCharacterFailure(reason) {
  const el = document.getElementById("characterFailure");
  el.textContent = reason || "-";
}

function setCharacterId(value) {
  document.getElementById("characterId").textContent = value || "-";
}

function extractCharacterId(data) {
  if (!data || typeof data !== "object") return "";
  const direct = data.character_id || data.characterId;
  if (direct) return String(direct);
  const results = data.results;
  if (Array.isArray(results) && results.length) {
    return String(results[0].character_id || results[0].characterId || "");
  }
  if (results && typeof results === "object") {
    return String(results.character_id || results.characterId || "");
  }
  return "";
}

function parseShutProgress(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function executeCharAction() {
  if (charMode === "upload") {
    startUploadCharacter();
  } else {
    startCreateCharacter();
  }
}

function addCharacterRefFromInput() {
  const refs = parseCharacterRefs(val("characterRef"));
  if (refs === null) return;
  if (!refs.length) {
    log("提示：请输入角色 ID");
    return;
  }
  updateRecentRefs(refs);
  log(`已保存角�?ID�?{refs.map(r => `@${r}`).join(" ")}`);
}
\n
function renderActiveTasks() {
  const el = document.getElementById("activeTasks");
  if (!activeTasks.length) {
    el.innerHTML = '<div class="monitor-placeholder" style="font-size:11px">暂无任务</div>';
    return;
  }
  el.innerHTML = activeTasks.map(t => {
    const statusText = t.status || "排队�?;
    const elapsed = formatDuration(Math.floor((Date.now() - t.startTime) / 1000));
    return `<div class="active-item">
      <div class="active-title">${escapeHtml(t.prompt || "")}</div>
      <div class="active-meta">
        <span>状�? ${statusText}</span>
        <span>进度: ${t.progress || 0}%</span>
        <span>已用: ${elapsed}</span>
      </div>
      <div class="active-progress">
        <div class="active-bar"><div style="width:${t.progress || 0}%"></div></div>
        <div class="active-meta" style="margin-top:6px">
          <span>进度�?/span>
          <button class="btn btn-ghost" style="padding:2px 6px; font-size:10px" onclick="cancelActiveTask('${t.id}')">取消</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

function addActiveTask(taskId, prompt, startTime) {
  if (activeTasks.some(t => t.id === taskId)) return;
  activeTasks.push({
    id: taskId,
    prompt: prompt || "",
    startTime: startTime || Date.now(),
    status: "排队�?,
    progress: 0,
    finalizing: false
  });
  renderActiveTasks();
  startTaskPolling();
}

async function removeActiveTask(taskId) {
  activeTasks = activeTasks.filter(t => t.id !== taskId);
  renderActiveTasks();
  try {
    await fetch("/tasks/active/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId })
    });
  } catch (e) {}
}

function cancelActiveTask(taskId) {
  if (!taskId) return;
  removeActiveTask(taskId);
  log("已从队列移除任务（不影响后端实际执行�?);
}

async function refreshActiveTasks() {
  try {
    const res = await fetch("/tasks/active");
    const list = await res.json();
    if (Array.isArray(list)) {
      activeTasks = list.map(i => ({
        id: i.id,
        prompt: i.prompt || "",
        startTime: (i.start_time ? i.start_time * 1000 : Date.now()),
        status: "排队�?,
        progress: 0,
        finalizing: false
      }));
      renderActiveTasks();
      startTaskPolling();
    }
  } catch (e) {}
}

function startTaskPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollActiveTasks, 3000);
}

async function pollActiveTasks() {
  if (!activeTasks.length) {
    clearInterval(pollTimer);
    pollTimer = null;
    return;
  }
  await Promise.all(activeTasks.map(async (t) => {
    if (t.finalizing) return;
    try {
      const res = await fetch("/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id })
      });
      const data = await res.json();
      t.status = data.status || "running";
      t.progress = data.progress || 0;
      if (t.status === "succeeded") {
        t.finalizing = true;
        const finalize = await fetch("/generate/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: t.id, prompt: t.prompt })
        });
        await finalize.json();
        loadLocalVideos();
        getAccountCredits();
        removeActiveTask(t.id);
      } else if (t.status === "failed") {
        log("失败�? + (data.error || data.failure_reason || "未知异常"));
        removeActiveTask(t.id);
      }
    } catch (e) {}
  }));
  renderActiveTasks();
}

// 核心生成逻辑
async function gen() {
  const prompt = val("prompt");
  if (!prompt) { log("提示：提示词不能为空"); return; }
  
  const payload = {
    prompt,
    duration: parseInt(val("duration"), 10),
    aspectRatio: val("aspectRatio"),
    size: val("size"),
    url: document.getElementById("refImagePreview")?.src || ""
  };
  const refs = parseCharacterRefs(val("characterRef"));
  if (refs === null) return;
  if (refs.length) {
    const tags = refs
      .filter(r => !payload.prompt.includes(`@${r}`))
      .map(r => `@${r}`)
      .join(" ");
    if (tags) payload.prompt = `${tags} ${payload.prompt}`;
    updateRecentRefs(refs);
  }

  log("指令：开始提交渲染任�?..");
  
  try {
    const res = await fetch("/generate/start", {
      method: "POST", headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    currentTaskId = data.id;
    log(`系统：任务已创建 [ID: ${currentTaskId}]`);
    addActiveTask(currentTaskId, prompt, Date.now());
  } catch (e) { log("错误�? + e.message); }
}

async function pollResult() {}

async function startUploadCharacter() {
  const timestamps = val("charTimestamps") || "0,3";
  saveToLocal();

  const payload = {
    timestamps,
    webHook: val("charWebHook") || "-1"
  };
  const url = val("charUrl");
  if (url) {
    payload.url = url;
  } else if (currentCharBase64) {
    payload.url = currentCharBase64;
  } else {
    log("错误：请提供素材链接或选择本地视频");
    return;
  }
  const shut = parseShutProgress(val("charShutProgress"));
  if (shut !== null) payload.shutProgress = shut;

  setCharacterStatus("running");
  setCharacterProgress(0);
  setCharacterFailure("");
  setCharacterId("");

  const res = await fetch("/character/upload/start", {
    method: "POST", headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  characterTaskId = data.id;
  if (!characterTaskId) {
    log("错误：角色任务创建失�?);
    return;
  }
  if (characterTimer) clearInterval(characterTimer);
  characterTimer = setInterval(pollCharacterStatus, 3000);
}

async function startCreateCharacter() {
  const pid = val("charPid");
  const timestamps = val("charTimestamps") || "0,3";
  if (!pid) { log("错误：请输入 PID"); return; }
  saveToLocal();

  const payload = {
    pid,
    timestamps,
    webHook: val("charWebHook") || "-1"
  };
  const shut = parseShutProgress(val("charShutProgress"));
  if (shut !== null) payload.shutProgress = shut;

  setCharacterStatus("running");
  setCharacterProgress(0);
  setCharacterFailure("");
  setCharacterId("");

  const res = await fetch("/character/create/start", {
    method: "POST", headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  characterTaskId = data.id;
  if (!characterTaskId) {
    log("错误：角色任务创建失�?);
    return;
  }
  if (characterTimer) clearInterval(characterTimer);
  characterTimer = setInterval(pollCharacterStatus, 3000);
}

async function pollCharacterStatus() {
  if (!characterTaskId) return;
  const res = await fetch("/result", {
    method: "POST", headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: characterTaskId })
  });
  const data = await res.json();
  const status = data.status || "running";
  const progress = data.progress || 0;
  const characterId = extractCharacterId(data);
  const failure = data.failure_reason || data.error || "";

  setCharacterStatus(status);
  setCharacterProgress(progress);
  setCharacterFailure(failure);
  if (characterId) setCharacterId(characterId);
  if (status !== lastCharacterStatus) {
    log(`角色任务状�? ${status} (${progress}%)`);
    lastCharacterStatus = status;
  }
  if (status === "succeeded" && !lastCharacterPayloadLogged) {
    log(`角色任务完成响应: ${JSON.stringify(data)}`);
    lastCharacterPayloadLogged = true;
  }
  if (status === "succeeded" && !characterId) {
    log("警告：任务成功但未返回角�?ID");
  }

  if (status === "succeeded" || status === "failed") {
    clearInterval(characterTimer);
    characterTimer = null;
    lastCharacterPayloadLogged = false;
  }
}

function copyCharacterId() {
  const id = document.getElementById("characterId").textContent.trim();
  if (!id || id === "-") return;
  navigator.clipboard.writeText(id);
  log("角色 ID 已复�?);
}

// 视频库预�?
async function loadLocalVideos() {
  try {
    const res = await fetch("/videos");
    const list = await res.json();
    const grid = document.getElementById("localVideoList");
    grid.innerHTML = list.reverse().map(v => `
      <div class="video-card">
        <video class="video-thumb" src="${v.url}" muted onmouseover="this.play()" onmouseout="this.pause()"></video>
        <div class="v-title" style="font-size:12px; font-weight:bold; margin-bottom:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${v.name}</div>
        <div class="v-meta">
          <span>${(v.size / 1024 / 1024).toFixed(1)}MB</span>
          <span>${formatTime(v.generated_time)}</span>
          <span>${formatDuration(v.duration_seconds)}</span>
          <span>悬停预览</span>
        </div>
        <div class="v-prompt" title="${escapeHtml(v.prompt || "")}">${escapeHtml(v.prompt || "")}</div>
        <div class="btn-row" style="margin-top:8px">
          <a class="btn btn-ghost" style="padding:2px 6px; font-size:10px; text-decoration:none" href="${v.url}" target="_blank">打开</a>
          <a class="btn btn-ghost" style="padding:2px 6px; font-size:10px; text-decoration:none" href="${v.url}" download>下载</a>
          <button class="btn btn-ghost" style="padding:2px 6px; font-size:10px" onclick="deleteVideo('${v.name}')">删除</button>
        </div>
      </div>
    `).join('');
  } catch(e) {}
}

function formatTime(ts) {
  if (!ts) return "-";
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function formatDuration(sec) {
  if (sec === null || sec === undefined) return "-";
  const s = Math.max(0, Number(sec));
  if (Number.isNaN(s)) return "-";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function clearRefImage() {
  const input = document.getElementById("refImageFile");
  if (input) input.value = "";
  const wrap = document.getElementById("refImagePreviewWrap");
  const img = document.getElementById("refImagePreview");
  if (img) img.src = "";
  if (wrap) wrap.style.display = "none";
}

function clearCharVideo() {
  const input = document.getElementById("charFile");
  if (input) input.value = "";
  currentCharBase64 = "";
  const wrap = document.getElementById("charVideoPreviewWrap");
  const video = document.getElementById("charVideoPreview");
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
  if (wrap) wrap.style.display = "none";
}

async function deleteVideo(name) {
  if (!name) return;
  const ok = confirm("确认删除该视频吗�?);
  if (!ok) return;
  await fetch("/videos/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name })
  });
  loadLocalVideos();
}

// 图片处理
document.getElementById("refImageFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      const wrap = document.getElementById("refImagePreviewWrap");
      const img = document.getElementById("refImagePreview");
      if (img) img.src = reader.result;
      if (wrap) wrap.style.display = "block";
      log("系统：本地参考图已加�?);
    };
    reader.readAsDataURL(file);
  } else {
    const wrap = document.getElementById("refImagePreviewWrap");
    const img = document.getElementById("refImagePreview");
    if (img) img.src = "";
    if (wrap) wrap.style.display = "none";
  }
});

document.getElementById("charFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) {
    currentCharBase64 = "";
    const wrap = document.getElementById("charVideoPreviewWrap");
    const video = document.getElementById("charVideoPreview");
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    if (wrap) wrap.style.display = "none";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    currentCharBase64 = reader.result;
    const wrap = document.getElementById("charVideoPreviewWrap");
    const video = document.getElementById("charVideoPreview");
    if (video) {
      video.src = reader.result;
      video.load();
    }
    if (wrap) wrap.style.display = "block";
    log("系统：本地角色视频已加载");
  };
  reader.readAsDataURL(file);
});

// 初始化与基础配置
async function setHostMode() {
  const host_mode = val("hostMode");
  saveToLocal();
  await fetch("/config/host-mode", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host_mode }) });
  updateHostBadge(host_mode);
  log(`系统：节点切换至 ${host_mode}`);
}

async function getAccountCredits() {
  const el = document.getElementById("accountCredits");
  el.textContent = "查询�?..";
  el.className = "credit-empty";
  try {
    const res = await fetch("/credits");
    const data = await res.json();
    if (data.error) {
      el.textContent = data.error === "missing token" ? "未配�? : "错误";
      el.className = "credit-empty";
      return;
    }
    const val = data.credits ?? null;
    el.textContent = formatCredits(val);
    if (val === null) el.className = "credit-empty";
    else if (Number(val) <= 0) el.className = "credit-low";
    else el.className = "credit-ok";
  } catch (e) {
    el.textContent = "错误";
    el.className = "credit-low";
  }
}

window.onload = () => {
  loadFromLocal();
  recentCharacterRefs = loadRecentRefsFromLocal();
  renderCharacterRefList();
  loadLocalVideos();
  getAccountCredits();
  refreshActiveTasks();
  log("系统：日志已启动");
  const addBtn = document.getElementById("addCharacterRefBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      addCharacterRefFromInput();
    });
  }
  fetch("/config").then(r => r.json()).then(j => {
      if (j.host_mode) document.getElementById("hostMode").value = j.host_mode;
      if (j.host_mode) updateHostBadge(j.host_mode);
      const refs = j.query_defaults && Array.isArray(j.query_defaults.character_refs)
        ? j.query_defaults.character_refs
        : [];
      const merged = [...recentCharacterRefs, ...refs.filter(r => !recentCharacterRefs.includes(r))].slice(0, 8);
      recentCharacterRefs = merged;
      renderCharacterRefList();
      saveRecentRefsToLocal(merged);
      getAccountCredits();
    });
  setInterval(getAccountCredits, 30000);
};

document.getElementById("hostMode").addEventListener("change", () => {
  saveToLocal();
  updateHostBadge(val("hostMode"));
  setHostMode();
});
document.getElementById("charUrl").addEventListener("change", saveToLocal);
document.getElementById("charPid").addEventListener("change", saveToLocal);
document.getElementById("charTimestamps").addEventListener("change", saveToLocal);
document.getElementById("charWebHook").addEventListener("change", saveToLocal);
document.getElementById("charShutProgress").addEventListener("change", saveToLocal);
document.getElementById("prompt").addEventListener("input", saveToLocal);
document.getElementById("characterRef").addEventListener("change", () => {
  const refs = parseCharacterRefs(val("characterRef"));
  if (refs === null) return;
  saveToLocal();
  updateRecentRefs(refs);
});

lucide.createIcons();



