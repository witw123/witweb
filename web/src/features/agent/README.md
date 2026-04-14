# Agent 功能模块

AI 驱动的内容创作助手，支持对话交互、目标执行、知识检索和流式响应。

## 目录结构

```
src/features/agent/
├── components/           # React 组件
│   ├── AgentChatLayout.tsx    # 主布局
│   ├── ChatThread.tsx        # 消息列表与交互
│   ├── ChatInput.tsx         # 输入框与流式提交
│   ├── ChatSidebar.tsx       # 对话历史侧边栏
│   ├── ThinkPanel.tsx       # 思考过程可视化
│   ├── GoalThreadBlock.tsx   # 目标执行状态
│   ├── AgentWorkbench.tsx    # 工件预览面板
│   ├── AgentErrorCard.tsx    # 错误恢复组件
│   ├── Skeleton.tsx          # 骨架屏组件
│   └── ...
├── hooks/               # 自定义 Hooks
│   ├── useConversationStream.ts  # 流式消息处理
│   ├── useAttachmentUpload.ts   # 附件上传
│   └── index.ts
├── utils/               # 工具函数
│   ├── error.ts        # 错误处理
│   ├── formatting.ts   # 格式化工具
│   └── index.ts
├── types.ts             # TypeScript 类型定义
├── constants.ts         # 常量与 UI 文本
└── timeline.ts         # 时间线事件类型
```

## 核心架构

### 数据流

```
用户输入 → ChatInput → useConversationStream Hook
                              ↓
                         流式 API 请求
                              ↓
                    NDJSON 响应处理 (phase/delta/done)
                              ↓
                    React Query 缓存更新
                              ↓
                         ChatThread 重渲染
```

### 状态管理

使用 **React Query** 管理所有服务端状态：

```typescript
// 查询键
["agent-conversations"]                    // 对话列表
["agent-conversations", id, "detail"]      // 单个对话详情
```

无全局 Context，所有状态通过 React Query 缓存管理。

### 流式响应

详情参见 [streaming.md](./docs/streaming.md)。

## 后端模块

位于 `src/lib/agent/`:

```
src/lib/agent/
└── goals/
    ├── types.ts      # 类型定义
    ├── planner.ts    # 执行计划构建
    ├── executor.ts   # 目标执行逻辑
    ├── timeline.ts   # 事件构建器
    └── index.ts      # 公共导出
```

## 关键类型

### AgentConversationDto

```typescript
interface AgentConversationDto {
  conversation: AgentConversationSummary;
  messages: AgentConversationMessage[];
  goals: AgentGoalTimelineDto[];
  conversation_memory?: { summary: string; key_points: string[]; turn_count: number } | null;
  long_term_memories?: Array<{ key: string; value: string; confidence: number; source: string }>;
}
```

### AgentError

```typescript
interface AgentError {
  message: string;
  category: "network" | "auth" | "validation" | "server" | "unknown";
  retryable: boolean;
  originalError?: unknown;
}
```

## 使用示例

### 发送消息

```typescript
const { submit, isPending, stop } = useConversationStream({
  conversationId,
  onConversationReady: (id) => console.log("Created:", id),
  callbacks: {
    onReset: () => setInput(""),
    onError: (msg) => setError(msg),
  },
});

submit({ content: "写一篇关于 AI 的文章", attachments: [] });
```

### 显示错误

```tsx
<AgentErrorCard
  error={error}
  onRetry={() => retry()}
  onDismiss={() => setError(null)}
/>
```

## 测试

```bash
# 运行 Agent 相关测试
npm run test -- src/__tests__/features/agent

# 类型检查
npm run type-check
```
