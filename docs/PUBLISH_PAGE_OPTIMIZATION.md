# 发布文章页优化清单

## 设计系统

### Pattern: Newsletter / Content First
- **转化焦点**: 打字机效果、淡入动画、单字段表单
- **CTA 位置**: Hero 内联表单 + Sticky 头部表单
- **色彩策略**: 极简主义、纸质感背景、文字聚焦、强调色用于订阅

### Style: Swiss Modernism 2.0
- **关键词**: Grid system、modular、asymmetric、rational、clean
- **适用**: Editorial、SaaS、documentation
- **性能**: ⚡ Excellent | **无障碍**: ✓ WCAG AAA

### Colors
| 角色 | 色值 | 用途 |
|------|------|------|
| Primary | #18181B | 主要按钮、标题 |
| Secondary | #3F3F46 | 次要文字、边框 |
| CTA | #EC4899 | 发布按钮、强调 |
| Background | #FAFAFA | 页面背景 |
| Text | #09090B | 正文文字 |

### Typography
- **字体**: Plus Jakarta Sans (Heading & Body)
- **等宽字体**: JetBrains Mono (代码块、编辑器)
- **阅读宽度**: max-w-prose (65-75ch)

---

## 当前状态分析

### 已有功能 ✅
- 本地草稿自动保存 (800ms 防抖)
- AI Agent 草稿导入
- 图片上传 + 自动压缩
- 分类/标签选择
- Markdown 支持

### 现有问题 ❌
- 无实时预览
- 无编辑器工具栏
- 无字数/阅读时间统计
- 无文章封面图
- 无快捷键支持
- 无拖拽/粘贴图片
- 无发布前预览

---

## 优化清单

### Phase 1: 编辑体验增强 (优先级: 高)

#### 1.1 Markdown 工具栏 ⭐
**问题**: 手写 Markdown 效率低
**方案**: 自定义 Toolbar 组件

```tsx
const toolbarButtons = [
  { icon: BoldIcon, action: 'bold', shortcut: 'Ctrl+B', insert: '**{text}**' },
  { icon: ItalicIcon, action: 'italic', shortcut: 'Ctrl+I', insert: '*{text}*' },
  { icon: LinkIcon, action: 'link', insert: '[{text}](url)' },
  { icon: ImageIcon, action: 'image', handler: openImageUpload },
  { icon: CodeIcon, action: 'code', insert: '```\n{text}\n```' },
  { icon: H2Icon, action: 'heading', insert: '## {text}' },
  { icon: ListIcon, action: 'list', insert: '- {text}' },
  { icon: QuoteIcon, action: 'quote', insert: '> {text}' },
  { icon: DividerIcon, action: 'divider', insert: '\n---\n' },
];
```

**验收标准**:
- [ ] 工具栏固定在编辑区上方
- [ ] 点击按钮插入 Markdown 语法
- [ ] 支持选中文本包裹
- [ ] 光标位置正确

#### 1.2 实时预览 ⭐
**问题**: 看不到渲染效果
**方案**: 分屏显示 + Tab 切换

```tsx
// 分屏模式
<div className="grid grid-cols-2 gap-4">
  <div className="editor-pane">
    <textarea ... />
  </div>
  <div className="preview-pane prose prose-slate">
    <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
  </div>
</div>

// Tab 模式 (移动端)
<Tabs defaultValue="edit">
  <TabsList>
    <TabsTrigger value="edit">编辑</TabsTrigger>
    <TabsTrigger value="preview">预览</TabsTrigger>
  </TabsList>
  ...
</Tabs>
```

**验收标准**:
- [ ] 桌面端分屏显示
- [ ] 移动端 Tab 切换
- [ ] 预览实时同步
- [ ] 代码块语法高亮

#### 1.3 字数统计
**问题**: 不知道文章长度
**方案**: 实时计算 + 底部状态栏

```tsx
function calculateStats(content: string) {
  const chars = content.length;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const readingTime = Math.ceil((chineseChars + words) / 400); // 400字/分钟
  return { chars, words, chineseChars, readingTime };
}
```

**UI 位置**:
```
| 已保存 12:30 | 字数 1,234 | 阅读约 3 分钟 |
```

#### 1.4 快捷键支持
**问题**: 操作效率低
**方案**: 键盘事件监听

| 快捷键 | 功能 |
|--------|------|
| Ctrl+S | 保存草稿 |
| Ctrl+B | 加粗 |
| Ctrl+I | 斜体 |
| Ctrl+K | 插入链接 |
| Ctrl+Shift+C | 代码块 |
| Ctrl+Enter | 发布文章 |

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          handleSaveDraft();
          break;
        case 'b':
          e.preventDefault();
          insertMarkdown('**');
          break;
        case 'enter':
          e.preventDefault();
          publish();
          break;
      }
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

#### 1.5 拖拽上传图片
**问题**: 只能点击上传
**方案**: Drag & Drop API

```tsx
<div
  className={cn("editor-container", isDragging && "ring-2 ring-primary")}
  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
  onDragLeave={() => setIsDragging(false)}
  onDrop={(e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) uploadImage(file);
    setIsDragging(false);
  }}
>
```

#### 1.6 粘贴图片
**问题**: 只能选择文件上传
**方案**: Clipboard API

```tsx
const handlePaste = async (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) await uploadImage(file);
      break;
    }
  }
};

// 绑定到 textarea
textarea.addEventListener('paste', handlePaste);
```

---

### Phase 2: 内容管理 (优先级: 高)

#### 2.1 封面图设置
**新增字段**: `cover_image_url`

**UI 布局**:
```
+----------------------------------+
|  [上传封面图] 或 拖拽图片到此处      |
|                                  |
|  建议尺寸: 1200x630, 支持 JPG/PNG  |
+----------------------------------+
```

#### 2.2 文章摘要
**新增字段**: `excerpt`

**UI**:
```tsx
<label>
  <span>文章摘要 (SEO)</span>
  <textarea
    maxLength={160}
    placeholder="用于搜索结果和分享卡片，建议 120-160 字"
    className="input"
  />
  <span className="text-xs text-muted">{excerpt.length}/160</span>
</label>
```

#### 2.3 文章编辑
**方案**: 复用发布页 + 路由参数

```
/publish           → 新建文章
/publish?slug=xxx  → 编辑文章
```

**逻辑**:
1. 检测 URL 参数 `slug`
2. 若存在，加载文章数据回填
3. 修改提交逻辑为更新

#### 2.4 草稿列表
**问题**: 只能保存一个草稿
**方案**: IndexedDB 多草稿存储

```tsx
interface Draft {
  id: string;
  title: string;
  content: string;
  tags: string;
  categoryId: string;
  coverImageUrl?: string;
  updatedAt: string;
}

// 草稿列表 UI
<Dialog>
  <DialogTrigger>我的草稿 (3)</DialogTrigger>
  <DialogContent>
    {drafts.map(draft => (
      <DraftCard key={draft.id} draft={draft} onLoad={loadDraft} onDelete={deleteDraft} />
    ))}
  </DialogContent>
</Dialog>
```

---

### Phase 3: SEO 与发布 (优先级: 中)

#### 3.1 SEO 设置
**新增字段**: `meta_title`, `meta_description`

**UI**: 可折叠的高级设置
```tsx
<Collapsible>
  <CollapsibleTrigger>SEO 设置</CollapsibleTrigger>
  <CollapsibleContent>
    <input placeholder="自定义标题 (默认使用文章标题)" />
    <textarea placeholder="自定义描述 (默认使用摘要)" />
  </CollapsibleContent>
</Collapsible>
```

#### 3.2 URL Slug
**新增字段**: `slug`

**UI**:
```tsx
<div className="flex items-center gap-2">
  <span className="text-muted">https://witweb/post/</span>
  <input
    value={slug}
    onChange={generateSlug}
    placeholder="自动生成或自定义"
  />
</div>
```

#### 3.3 发布预览
**方案**: Modal 模拟最终效果

```tsx
<Dialog>
  <DialogTrigger variant="ghost">预览</DialogTrigger>
  <DialogContent className="max-w-3xl">
    <article className="prose">
      <h1>{title}</h1>
      <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
    </article>
  </DialogContent>
</Dialog>
```

---

## 数据库变更

```sql
-- posts 表新增字段
ALTER TABLE posts ADD COLUMN cover_image_url TEXT;
ALTER TABLE posts ADD COLUMN excerpt TEXT;
ALTER TABLE posts ADD COLUMN meta_title TEXT;
ALTER TABLE posts ADD COLUMN meta_description TEXT;
ALTER TABLE posts ADD COLUMN slug TEXT UNIQUE;
```

---

## 实施计划

### Week 1: Phase 1 (编辑体验)

| 天数 | 任务 |
|------|------|
| Day 1 | 工具栏组件 + 快捷键 |
| Day 2 | 实时预览 (分屏 + Tab) |
| Day 3 | 字数统计 + 状态栏 |
| Day 4 | 拖拽上传 + 粘贴图片 |
| Day 5 | 测试 + 修复 |

### Week 2: Phase 2 (内容管理)

| 天数 | 任务 |
|------|------|
| Day 1 | 封面图上传 + 数据库迁移 |
| Day 2 | 文章摘要 + SEO 字段 |
| Day 3 | 文章编辑 (路由 + 数据回填) |
| Day 4 | 草稿列表 (IndexedDB) |
| Day 5 | 测试 + 修复 |

---

## UI/UX 规范 (来自 Pro Max)

### 视觉规范
- [ ] 不使用 Emoji 作为图标 (使用 SVG: Heroicons/Lucide)
- [ ] 所有可点击元素添加 `cursor-pointer`
- [ ] Hover 状态使用平滑过渡 (150-300ms)
- [ ] 浅色模式文字对比度 >= 4.5:1
- [ ] 焦点状态可见 (键盘导航)
- [ ] 支持 `prefers-reduced-motion`
- [ ] 响应式: 375px, 768px, 1024px, 1440px

### 表单规范
- [ ] 所有输入框有 label 关联
- [ ] 提交后显示 loading 状态
- [ ] 成功/错误反馈明确
- [ ] 不使用 placeholder 代替 label

### 内容规范
- [ ] 阅读宽度限制 max-w-prose
- [ ] 异步内容预留空间 (防止布局跳动)
- [ ] 长内容优雅截断 + 展开选项

---

## 参考资源

- [Toast UI Editor](https://ui.toast.com/tui-editor)
- [ByteMD](https://github.com/bytedance/bytemd)
- [Novel](https://github.com/steven-tey/novel)
- [Lexical](https://lexical.dev/)
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/)
