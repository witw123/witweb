# Sora2 Web Studio

鍩轰簬 FastAPI 鐨勮交閲忕骇 Web 鎺у埗鍙帮紝鐢ㄤ簬璋冪敤 Sora2 瑙嗛鐢熸垚/瑙掕壊鐩稿叧鎺ュ彛锛屽苟鍦ㄦ湰鍦颁繚瀛樼敓鎴愮殑瑙嗛涓庡巻鍙茶褰曘€傚墠绔娇鐢?Vite 鏋勫缓锛屼骇鐗╃敱鍚庣鐩存帴鎵樼銆?

## 鐩綍缁撴瀯

```
.
鈹溾攢 backend/              # FastAPI 鍚庣
鈹? 鈹溾攢 main.py            # FastAPI 鏈嶅姟鍏ュ彛
鈹? 鈹溾攢 core.py            # 鏍稿績閫昏緫
鈹? 鈹溾攢 data/              # 閰嶇疆涓庡巻鍙叉暟鎹紙杩愯鍚庣敓鎴愶級
鈹? 鈹斺攢 downloads/         # 鐢熸垚鐨勮棰戯紙杩愯鍚庣敓鎴愶級
鈹溾攢 frontend/             # Vite 鍓嶇宸ョ▼
鈹? 鈹溾攢 index.html         # 鍓嶇婧愮爜鍏ュ彛
鈹? 鈹溾攢 src/
鈹? 鈹斺攢 dist/              # build 鍚庣敓鎴愶紙閮ㄧ讲浜х墿锛?
鈹溾攢 Dockerfile
鈹溾攢 docker-compose.yml
鈹斺攢 README.md
```

## 鐜瑕佹眰

- Python 3.8+
- Node.js 18+锛堢敤浜庡墠绔瀯寤猴級
- 渚濊禆锛歚fastapi`銆乣uvicorn`銆乣requests`銆乣pydantic`

瀹夎 Python 渚濊禆绀轰緥锛?

```bash
pip install fastapi uvicorn requests pydantic
```

## 鏈湴寮€鍙?

### 1) 鍚姩鍚庣

鍦ㄤ粨搴撴牴鐩綍鎵ц锛?

```bash
python backend/main.py
```

璁块棶鍦板潃锛?

```
http://localhost:8000
```

### 2) 杩愯/鏋勫缓鍓嶇

杩涘叆鍓嶇鐩綍锛?

```bash
cd frontend
```

寮€鍙戞ā寮忥細

```bash
npm install
npm run dev
```

鏋勫缓骞剁敱鍚庣鎻愪緵闈欐€佽祫婧愶細

```bash
npm install
npm run build
```

鍚庣浼氫粠 `frontend/dist` 鎻愪緵闈欐€佽祫婧愩€?

## 涓轰粈涔堟湁涓や釜 HTML 鏂囦欢

- `frontend/index.html`锛歏ite 鍓嶇婧愮爜鍏ュ彛锛屽紑鍙戝拰鏋勫缓鏃朵娇鐢ㄣ€?
- `frontend/dist/index.html`锛氭瀯寤轰骇鐗╋紝`npm run build` 鍚庣敓鎴愶紝鍚庣瀵瑰鎻愪緵鐨勯〉闈€?

璇峰彧缂栬緫 `frontend/index.html`锛屼笉瑕佹墜鏀?`frontend/dist/index.html`銆?

## 瀹瑰櫒鍖栭儴缃诧紙Docker锛?

鍓嶇蹇呴』鍏堟瀯寤哄嚭 `frontend/dist`锛孌ocker 閲屼笉璺?dev server銆?

### 鏋勫缓鍓嶇

```bash
cd frontend
npm install
npm run build
```

### 鏋勫缓闀滃儚

```bash
docker build -t sora2-web .
```

### 鍚姩瀹瑰櫒

```bash
docker run -d \
  --name sora2-web \
  -p 8000:8000 \
  -v ./backend/data:/app/backend/data \
  -v ./backend/downloads:/app/backend/downloads \
  --restart unless-stopped \
  sora2-web
```

### 浣跨敤 docker compose

```bash
docker compose up -d
```

甯哥敤杩愮淮鍛戒护锛?

```bash
docker ps

docker logs -f sora2-web

docker stop sora2-web

docker start sora2-web

docker restart sora2-web

docker rm -f sora2-web
```

## 閰嶇疆璇存槑

閰嶇疆瀛樺偍鍦?`backend/data/config.json`锛屽彲閫氳繃 API 鏇存柊锛?

- 璁剧疆 API Key锛堢敤浜庤姹?Sora2 API锛夛細

```
POST /config/api-key
{"api_key": "YOUR_API_KEY"}
```

- 璁剧疆 Token锛堢敤浜庨搴︾浉鍏虫帴鍙ｏ級锛?

```
POST /config/token
{"token": "YOUR_TOKEN"}
```

- 璁剧疆 Host 妯″紡锛?

```
POST /config/host-mode
{"host_mode": "auto|domestic|overseas"}
```

- 璁剧疆榛樿鏌ヨ鍙傛暟锛堜細鍚堝苟鍒扮幇鏈夐厤缃腑锛夛細

```
POST /config/query-defaults
{"data": {"aspectRatio": "16:9"}}
```

鏌ヨ褰撳墠閰嶇疆锛?

```
GET /config
```

## 甯哥敤鎺ュ彛

> 鎵€鏈夋帴鍙ｅ潎涓?JSON 鏍煎紡

### 鐢熸垚瑙嗛锛堝悓姝ワ級

```
POST /generate
{
  "prompt": "a cute cat",
  "duration": 15,
  "url": "https://... (鍙€?",
  "aspectRatio": "16:9",
  "size": "large",
  "remixTargetId": "... (鍙€?"
}
```

### 鐢熸垚瑙嗛锛堝紓姝ワ級

鍚姩浠诲姟锛?

```
POST /generate/start
{
  "prompt": "a cute cat",
  "duration": 15
}
```

瀹屾垚浠诲姟骞朵笅杞斤細

```
POST /generate/finalize
{
  "id": "TASK_ID",
  "prompt": "a cute cat"
}
```

鏌ヨ缁撴灉鐘舵€侊細

```
POST /result
{"id": "TASK_ID"}
```

### 瑙掕壊鐩稿叧

涓婁紶瑙掕壊锛?

```
POST /character/upload
{
  "url": "https://...",
  "timestamps": "0,3,6"
}
```

鍒涘缓瑙掕壊锛?

```
POST /character/create
{
  "pid": "PID",
  "timestamps": "0,3,6"
}
```

### OpenAPI 涓庨搴?

鍒涘缓 API Key锛?

```
POST /openapi/create-api-key
{
  "token": "YOUR_TOKEN",
  "type": 0,
  "name": "demo",
  "credits": 0,
  "expireTime": 0
}
```

鏌ヨ API Key 棰濆害锛?

```
POST /openapi/api-key-credits
{"apiKey": "YOUR_API_KEY"}
```

鏌ヨ璐︽埛棰濆害锛?

```
POST /openapi/credits
{"token": "YOUR_TOKEN"}
```

### 瑙嗛绠＄悊

鏈湴瑙嗛鍒楄〃锛?

```
GET /videos
```

鍒犻櫎鏈湴瑙嗛锛?

```
POST /videos/delete
{"name": "sora_123.mp4"}
```

## 鏁版嵁涓庝笅杞借鏄?

- 鐢熸垚鐨勮棰戦粯璁や繚瀛樺埌 `backend/downloads/`
- 鍘嗗彶璁板綍淇濆瓨鍒?`backend/data/history.json`
- 娲诲姩浠诲姟淇濆瓨鍒?`backend/data/active_tasks.json`

## 澶囨敞

- API 鎶ラ敊鎴栫綉缁滃紓甯镐細鍦ㄦ帴鍙ｈ繑鍥炰腑浣撶幇閿欒淇℃伅銆?
- 濡傞渶鍙樻洿 API 涓绘満锛屽彲閫氳繃 `host_mode` 閫夋嫨 `domestic` 鎴?`overseas`銆?


## API 閰嶇疆鑴氭湰

浣跨敤 `scripts/config_api.sh` 杩涜 API Key/Token/Host Mode 閰嶇疆锛堜氦浜掑紡锛夛細

```bash
chmod +x /opt/sora2_web/scripts/config_api.sh
/opt/sora2_web/scripts/config_api.sh
```

濡傛灉鏈嶅姟涓嶅湪鏈満锛屽彲浣跨敤 `SERVER_URL` 鎸囧畾锛?

```bash
SERVER_URL="http://<鏈嶅姟鍣↖P>:8000" /opt/sora2_web/scripts/config_api.sh
```

## 鏇存柊骞堕噸鍚紙鍗曟潯鍛戒护锛?

閫傜敤浜庨潪 Docker 閮ㄧ讲锛?

```bash
cd /opt/sora2_web && git pull && cd frontend && npm install && npm run build && (pkill -f "backend.main:app" || pkill -f "backend/main.py" || true) && cd /opt/sora2_web && nohup python3 -m uvicorn main:app --app-dir backend --host :: --port 8000 > /opt/sora2_web/server.log 2>&1 &
```
## License

鏈」鐩湭鎸囧畾 License銆?
