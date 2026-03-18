# AI Agent 详细优化实施方案

## 1. 文档定位

本文件基于 `agent_optimization_plan.md` 的摘要方案，结合当前仓库真实代码结构，输出一份可执行、可拆分、可验收的详细优化方案。

本次优化的核心目标：

- 将 Agent 能力彻底收口到 `/agent` 会话式工作流。
- 迁移并移除旧版 `runs` 架构，避免双轨维护。
- 提升 `ThinkPanel` 的可解释性和执行可视化能力。
- 为 `ChatInput` 增加附件输入能力，支撑图片和文档分析。
- 优化记忆注入、工具扩展和流式协议，让 Agent 更稳定、更透明。

本次优化的非目标：

- 不重写整个 `Studio` 系统。
- 不在第一阶段引入高风险的通用 `code_execution`。
- 不对 Blog、Video、Radar 各自业务做脱离 Agent 范围的大改。

---

## 2. 当前代码基线

### 2.1 当前在线主链路

当前主 Agent 体验已经落在新链路上，核心路径如下：

- 页面入口：`web/src/app/agent/page.tsx`
- 页面布局：`web/src/app/agent/layout.tsx`
- 会话布局：`web/src/features/agent/components/AgentChatLayout.tsx`
- 左侧导航与历史：`web/src/features/agent/components/ChatSidebar.tsx`
- 会话承接：`web/src/features/agent/components/ChatThreadWrapper.tsx`
- 主线程与思考面板：`web/src/features/agent/components/ChatThread.tsx`
- 输入框：`web/src/features/agent/components/ChatInput.tsx`

对应后端主能力：

- 会话域：`web/src/lib/agent-conversations.ts`
- 目标规划与执行域：`web/src/lib/agent-goals.ts`
- 工具注册与执行：`web/src/lib/agent-tools.ts`
- 记忆提取与注入：`web/src/lib/agent-memory.ts`

对应 API：

- `web/src/app/api/v1/agent/conversations/route.ts`
- `web/src/app/api/v1/agent/conversations/[id]/route.ts`
- `web/src/app/api/v1/agent/conversations/[id]/messages/route.ts`
- `web/src/app/api/v1/agent/conversations/[id]/messages/stream/route.ts`
- `web/src/app/api/v1/agent/goals/route.ts`
- `web/src/app/api/v1/agent/goals/[id]/timeline/route.ts`
- `web/src/app/api/v1/agent/goals/[id]/execute/route.ts`
- `web/src/app/api/v1/agent/goals/[id]/execute/stream/route.ts`
- `web/src/app/api/v1/agent/approvals/[id]/approve/route.ts`
- `web/src/app/api/v1/agent/approvals/[id]/reject/route.ts`

### 2.2 当前遗留链路

旧版 `runs` 架构仍完整保留在仓库中：

- 旧 UI：
  - `web/src/components/studio/modules/agent/AgentCreate.tsx`
  - `web/src/components/studio/modules/agent/AgentTaskList.tsx`
  - `web/src/components/studio/modules/agent/AgentGallery.tsx`
- 旧 hooks：
  - `web/src/components/studio/modules/agent/hooks/useCreateAgentRun.ts`
  - `web/src/components/studio/modules/agent/hooks/useContinueAgentRun.ts`
  - `web/src/components/studio/modules/agent/hooks/useAgentRunDetail.ts`
- 旧后端：
  - `web/src/lib/agent.ts`
  - `web/src/app/api/v1/agent/runs/route.ts`
  - `web/src/app/api/v1/agent/runs/stream/route.ts`
  - `web/src/app/api/v1/agent/runs/[id]/route.ts`
  - `web/src/app/api/v1/agent/runs/[id]/continue/route.ts`
  - `web/src/app/api/v1/agent/runs/[id]/export-to-publish/route.ts`

### 2.3 已确认的关键事实

- `/agent` 主入口已经使用新链路，旧版 `AgentCreate` 和 `AgentTaskList` 目前更像遗留资产，不是主入口。
- `/agent/gallery` 仍直接依赖 `/api/v1/agent/runs`，这是删除旧链路前最大的阻塞点。
- 新会话流接口只发送 `phase`、`delta`、`done`、`error` 事件，信息颗粒度明显不足。
- 旧 `runs/stream` 反而已经有 `artifact` 事件，说明“中间/结果事件化”在仓库里不是全新概念。
- `ChatInput` 目前只支持文本发送，不支持附件。
- 当前上传链路 `web/src/app/api/upload/shared.ts` 只支持图片，且 `/api/upload` 已标记为 deprecated。
- 记忆模块已经存在，但策略仍偏硬编码：
  - 最近消息窗口：`slice(-12)`
  - 用户长期记忆读取上限：`listUserMemories(username, 8)`
  - 没有明确的召回阈值、摘要刷新节奏、上下文预算和裁剪策略。
- 查询键和测试仍保留旧概念：
  - `web/src/lib/query-keys.ts` 中仍有 `agentRuns`、`agentRunDetail`
  - `web/src/__tests__/api/agent/run.route.test.ts`
  - `web/src/__tests__/api/agent/runs-id.route.test.ts`

---

## 3. 关键问题与实施顺序调整

原始摘要方案将“先清理旧链路”放在第一阶段，但结合当前代码，实际不能直接照做。

原因很明确：

- `AgentGallery` 仍依赖 `runs`
- `/agent/gallery` 是真实路由入口
- 删除 `runs` 后会立即造成功能回归

因此，详细执行顺序需要调整为：

1. 先把 Gallery 从 `runs` 迁移到 `goals/conversations`
2. 再清理旧 UI、旧 hooks、旧 API 和旧测试
3. 随后增强流式协议和 `ThinkPanel`
4. 再做附件输入
5. 最后做记忆治理和工具扩展

这比原始摘要版更贴近当前仓库依赖关系。

---

## 4. 优化目标架构

### 4.1 产品层目标

优化完成后，Agent 相关体验应收口为三层：

- 主工作区：`/agent`
  - 负责连续对话、任务规划、工具执行、审批和结果追踪
- 轻量子页面：`/agent/gallery`、`/agent/knowledge`、`/agent/assistants`、`/agent/prompts`
  - 只承载辅助管理，不再成为主要创作入口
- 会话内能力
  - 文本输入
  - 附件输入
  - 实时思考与执行可视化
  - 审批与结果沉淀

### 4.2 数据层目标

后端应收口为以下单一事实来源：

- 会话事实：`agent_conversations` + `agent_messages`
- 任务事实：`agent_goals` + `goal steps` + `approvals` + `deliveries`
- 记忆事实：`agent_conversation_memory` + `agent_user_memory`
- 工具事实：`agent-tools.ts` 注册表

不再使用 `runs / steps / artifacts` 作为 Agent 主业务事实来源。

### 4.3 展示层目标

前端需要形成统一的展示抽象：

- 对话消息：`AgentConversationMessage`
- 思考阶段：`thinking.stages`
- 执行时间线：`AgentTimelineEvent`
- 产物摘要：从 goal timeline 中提取，而不是继续依赖旧 `artifact` 表
- 记忆摘要：展示“用到了什么记忆”，而不是暴露全部底层实现细节

### 4.4 流式协议目标

会话和目标执行流统一为 NDJSON 协议，最低建议支持以下事件：

| 事件类型 | 作用 | 最低字段 |
| --- | --- | --- |
| `phase` | 思考阶段切换 | `key`, `title`, `status` |
| `delta` | 主回答增量输出 | `message_id`, `chunk` |
| `goal_status` | 目标状态变化 | `goal_id`, `status`, `title` |
| `timeline` | 计划/执行时间线事件 | `event` |
| `tool_start` | 工具开始执行 | `goal_id`, `step_key`, `tool_name`, `input_preview` |
| `tool_result` | 工具返回摘要 | `goal_id`, `step_key`, `tool_name`, `output_preview` |
| `artifact` | 产物摘要生成 | `goal_id`, `kind`, `title`, `preview` |
| `memory` | 本轮记忆注入摘要 | `conversation_summary_used`, `long_term_memory_count` |
| `done` | 流结束 | `conversation` 或 `timeline` |
| `error` | 流失败 | `message` |

说明：

- `tool_delta` 可以作为增强项，不强制第一版实现。
- 事件应允许前端忽略未知类型，以支持协议渐进升级。

---

## 5. 分阶段实施方案

### Phase 1: 先完成 Gallery 脱钩

#### 目标

在不删除旧 `runs` 的前提下，先让 `/agent/gallery` 完全脱离旧数据源。

#### 主要任务

1. 为新链路补一个“可用于 Gallery 的查询投影”。
2. 优先从 `agent_goals` 读取已完成目标，而不是从 `agent_conversations` 反推。
3. 从 goal timeline 中提取可展示产物：
   - 标题
   - 正文摘要
   - 标签
   - SEO 摘要
   - 封面提示词
   - 视频提示词
4. 在 `AgentGallery.tsx` 内彻底移除 `/agent/runs` 依赖。
5. 增加“点击作品返回原会话”能力，形成从 Gallery 回到 `/agent?conversationId=...` 的闭环。

#### 推荐实现方式

推荐新增一个面向画廊的读取能力，而不是让前端自己拼接多个接口：

- 在 `web/src/lib/agent-goals.ts` 增加 gallery projection helper
- 在 `web/src/app/api/v1/agent/goals/route.ts` 增加 `GET`
- 返回结构示例：

```json
{
  "items": [
    {
      "goal_id": "goal_xxx",
      "conversation_id": "conv_xxx",
      "title": "文章标题",
      "summary": "正文摘要",
      "tags": ["AI", "Agent"],
      "updated_at": "2026-03-15T12:00:00.000Z",
      "status": "done",
      "source": "goal_timeline",
      "preview": {
        "content": "......",
        "seo_title": "......",
        "cover_prompt": "......"
      }
    }
  ]
}
```

#### 涉及文件

- `web/src/components/studio/modules/agent/AgentGallery.tsx`
- `web/src/app/agent/gallery/page.tsx`
- `web/src/lib/agent-goals.ts`
- `web/src/app/api/v1/agent/goals/route.ts`
- `web/src/features/agent/types.ts`
- 建议新增：`web/src/features/agent/deliverables.ts`

#### 验收标准

- `/agent/gallery` 不再请求 `/api/v1/agent/runs`
- `AgentGallery` 可以展示至少文章类和视频提示词类结果
- 每张卡片都能回跳到原始会话或 goal
- 现有 Gallery 页面无视觉回归

#### 风险与处理

- 风险：goal timeline 的输出结构不统一，前端很难稳定提取标题和正文。
- 处理：抽一层 `extractGoalDeliverable()`，在服务端做统一归一化，避免前端散落大量 `if/else`。

---

### Phase 2: 清理旧版 UI、旧 hooks、旧 API

#### 目标

在 Gallery 脱钩后，彻底移除 `runs` 架构，统一代码心智模型。

#### 主要任务

1. 删除旧 UI 和旧 hooks：
   - `AgentCreate.tsx`
   - `AgentTaskList.tsx`
   - `useCreateAgentRun.ts`
   - `useContinueAgentRun.ts`
   - `useAgentRunDetail.ts`
2. 删除旧后端：
   - `web/src/lib/agent.ts`
   - `/api/v1/agent/runs/*`
3. 清理旧 query key：
   - `agentRuns`
   - `agentRunDetail`
4. 清理旧测试：
   - `web/src/__tests__/api/agent/run.route.test.ts`
   - `web/src/__tests__/api/agent/runs-id.route.test.ts`
5. 在 `docs/API_DEPRECATION_TRACKER.md` 或对应文档中记录 `runs` 下线。

#### 删除前的兼容策略

如果担心外部仍有调用，可采用一个短兼容窗口：

- 第一步：将 `/api/v1/agent/runs/*` 改为 deprecated 响应
- 第二步：返回明确迁移提示
- 第三步：下一版本再物理删除

如果确认没有外部依赖，可直接删除。

#### 涉及文件

- `web/src/components/studio/modules/agent/AgentCreate.tsx`
- `web/src/components/studio/modules/agent/AgentTaskList.tsx`
- `web/src/components/studio/modules/agent/hooks/useCreateAgentRun.ts`
- `web/src/components/studio/modules/agent/hooks/useContinueAgentRun.ts`
- `web/src/components/studio/modules/agent/hooks/useAgentRunDetail.ts`
- `web/src/lib/agent.ts`
- `web/src/lib/query-keys.ts`
- `web/src/app/api/v1/agent/runs/route.ts`
- `web/src/app/api/v1/agent/runs/stream/route.ts`
- `web/src/app/api/v1/agent/runs/[id]/route.ts`
- `web/src/app/api/v1/agent/runs/[id]/continue/route.ts`
- `web/src/app/api/v1/agent/runs/[id]/export-to-publish/route.ts`

#### 验收标准

- 代码库中不再有真实业务逻辑依赖 `/agent/runs`
- Agent 新功能只通过 `conversations/goals` 运转
- 删除旧代码后，`/agent`、`/agent/gallery`、审批流、目标执行流全部正常

#### 风险与处理

- 风险：误删后导致某些页面、测试或缓存键仍引用旧逻辑。
- 处理：删除前运行 `rg "agent/runs|agentRuns|agent-run-detail"` 做全局清理。

---

### Phase 3: 强化 Streaming 与 ThinkPanel

#### 目标

让用户在会话过程中实时看到“Agent 正在做什么”，而不是只看到最后答案。

#### 当前差距

- `conversation stream` 只有 `phase` 和 `delta`
- `goal execute stream` 只有 `goal_status` 和 `timeline`
- 没有工具输入摘要、工具输出摘要、产物生成摘要
- `ThinkPanel` 已经具备布局基础，但没有吃到足够丰富的数据

#### 主要任务

1. 在 `agent-conversations.ts` 中，为对话阶段补充更多可流式抛出的执行事件。
2. 在 `agent-goals.ts` 的执行过程中发出工具开始、工具完成、失败、产物沉淀等事件。
3. 对 `conversations/[id]/messages/stream/route.ts` 和 `goals/[id]/execute/stream/route.ts` 做协议对齐。
4. 扩展 `AgentReplyMeta`，让消息上能挂载：
   - `timeline_events`
   - `tool_events`
   - `memory_used`
   - `artifact_previews`
5. 重写 `ChatInput.tsx` 的流解析逻辑，兼容新增事件类型。
6. 增强 `ChatThread.tsx` 中 `ThinkPanel` 的执行页签：
   - 显示工具名
   - 显示工具输入摘要
   - 显示工具输出摘要
   - 显示失败原因
   - 显示当前产物预览

#### 建议的 UI 展示策略

- `检索`：保留命中数、策略、引用统计
- `记忆`：只展示本轮实际注入的摘要和长期记忆数量
- `引用`：保留现有 citation list
- `时间线`：展示阶段事件、审批事件、投递事件
- `执行`：新增工具事件卡片和产物预览卡片

#### 涉及文件

- `web/src/app/api/v1/agent/conversations/[id]/messages/stream/route.ts`
- `web/src/app/api/v1/agent/goals/[id]/execute/stream/route.ts`
- `web/src/lib/agent-conversations.ts`
- `web/src/lib/agent-goals.ts`
- `web/src/features/agent/types.ts`
- `web/src/features/agent/components/ChatInput.tsx`
- `web/src/features/agent/components/ChatThread.tsx`
- `web/src/styles/agent-chat.css`

#### 验收标准

- 用户发送目标后，可以实时看到思考阶段变化
- Goal 开始执行后，可以看到工具被调用以及执行结果摘要
- 工具失败时，错误能在 `ThinkPanel` 中可视化，而不是只落日志
- 流式结束后，前端缓存中的消息和 timeline 状态保持一致

#### 风险与处理

- 风险：事件类型增多后，前后端协议容易漂移。
- 处理：新增 stream contract 测试，并要求前端对未知事件做忽略处理。

---

### Phase 4: 为 ChatInput 增加附件能力

#### 目标

让 Agent 能处理图片和文档，支持“分析资料再回答/规划/写作”。

#### 当前限制

- `ChatInput.tsx` 只支持文本
- 现有上传共享逻辑只允许图片
- 会话消息结构没有明确附件字段

#### 推荐实现策略

推荐分两步走：

第一步，先落最小可用版本：

- 允许上传图片、`txt`、`md`、`pdf`
- 将附件元数据放入 `agent_messages.meta_json.attachments`
- 暂不新增独立附件表，先避免数据库迁移扩散

第二步，再看是否需要单独的附件表：

- 当出现检索、权限、生命周期、重复引用等需求时
- 再补 `agent_message_attachments` 表

#### 主要任务

1. 为 Agent 增加独立附件上传接口，建议新增：
   - `web/src/app/api/v1/agent/attachments/route.ts`
2. 不直接复用 `/api/v1/upload/image` 作为最终接口，因为它语义上只适合图片。
3. 在 `ChatInput.tsx` 增加：
   - 上传按钮
   - 附件列表
   - 上传中状态
   - 删除与重试
4. 扩展消息发送体，增加 `attachments` 字段。
5. 在 `agent-conversations.ts` 中把附件信息写入用户消息 `meta_json`。
6. 为附件分析增加最小工具能力，优先实现：
   - `file.read`
   - 图片描述或 OCR 入口

#### 建议的附件数据结构

```json
{
  "attachments": [
    {
      "id": "att_xxx",
      "name": "brief.pdf",
      "mime_type": "application/pdf",
      "url": "/uploads/xxx.pdf",
      "size": 123456,
      "status": "uploaded"
    }
  ]
}
```

#### 涉及文件

- `web/src/features/agent/components/ChatInput.tsx`
- `web/src/features/agent/types.ts`
- `web/src/lib/agent-conversations.ts`
- `web/src/lib/agent-tools.ts`
- `web/src/app/api/upload/shared.ts`
- 建议新增：`web/src/app/api/v1/agent/attachments/route.ts`

#### 验收标准

- 用户可以在对话中上传至少一张图片或一个文档
- 上传结果可以在消息区回显
- 后端能在消息 `meta_json` 中拿到附件元数据
- Agent 对带附件请求至少能做到“已识别附件并基于附件作答/规划”

#### 风险与处理

- 风险：PDF 和图片解析链路比上传本身更复杂。
- 处理：先上线“上传 + 元数据 + 基础文件读取”，把深度解析放到后续迭代。

---

### Phase 5: 记忆治理、工具扩展与稳定性补齐

#### 目标

让 Agent 在长对话下保持可控的上下文质量，并补足高价值低风险工具。

#### 当前差距

- 会话摘要刷新节奏不明确
- 长期记忆召回没有阈值与预算
- 没有明显的记忆过期/去重/优先级策略
- 工具集合对外部信息和附件处理仍偏弱

#### 记忆优化建议

建议先采用一组保守的起始参数：

- 会话摘要刷新频率：
  - 每新增 6 个用户轮次触发一次
  - 或最近消息字符数超过预算时触发
- 会话摘要长度：
  - 目标 120 到 180 个中文字符
- 长期记忆召回数：
  - 默认最多 5 条
- 长期记忆召回阈值：
  - 置信度低于 `0.72` 的不注入
- 重复记忆写入：
  - key + value 去重
- 上下文预算：
  - 先压缩会话摘要
  - 再裁剪低置信长期记忆
  - 最后才裁剪知识检索结果

说明：以上为推荐初始值，最终应根据线上表现再调优。

#### 工具扩展建议

优先扩展高价值、低风险工具：

1. `web.search`
   - 用于补充站外公开信息
   - 风险级别建议为 `read`
2. `file.read`
   - 用于读取用户上传的附件内容
   - 风险级别建议为 `read`
3. `file.extract_text`
   - 用于对 `pdf/txt/md` 做文本提取
   - 可以和 `file.read` 合并实现

`code_execution` 不建议立即进入第一轮交付，原因如下：

- 安全面更大
- 沙箱与资源限制要求更高
- 当前产品核心价值仍然是内容和工作流，而不是通用编程代理

更合理的顺序是：

- 第一轮先做 `web.search` + `file.read`
- 第二轮再评估 `code_execution`

#### 涉及文件

- `web/src/lib/agent-memory.ts`
- `web/src/lib/agent-conversations.ts`
- `web/src/lib/agent-goals.ts`
- `web/src/lib/agent-tools.ts`
- `web/src/lib/rag/langchain-rag.ts`
- `web/src/lib/repositories/agent-platform-repository.ts`

#### 验收标准

- 长对话下回复质量不明显下降
- `ThinkPanel` 能显示本轮使用了多少记忆
- 新增的 `web.search` 和 `file.read` 可以参与计划和执行
- 高风险写入工具仍按审批机制运行

---

## 6. 工作区与导航打磨建议

当前 `AgentChatLayout` 和 `ChatSidebar` 已经形成了较清晰的双栏结构，但还可以进一步收敛焦点。

建议如下：

- `ChatSidebar` 默认强调“新对话 + 历史会话”，弱化“工具与设置”区块
- `assistants / prompts / knowledge / gallery` 作为辅助导航保留，但视觉权重下降
- Desktop 端尽量避免顶部再出现重复标题栏
- 主对话区增加更明确的状态反馈：
  - 正在思考
  - 正在执行
  - 等待审批
  - 已完成
- 子页面使用统一的 `SubPageHeader` 规范，但减少额外装饰，避免和主对话争抢注意力

涉及文件：

- `web/src/features/agent/components/AgentChatLayout.tsx`
- `web/src/features/agent/components/ChatSidebar.tsx`
- `web/src/features/agent/components/SubPageHeader.tsx`
- `web/src/styles/agent-chat.css`

---

## 7. 测试补齐方案

### 7.1 API 层

需要补齐或重写以下测试：

- `goals route GET` 的 Gallery 数据投影测试
- `conversation stream` 新事件协议测试
- `goal execute stream` 事件顺序测试
- `attachments route` 上传校验测试
- `memory` 阈值与摘要刷新测试

### 7.2 组件层

需要补齐以下方向：

- `AgentGallery` 新数据源渲染测试
- `ChatInput` 附件上传与移除测试
- `ThinkPanel` 工具执行日志渲染测试
- 审批状态和失败状态展示测试

### 7.3 端到端

建议至少覆盖以下三条主路径：

1. 创建对话并完成普通问答
2. 创建目标并执行到待审批
3. 上传附件后触发分析型问答

---

## 8. 发布策略、监控与回滚

### 8.1 建议的发布顺序

1. Gallery 新数据源上线
2. 旧 `runs` 链路下线
3. Streaming 协议升级
4. 附件能力上线
5. 记忆与工具增强上线

### 8.2 建议的监控指标

- `/agent` 首 token 时间
- 会话流错误率
- goal 执行完成率
- 审批通过率
- Gallery 加载成功率
- 附件上传成功率
- 长对话中的记忆命中率

### 8.3 回滚原则

- Gallery 迁移失败时，可暂时回退前端到旧接口
- Streaming 协议升级应保证前端忽略未知事件，以支持服务端回滚
- 附件能力建议使用 feature flag 控制
- 高风险工具扩展必须可单独关闭

---

## 9. 最终完成标准

当以下条件同时满足时，可认为本轮 Agent 优化完成：

- `/agent` 成为唯一主创作入口
- `/agent/gallery` 不再依赖 `runs`
- 旧版 `AgentCreate / AgentTaskList / runs API / lib/agent.ts` 已清理
- `ThinkPanel` 可以展示执行过程而不只是最终答案
- `ChatInput` 至少支持图片和基础文档附件
- 记忆注入有明确的预算、阈值和刷新策略
- 新增工具以低风险读取类能力为主，并已接入计划链路
- 测试覆盖已从旧 `runs` 模型迁移到 `conversations/goals` 模型

---

## 10. 建议的实际开发顺序

为了避免返工，建议按下面的真实开发顺序执行：

1. 先做 Gallery 脱钩
2. 再删除旧 `runs`
3. 再升级 Streaming 与 `ThinkPanel`
4. 再做附件能力
5. 最后做记忆治理与工具增强

这套顺序比原始摘要版更符合当前代码依赖关系，也更容易控制风险。
