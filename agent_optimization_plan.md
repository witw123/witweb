# AI Agent Feature Optimization Plan

# AI Agent 功能优化方案

本文档概述了 AI Agent 前端页面和后端逻辑的优化建议。

## 1. 现状分析
当前应用包含两个版本的 AI Agent 功能：
- **旧版基于表单的 Agent**：位于 `AgentCreate.tsx` 和 `AgentTaskList.tsx`。它依赖于旧的 `/api/v1/agent/runs` 后端接口。交互方式是表单驱动的（填写文本框，选择类型，点击“开始创作”），这种方式不够符合真正“Agent”的直觉体验。
- **现代对话式 Agent**：位于 `ChatThreadWrapper.tsx` 和 `ChatThread.tsx`。它使用了较新的 `/api/v1/agent/conversations` 和 `/api/v1/agent/goals` 后端接口。它具有连续聊天的界面、包含推理阶段的 `ThinkPanel`（思考面板）、记忆功能、语义搜索、引用来源以及执行步骤流水线。

## 2. 前端优化
为了让该功能更像一个真正的“Agent”并提升用户体验：
1. **移除/废弃旧版 UI**：彻底淘汰 `AgentCreate` 和 `AgentTaskList` 组件。统一入口，让用户只与 `ChatThread` 对话式 UI 进行交互。
2. **重构 `AgentGallery`（作品库）**：目前 `AgentGallery` 从旧的 `/agent/runs` 接口获取数据。更新它，使其从新的 `agent/goals` 或 `agent/conversations` 数据结构中拉取已完成的产物。
3. **增强 `ThinkPanel`（思考面板）**：
   - 在视觉上提升推理和计划执行阶段的展示效果。
   - 显示工具调用的实时输出（例如：如果正在进行网络搜索，显示搜索词；如果是查询数据库，显示 SQL）。
4. **多模态输入 (`ChatInput`)**：确保 `ChatInput` 支持附件（图片、文件）上传，以便允许分析文档，提升 Agent 的能力。
5. **全局工作区打磨**：精简 ChatSidebar（聊天侧边栏）和顶部导航栏，尽量减少视觉干扰，为聊天区域提供最大化的屏幕空间。

## 3. 后端优化
1. **清理旧版 API**：移除或废弃 `v1/agent/runs` 接口以及底层相关的库方法 (`src/lib/agent.ts`)，以减轻维护负担，将重点完全放在 `lib/agent-conversations.ts` 和 `lib/agent-goals.ts` 上。
2. **丰富流式响应 (Streaming)**：增强 `stream/route.ts`，推送更细颗粒度的 `delta` 和 `phase` 事件，特别是中间工具的输出结果，而不是仅仅等待工具执行完毕。
3. **扩展工具库 (Tool Expansion)**：添加更强大的内部工具。目前已经有 `radar.fetch_and_analyze` 或 `blog.create_post` 等工具。增加诸如 `web_search`（网络搜索）、`code_execution`（代码执行）或 `file_read`（文件读取）等能力，将使代理变得更加自主。
4. **改进记忆注入**：后端目前处理 `long_term_memories`（长期记忆）和 `conversation_memory`（会话记忆）。我们需要优化检索评分阈值和记忆总结的频率，以防止在长对话中上下文窗口溢出。

## 4. 实施步骤
1. **第一阶段：清理**：删除旧版前端组件和后端路由。将所有 Agent 的流量重定向到 `ChatThread`。
2. **第二阶段：画廊迁移**：重写 `AgentGallery` 的 API 调用和数据映射逻辑，使用新的 `goals/conversations` 数据结构。
3. **第三阶段：多模态输入 & UI 增强**：在 `ChatInput` 中添加文件上传功能。改进 `ThinkPanel` 的动画体验。
4. **第四阶段：后端工具扩展 & 流媒体优化**：实现工具输出的实时流式传输，并添加 1-2 个新工具（例如：网络搜索）。
