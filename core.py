import time, os, json, requests

HOSTS = {
    "overseas": "https://grsaiapi.com",
    "domestic": "https://grsai.dakka.com.cn",
}

CREATE_API = "/v1/video/sora-video"
UPLOAD_CHARACTER_API = "/v1/video/sora-upload-character"
CREATE_CHARACTER_API = "/v1/video/sora-create-character"
RESULT_API = "/v1/draw/result"
OPENAPI_CREATE_KEY = "/client/openapi/createAPIKey"
OPENAPI_APIKEY_CREDITS = "/client/openapi/getAPIKeyCredits"
OPENAPI_CREDITS = "/client/openapi/getCredits"
MODEL_STATUS = "/client/common/getModelStatus"

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
DOWNLOAD_DIR = os.path.join(BASE_DIR, "downloads")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
TASK_TIMES_FILE = os.path.join(DATA_DIR, "task_times.json")
ACTIVE_TASKS_FILE = os.path.join(DATA_DIR, "active_tasks.json")

session = requests.Session()
session.trust_env = False


def _load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return default


def _save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _load_config():
    return _load_json(CONFIG_FILE, {})


def _apply_config(cfg):
    session.headers.update({"Content-Type": "application/json"})
    api_key = cfg.get("api_key")
    if api_key:
        session.headers.update({"Authorization": f"Bearer {api_key}"})
    elif "Authorization" in session.headers:
        del session.headers["Authorization"]


def _load_task_times():
    return _load_json(TASK_TIMES_FILE, {})


def _save_task_times(data):
    _save_json(TASK_TIMES_FILE, data)


def _load_active_tasks():
    return _load_json(ACTIVE_TASKS_FILE, [])


def _save_active_tasks(items):
    _save_json(ACTIVE_TASKS_FILE, items)


def set_api_key(key: str):
    cfg = _load_config()
    cfg["api_key"] = key
    _save_json(CONFIG_FILE, cfg)
    _apply_config(cfg)

def set_token(token: str):
    cfg = _load_config()
    cfg["token"] = token
    _save_json(CONFIG_FILE, cfg)

def set_query_defaults(data: dict):
    cfg = _load_config()
    current = cfg.get("query_defaults", {})
    if not isinstance(current, dict):
        current = {}
    if not isinstance(data, dict):
        data = {}
    current.update(data)
    cfg["query_defaults"] = current
    _save_json(CONFIG_FILE, cfg)


def set_host_mode(mode: str):
    mode = mode.strip().lower()
    if mode not in ("auto", "domestic", "overseas"):
        raise ValueError("Invalid host_mode")
    cfg = _load_config()
    cfg["host_mode"] = mode
    _save_json(CONFIG_FILE, cfg)
    return mode


def _get_host_mode():
    cfg = _load_config()
    return cfg.get("host_mode", "auto")


def _iter_hosts():
    mode = _get_host_mode()
    if mode == "domestic":
        return [HOSTS["domestic"]]
    if mode == "overseas":
        return [HOSTS["overseas"]]
    return [HOSTS["domestic"], HOSTS["overseas"]]


def _post_json(path, payload):
    last_err = None
    for host in _iter_hosts():
        for _ in range(3):
            try:
                r = session.post(host + path, json=payload, timeout=30)
                r.raise_for_status()
                data = r.json()
                if isinstance(data, dict) and data.get("code") not in (None, 0):
                    raise RuntimeError(data.get("msg") or "API error")
                return data
            except requests.exceptions.ConnectionError as e:
                last_err = e
                time.sleep(2)
            except requests.exceptions.RequestException as e:
                last_err = e
                break
    raise RuntimeError("Network error") from last_err


def _get_json(path, params=None):
    last_err = None
    for host in _iter_hosts():
        for _ in range(3):
            try:
                r = session.get(host + path, params=params, timeout=30)
                r.raise_for_status()
                data = r.json()
                if isinstance(data, dict) and data.get("code") not in (None, 0):
                    raise RuntimeError(data.get("msg") or "API error")
                return data
            except requests.exceptions.ConnectionError as e:
                last_err = e
                time.sleep(2)
            except requests.exceptions.RequestException as e:
                last_err = e
                break
    raise RuntimeError("Network error") from last_err


def _extract_data(resp):
    if isinstance(resp, dict) and "data" in resp:
        return resp["data"]
    return resp


def _submit_task(path, payload):
    data = _extract_data(_post_json(path, payload))
    task_id = data.get("id") if isinstance(data, dict) else None
    if not task_id:
        raise RuntimeError("Missing task id")
    return task_id


def _poll_result(task_id, interval=10):
    while True:
        time.sleep(interval)
        result = _extract_data(_post_json(RESULT_API, {"id": task_id}))
        status = result.get("status")
        if status == "succeeded":
            return result
        if status == "failed":
            raise RuntimeError(
                result.get("error")
                or result.get("failure_reason")
                or "Task failed"
            )


def _build_video_payload(
    prompt,
    duration,
    url=None,
    aspectRatio=None,
    size=None,
    remixTargetId=None,
    webHook="-1",
    shutProgress=None,
):
    payload = {
        "model": "sora-2",
        "prompt": prompt,
        "duration": duration,
        "webHook": webHook,
    }
    if url:
        payload["url"] = url
    if aspectRatio:
        payload["aspectRatio"] = aspectRatio
    if size:
        payload["size"] = size
    if remixTargetId:
        payload["remixTargetId"] = remixTargetId
    if shutProgress is not None:
        payload["shutProgress"] = bool(shutProgress)
    return payload


def create_video_task(
    prompt: str,
    duration=10,
    url=None,
    aspectRatio=None,
    size=None,
    remixTargetId=None,
    webHook="-1",
    shutProgress=None,
):
    payload = _build_video_payload(
        prompt,
        duration,
        url=url,
        aspectRatio=aspectRatio,
        size=size,
        remixTargetId=remixTargetId,
        webHook=webHook,
        shutProgress=shutProgress,
    )
    task_id = _submit_task(CREATE_API, payload)
    task_times = _load_task_times()
    task_times[task_id] = int(time.time())
    _save_task_times(task_times)
    return task_id


def add_active_task(task_id: str, prompt: str):
    items = _load_active_tasks()
    for item in items:
        if item.get("id") == task_id:
            return
    items.append({
        "id": task_id,
        "prompt": prompt,
        "start_time": int(time.time()),
    })
    _save_active_tasks(items)


def remove_active_task(task_id: str):
    items = _load_active_tasks()
    items = [i for i in items if i.get("id") != task_id]
    _save_active_tasks(items)


def get_active_tasks():
    return _load_active_tasks()


def generate_video(
    prompt: str,
    duration=10,
    url=None,
    aspectRatio=None,
    size=None,
    remixTargetId=None,
    webHook="-1",
    shutProgress=None,
):
    start_ts = int(time.time())
    task_id = create_video_task(
        prompt=prompt,
        duration=duration,
        url=url,
        aspectRatio=aspectRatio,
        size=size,
        remixTargetId=remixTargetId,
        webHook=webHook,
        shutProgress=shutProgress,
    )
    result = _poll_result(task_id)

    results = result.get("results") or []
    if not results or not results[0].get("url"):
        raise RuntimeError("Empty results")

    video_url = results[0].get("url")
    pid = results[0].get("pid")

    filename = os.path.join(
        DOWNLOAD_DIR,
        f"sora_{int(time.time())}.mp4",
    )

    _download(video_url, filename)
    duration_seconds = max(0, int(time.time()) - start_ts)
    _save_history(filename, prompt, task_id, pid, url=video_url, duration_seconds=duration_seconds)
    remove_active_task(task_id)

    return {
        "id": task_id,
        "file": filename,
        "url": video_url,
        "pid": pid,
    }


def finalize_video(task_id: str, prompt: str):
    history = _load_json(HISTORY_FILE, [])
    for item in history:
        if item.get("id") == task_id and item.get("file"):
            if os.path.exists(item.get("file")):
                return {
                    "id": task_id,
                    "file": item.get("file"),
                    "url": item.get("url"),
                    "pid": item.get("pid"),
                }
    result = get_result(task_id)
    status = result.get("status")
    if status != "succeeded":
        return {
            "id": task_id,
            "status": status,
            "progress": result.get("progress", 0),
            "error": result.get("error") or result.get("failure_reason"),
        }

    results = result.get("results") or []
    if not results or not results[0].get("url"):
        raise RuntimeError("Empty results")

    video_url = results[0].get("url")
    pid = results[0].get("pid")

    filename = os.path.join(
        DOWNLOAD_DIR,
        f"sora_{int(time.time())}.mp4",
    )

    _download(video_url, filename)
    task_times = _load_task_times()
    start_ts = task_times.pop(task_id, None)
    _save_task_times(task_times)
    remove_active_task(task_id)
    duration_seconds = None
    if start_ts is not None:
        duration_seconds = max(0, int(time.time()) - int(start_ts))
    _save_history(filename, prompt, task_id, pid, url=video_url, duration_seconds=duration_seconds)

    return {
        "id": task_id,
        "file": filename,
        "url": video_url,
        "pid": pid,
    }


def upload_character(url: str, timestamps: str, webHook="-1", shutProgress=None):
    payload = {
        "timestamps": timestamps,
        "webHook": webHook,
    }
    if url:
        payload["url"] = url
    if shutProgress is not None:
        payload["shutProgress"] = bool(shutProgress)
    task_id = _submit_task(UPLOAD_CHARACTER_API, payload)
    return _poll_result(task_id)


def upload_character_task(url: str, timestamps: str, webHook="-1", shutProgress=None):
    payload = {
        "timestamps": timestamps,
        "webHook": webHook,
    }
    if url:
        payload["url"] = url
    if shutProgress is not None:
        payload["shutProgress"] = bool(shutProgress)
    return _submit_task(UPLOAD_CHARACTER_API, payload)


def create_character(pid: str, timestamps: str, webHook="-1", shutProgress=None):
    payload = {
        "pid": pid,
        "timestamps": timestamps,
        "webHook": webHook,
    }
    if shutProgress is not None:
        payload["shutProgress"] = bool(shutProgress)
    task_id = _submit_task(CREATE_CHARACTER_API, payload)
    return _poll_result(task_id)


def create_character_task(pid: str, timestamps: str, webHook="-1", shutProgress=None):
    payload = {
        "pid": pid,
        "timestamps": timestamps,
        "webHook": webHook,
    }
    if shutProgress is not None:
        payload["shutProgress"] = bool(shutProgress)
    return _submit_task(CREATE_CHARACTER_API, payload)


def get_result(task_id: str):
    return _extract_data(_post_json(RESULT_API, {"id": task_id}))


def create_api_key(token: str, type=0, name="", credits=0, expireTime=0):
    payload = {
        "token": token,
        "type": type,
        "name": name or "",
        "credits": credits or 0,
        "expireTime": expireTime or 0,
    }
    return _extract_data(_post_json(OPENAPI_CREATE_KEY, payload))


def get_api_key_credits(apiKey: str):
    return _extract_data(_post_json(OPENAPI_APIKEY_CREDITS, {"apiKey": apiKey}))


def get_credits(token: str):
    token = (token or "").strip()
    if not token:
        raise ValueError("missing token")
    return _extract_data(_post_json(OPENAPI_CREDITS, {"token": token}))


def get_saved_token():
    cfg = _load_config()
    return (cfg.get("token", "") or "").strip()


def get_model_status(model: str):
    return _extract_data(_get_json(MODEL_STATUS, {"model": model}))


def _download(url, path):
    r = session.get(url, stream=True)
    r.raise_for_status()
    with open(path, "wb") as f:
        for c in r.iter_content(1024 * 1024):
            f.write(c)


def _save_history(file, prompt, task_id=None, pid=None, url=None, duration_seconds=None):
    history = _load_json(HISTORY_FILE, [])
    history.append(
        {
            "file": file,
            "prompt": prompt,
            "time": int(time.time()),
            "id": task_id,
            "pid": pid,
            "url": url,
            "duration_seconds": duration_seconds,
        }
    )
    _save_json(HISTORY_FILE, history)


def get_history():
    return _load_json(HISTORY_FILE, [])

def get_local_videos():
    items = []
    if not os.path.isdir(DOWNLOAD_DIR):
        return items
    for name in os.listdir(DOWNLOAD_DIR):
        if not name.lower().endswith(".mp4"):
            continue
        path = os.path.join(DOWNLOAD_DIR, name)
        try:
            st = os.stat(path)
        except OSError:
            continue
        items.append({
            "name": name,
            "size": st.st_size,
            "mtime": int(st.st_mtime),
            "url": f"/downloads/{name}",
        })
    history = _load_json(HISTORY_FILE, [])
    history_map = {}
    for h in history:
        if "file" in h:
            history_map[h["file"]] = h
            history_map[os.path.basename(h["file"])] = h
    for item in items:
        h = history_map.get(item["name"])
        if not h:
            h = history_map.get(os.path.join(DOWNLOAD_DIR, item["name"]))
        if h:
            item["generated_time"] = h.get("time")
            item["duration_seconds"] = h.get("duration_seconds")
            item["prompt"] = h.get("prompt")
        else:
            item["generated_time"] = item["mtime"]
            item["duration_seconds"] = None
            item["prompt"] = ""
    items.sort(key=lambda x: x["mtime"], reverse=True)
    return items


def delete_video(name: str):
    name = (name or "").strip()
    if not name:
        raise ValueError("missing name")
    if os.path.basename(name) != name:
        raise ValueError("invalid name")
    path = os.path.join(DOWNLOAD_DIR, name)
    if not os.path.exists(path):
        raise FileNotFoundError("file not found")
    os.remove(path)
    history = _load_json(HISTORY_FILE, [])
    history = [h for h in history if os.path.basename(h.get("file", "")) != name]
    _save_json(HISTORY_FILE, history)


_apply_config(_load_config())


def get_config():
    cfg = _load_config()
    return {
        "api_key": cfg.get("api_key", ""),
        "host_mode": cfg.get("host_mode", "auto"),
        "query_defaults": cfg.get("query_defaults", {}),
    }
