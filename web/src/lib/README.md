# API 响应标准化系统

本目录包含 WitWeb 项目的统一 API 响应标准化系统。

## 文件结构

```
web/src/lib/
├── api-response.ts    # 统一 API 响应工具
├── api-error.ts       # 错误类和错误码定义
├── validate.ts        # 请求校验工具（Zod）
└── README.md          # 本文档

web/src/middleware/
└── error-handler.ts   # 错误处理中间件辅助函数
```

## 快速开始

### 1. 基本响应格式

#### 成功响应
```json
{
  "success": true,
  "data": { ... }
}
```

#### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }  // 可选
  }
}
```

#### 分页响应
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "size": 10,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 2. 在 API Route 中使用

#### 方式一：使用 withErrorHandler 包装（推荐）

```typescript
// app/api/example/route.ts
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";
import { getAuthUser } from "@/lib/http";

const createSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
});

export const GET = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }
  
  const data = await fetchData();
  return successResponse(data);
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized();
  }
  
  // 自动验证请求体，失败时抛出 ApiError
  const body = await validateBody(req, createSchema);
  
  const result = await createData(body);
  return successResponse(result, 201);  // 201 Created
});
```

#### 方式二：使用 createApiRoute

```typescript
// app/api/items/route.ts
import { createApiRoute, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse, paginatedResponse } from "@/lib/api-response";
import { validateBody, validateQuery, z, createPaginationSchema } from "@/lib/validate";
import { getAuthUser } from "@/lib/http";

const querySchema = createPaginationSchema(1, 10).extend({
  category: z.string().optional(),
});

const createSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

export const { GET, POST } = createApiRoute({
  GET: async (req) => {
    const user = await getAuthUser();
    assertAuthenticated(user);
    
    const query = await validateQuery(req, querySchema);
    const { items, total } = await getItems(query);
    
    return paginatedResponse(items, total, query.page, query.size);
  },
  
  POST: async (req) => {
    const user = await getAuthUser();
    assertAuthenticated(user);
    
    const body = await validateBody(req, createSchema);
    const item = await createItem(body, user);
    
    return successResponse(item, 201);
  },
});
```

#### 方式三：手动处理错误

```typescript
// app/api/legacy/route.ts
import { successResponse, handleError } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    const data = await fetchData();
    return successResponse(data);
  } catch (error) {
    return handleError(error);
  }
}
```

### 3. 使用 ApiError

```typescript
import { ApiError, ErrorCode } from "@/lib/api-error";

// 抛出标准错误
throw ApiError.unauthorized("Token 已过期");
throw ApiError.notFound("用户");
throw ApiError.validation("参数错误", { field: "email" });

// 自定义错误
throw new ApiError(
  ErrorCode.FORBIDDEN,
  "您没有权限删除此资源"
);

// 条件断言
import { assertExists, assertAuthorized } from "@/middleware/error-handler";

const user = await getUserById(id);
assertExists(user, "用户不存在");  // 如果不存在则抛出 404

assertAuthorized(
  currentUser.role === "admin",
  "只有管理员可以执行此操作"
);
```

### 4. 验证请求

```typescript
import { validateBody, validateQuery, validateParams, z } from "@/lib/validate";

// 验证请求体
const body = await validateBody(req, z.object({
  email: z.string().email(),
  password: z.string().min(6),
}));

// 验证查询参数
const query = await validateQuery(req, z.object({
  page: z.coerce.number().default(1),
  q: z.string().optional(),
}));

// 验证路由参数
// app/api/items/[id]/route.ts
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = validateParams(await params, z.object({
    id: z.coerce.number().positive(),
  }));
  // ...
}
```

## 错误码参考

| 错误码 | HTTP 状态码 | 描述 |
|--------|------------|------|
| UNAUTHORIZED | 401 | 未授权 |
| FORBIDDEN | 403 | 禁止访问 |
| NOT_FOUND | 404 | 资源不存在 |
| VALIDATION_ERROR | 422 | 数据验证失败 |
| CONFLICT | 409 | 资源冲突（已存在）|
| BAD_REQUEST | 400 | 请求参数错误 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| RATE_LIMITED | 429 | 请求过于频繁 |

## 迁移现有 API

### 旧代码
```typescript
// 旧的错误响应格式不统一
return Response.json({ detail: "Invalid credentials" }, { status: 401 });
return Response.json({ message: "User not found" }, { status: 404 });
return Response.json({ error: "Validation failed" }, { status: 400 });
```

### 新代码
```typescript
import { errorResponses } from "@/lib/api-response";

// 统一的错误响应格式
return errorResponses.unauthorized("用户名或密码错误");
return errorResponses.notFound("用户不存在");
return errorResponses.validation("数据验证失败", { field: "email" });
```

## 最佳实践

1. **始终使用 `withErrorHandler` 包装 API Route 处理器**，自动捕获未处理的错误
2. **使用 `validateBody`/`validateQuery` 进行输入验证**，替代手动检查
3. **使用 `assertAuthenticated` 和 `assertAuthorized`** 进行权限检查
4. **使用 `getOrThrow`** 获取资源，如果不存在自动抛出 404
5. **保持错误消息简洁明了**，使用 `details` 字段传递额外信息
6. **不要在生产环境暴露敏感错误信息**，使用 `handleError` 自动处理
