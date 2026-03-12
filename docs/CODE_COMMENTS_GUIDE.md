# WitWeb 代码注释规范指南

本文档定义了 WitWeb 项目的代码注释标准和最佳实践。

## 目录

- [基本原则](#基本原则)
- [注释风格](#注释风格)
- [文件类型注释模板](#文件类型注释模板)
- [注释示例](#注释示例)
- [常见问题](#常见问题)

---

## 基本原则

### 1. 注释的目的
- 解释**为什么**（Why），而不是**做什么**（What）
- 代码本身已经说明了"做什么"，注释应该说明业务逻辑、设计决策和潜在风险
- 帮助其他开发者理解代码的意图和背景

### 2. 何时添加注释
- ✅ 复杂的业务逻辑
- ✅ 非显而易见的实现方式
- ✅ 重要的设计决策
- ✅ 可能的边缘情况和风险
- ✅ 公共 API 和导出函数

### 3. 何时不添加注释
- ❌ 显而易见的代码（如 `const a = 1`）
- ❌ 重复代码功能的注释
- ❌ 过时或误导的注释
- ❌ 注释掉的代码（应删除而非注释）

---

## 注释风格

本项目采用 **JSDoc** 风格注释。

### 1. 文件级注释

每个重要文件应包含文件级注释，说明文件的目的和主要功能。

```typescript
/**
 * 文件名 - 文件用途描述
 *
 * 详细说明文件的职责、用途和重要信息
 */
```

### 2. 函数/方法注释

```typescript
/**
 * 函数名称 - 函数功能描述
 *
 * 详细说明函数的用途、参数、返回值和副作用
 *
 * @param {类型} 参数名 - 参数说明
 * @returns {类型} 返回值说明
 * @throws {错误类型} 可能的错误情况
 */
```

### 3. 行内注释

使用 `//` 进行行内注释，用于解释复杂的逻辑或临时的解决方案。

```typescript
// TODO: 未来需要优化
// FIXME: 这里有已知问题
// HACK: 临时解决方案，需要重构
```

---

## 文件类型注释模板

### 1. 工具函数

```typescript
/**
 * 函数名 - 简明扼要的功能描述
 *
 * 更详细的说明（如果需要）
 *
 * @param {类型} 参数名 - 参数说明
 * @param {类型} [可选参数名] - 可选参数的说明
 * @returns {类型} 返回值说明
 * @example
 * functionName('input')
 */
export function functionName(param: string): ReturnType {
  // 实现
}
```

### 2. React 组件

```typescript
/**
 * 组件名称 - 组件功能描述
 *
 * 组件的详细说明（Props、行为、使用场景）
 *
 * @component
 * @example
 * <ComponentName
 *   prop1="value"
 *   onEvent={handleEvent}
 * />
 */
export function ComponentName({ prop1, onEvent }: ComponentProps) {
  // 实现
}
```

### 3. API 路由

```typescript
/**
 * API 路由名称 - 功能描述
 *
 * API 的详细说明
 *
 * @route /api/v1/resource
 * @method GET - 获取资源列表
 * @method POST - 创建新资源
 * @param {类型} 参数名 - 参数说明
 * @returns {类型} 返回值说明
 */
```

### 4. 类型定义

```typescript
/**
 * 类型名称 - 类型用途描述
 *
 * 类型的详细说明，包括字段含义、使用场景
 */
export interface TypeName {
  /** 字段名称 - 字段用途 */
  field1: string;

  /** 字段名称 - 字段用途 */
  field2?: number;
}
```

### 5. Hooks

```typescript
/**
 * useHookName - Hook 用途描述
 *
 * Hook 的详细说明
 *
 * @param {类型} 参数名 - 参数说明
 * @returns {类型} 返回值说明
 * @example
 * const { data, isLoading } = useHookName(param)
 */
export function useHookName(param: string) {
  // 实现
}
```

### 6. 仓库/数据访问层

```typescript
/**
 * Repository 名称 - 数据访问层描述
 *
 * 负责的数据操作和业务逻辑
 *
 * @async
 * @param {类型} 参数 - 参数说明
 * @returns {Promise<类型>} 返回值说明
 */
export async function repositoryMethod(param: string) {
  // 实现
}
```

---

## 注释示例

### 好的注释示例

```typescript
/**
 * 生成用户访问令牌
 *
 * 使用 JWT 签名用户信息，设置过期时间
 * 注意：不要在 payload 中存放敏感信息
 *
 * @param {number} userId - 用户 ID
 * @param {string} role - 用户角色
 * @returns {string} JWT 令牌字符串
 */
export function generateAccessToken(userId: number, role: string): string {
  // 使用用户 ID 和角色生成令牌
  return jwt.sign({ userId, role }, AUTH_SECRET, { expiresIn: '7d' });
}
```

```typescript
/**
 * 获取用户首页动态
 *
 * 返回用户关注的所有用户的最新动态，按时间倒序排列
 * 缓存时间：5 分钟
 *
 * @param {number} userId - 当前用户 ID
 * @param {number} [page=1] - 分页页码
 * @param {number} [limit=20] - 每页数量
 * @returns {Promise<FeedItem[]>} 动态列表
 */
export async function getUserFeed(userId: number, page = 1, limit = 20) {
  // 实现
}
```

### 不好的注释示例

```typescript
// ❌ 显而易见的注释
const a = 1; // 声明变量 a 为 1

// ❌ 重复代码的注释
const sum = a + b; // 计算 a 加 b 的和

// ❌ 过时的注释
// 这个函数现在返回错误信息而不是抛出异常
export function oldFunction() { ... }

// ❌ 注释掉的代码
// const oldCode = 'this is not used anymore';
```

---

## 常见问题

### Q: 注释应该用英文还是中文？

A: 本项目使用**中文注释**，因为团队主要使用中文交流。

### Q: 短函数需要注释吗？

A: 如果函数名称已经清楚表达了意图，并且实现简单明了，则不需要注释。如果有特殊处理或边界情况，则需要添加注释。

### Q: 注释和类型注解哪个更重要？

A: 两者都很重要。**类型注解**说明数据的结构和约束，**注释**说明业务逻辑和设计意图。两者结合才能让代码易于理解和维护。

### Q: 如何处理临时代码？

A: 使用明确的标记注释，如：
- `// TODO: 未来需要完成`
- `// FIXME: 需要修复的问题`
- `// HACK: 临时解决方案`

---

## 相关文档

- [API 版本控制](./API_VERSIONING.md)
- [安全修复记录](./SECURITY_FIXES.md)
- [项目架构](./ARCHITECTURE_AND_WORKFLOW.md)
