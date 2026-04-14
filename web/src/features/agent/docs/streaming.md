# 流式响应协议

Agent 功能使用 NDJSON (Newline-Delimited JSON) 实现实时流式响应。

## 端点

- `POST /api/v1/agent/conversations/[id]/messages/stream`
- `POST /api/v1/agent/goals/[id]/execute/stream`

## 请求格式

```json
{
  "content": "用户消息内容",
  "task_type": "hot_topic_article",
  "attachments": [
    { "id": "att_...", "name": "file.pdf", "mime_type": "application/pdf", "url": "...", "size": 1024, "kind": "document" }
  ]
}
```

## 响应格式

Content-Type: `application/x-ndjson; charset=utf-8`

每行是一个独立的 JSON 对象，以换行符分隔。

### 消息流事件

#### Phase 事件 - 思考阶段

```json
{ "type": "phase", "key": "intent", "title": "识别用户意图", "status": "pending" }
{ "type": "phase", "key": "intent", "title": "识别用户意图", "status": "running" }
{ "type": "phase", "key": "intent", "title": "识别用户意图", "status": "done" }
```

阶段类型：
- `intent` - 意图识别
- `memory` - 记忆提取
- `search` - 知识检索
- `compose` - 内容生成
- `goal` - 目标执行

#### Delta 事件 - 文本增量

```json
{ "type": "delta", "message_id": "msg_...", "chunk": "这是一段" }
{ "type": "delta", "message_id": "msg_...", "chunk": "增量文本" }
```

#### Done 事件 - 完成响应

```json
{
  "type": "done",
  "conversation": {
    "conversation": { "id": "conv_...", "title": "...", "status": "active", ... },
    "user_message": { "id": "msg_...", "role": "user", "content": "...", ... },
    "assistant_message": { "id": "msg_...", "role": "assistant", "content": "...", ... },
    "reply_meta": { "rag_strategy": "...", "knowledge_hit_count": 3, ... },
    "goals": [...]
  }
}
```

#### Error 事件 - 错误

```json
{ "type": "error", "message": "错误描述" }
```

### 目标执行事件

#### Goal Status 事件

```json
{ "type": "goal_status", "event": { "goal_id": "...", "status": "running", ... } }
```

#### Tool Start 事件

```json
{ "type": "tool_start", "event": { "step_key": "radar_scan", "tool_name": "radar.fetch_and_analyze", "status": "running" } }
```

#### Tool Result 事件

```json
{ "type": "tool_result", "event": { "step_key": "radar_scan", "result": { ... } } }
```

#### Artifact 事件

```json
{ "type": "artifact", "event": { "artifact_kind": "title", "artifact_preview": "文章标题预览" } }
```

artifact_kind 类型：
- `title` - 标题
- `content` - 正文
- `cover_prompt` - 封面提示词
- `video_prompt` - 视频脚本

## 客户端实现

### 解析流

```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const payload = JSON.parse(trimmed);

    switch (payload.type) {
      case "phase":
        handlePhase(payload);
        break;
      case "delta":
        handleDelta(payload);
        break;
      case "done":
        handleDone(payload);
        break;
      case "error":
        handleError(payload);
        break;
    }
  }

  if (done) break;
}
```

### 中断请求

```typescript
const controller = new AbortController();
fetch(url, { signal: controller.signal });

// 取消请求
controller.abort();
```

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 网络中断 | 显示重试按钮，保留已接收内容 |
| 服务器错误 | 显示错误卡片，可重试 |
| AbortError | 静默处理，保留已接收内容 |
| JSON 解析错误 | 跳过该行，继续处理 |

## 性能建议

1. **避免频繁更新 UI**：使用 `requestAnimationFrame` 批量处理 delta
2. **限制缓存大小**：长对话按需加载历史消息
3. **使用乐观更新**：先显示本地状态，再与服务器同步
