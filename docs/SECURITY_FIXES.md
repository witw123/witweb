# WitWeb 安全优化方案

本文档描述了 WitWeb 项目的安全修复和优化方案。

## 修复的安全问题

### 1. API 密钥硬编码 (已修复)

**问题描述**：
- 文件 `data/api_config.json` 包含明文 API key
- 密钥直接存储在代码仓库中，存在泄露风险

**修复方案**：
1. 将 API 密钥移至环境变量
2. 提供加密存储方案用于数据库存储敏感配置
3. 创建配置管理模块 `web/src/lib/config.ts`

**环境变量**：
```bash
# 替代 data/api_config.json 中的硬编码密钥
SORA2_API_KEY=your-sora2-api-key-here
GRSAI_TOKEN=your-grsai-token-here
```

**迁移步骤**：
1. 复制 `.env.example` 为 `.env.local`
2. 将 `data/api_config.json` 中的密钥填入对应的环境变量
3. 删除或移动 `data/api_config.json`（已不在代码仓库中）
4. 重启应用

---

### 2. SQL 注入风险 (已加固)

**问题分析**：
- 项目主要使用 `better-sqlite3` 库
- 大部分查询使用了参数化查询（`?` 占位符），这是安全的
- LIKE 查询中的 `%${value}%` 模式是安全的，因为值通过参数传递

**已检查的文件**：
| 文件 | 状态 | 说明 |
|------|------|------|
| `web/src/lib/user.ts` | ✅ 安全 | 使用参数化查询 |
| `web/src/lib/admin.ts` | ✅ 安全 | 使用参数化查询 |
| `web/src/lib/blog.ts` | ✅ 安全 | 使用参数化查询 |
| `web/src/lib/follow.ts` | ✅ 安全 | 使用参数化查询 |
| `web/src/lib/video.ts` | ✅ 安全 | 使用参数化查询 |
| `web/src/lib/studio.ts` | ✅ 安全 | 使用参数化查询 |

**加固措施**：
1. 创建 `web/src/lib/security.ts` 提供 SQL 注入检测函数
2. 添加 `sanitizeLikePattern()` 用于清理 LIKE 通配符
3. 添加 `isValidSqlIdentifier()` 用于验证表名/列名

**使用示例**：
```typescript
import { detectSqlInjection, sanitizeLikePattern, isValidSqlIdentifier } from "@/lib/security";

// 检测 SQL 注入
if (detectSqlInjection(userInput)) {
  throw new Error("Potential SQL injection detected");
}

// 清理 LIKE 查询参数
const safePattern = `%${sanitizeLikePattern(searchTerm)}%`;
stmt.all(safePattern);

// 验证标识符
if (!isValidSqlIdentifier(tableName)) {
  throw new Error("Invalid table name");
}
```

---

### 3. 输入验证缺失 (已修复)

**问题描述**：
- API 路由缺少请求体验证
- 没有统一的参数验证机制

**修复方案**：
1. 创建 `web/src/lib/security.ts` 提供验证工具函数
2. 添加 `validateRequest()` 通用验证函数
3. 添加常用验证函数：
   - `isValidUsername()` - 用户名验证
   - `isValidEmail()` - 邮箱验证
   - `validatePassword()` - 密码强度验证
   - `validatePagination()` - 分页参数验证

**使用示例**：
```typescript
import { validateRequest, isValidUsername } from "@/lib/security";

export async function POST(req: Request) {
  const body = await req.json();
  
  const { valid, data, errors } = validateRequest(body, {
    username: { 
      required: true, 
      type: "string", 
      minLength: 3, 
      maxLength: 30,
      validator: isValidUsername 
    },
    password: { 
      required: true, 
      type: "string", 
      minLength: 8 
    },
    email: { 
      required: false, 
      type: "string" 
    },
  });
  
  if (!valid) {
    return Response.json({ errors }, { status: 400 });
  }
  
  // data 是类型安全的验证后数据
  const { username, password, email } = data;
  // ...
}
```

---

## 新增的安全功能

### 1. 加密工具 (`web/src/lib/security.ts`)

**功能**：
- `encrypt()` / `decrypt()` - AES-256-GCM 加密/解密
- `encryptToString()` / `decryptFromString()` - 便于存储的 JSON 格式
- `generateEncryptionKey()` - 生成随机加密密钥

**用途**：
- 加密存储敏感配置（API 密钥、Token 等）
- 保护数据库中的敏感字段

### 2. 安全配置管理 (`web/src/lib/config.ts`)

**功能**：
- 从环境变量读取所有配置
- 敏感配置加密存储/读取
- 配置验证和默认值
- 安全的配置快照（日志输出）

**主要导出**：
- `appConfig` - 应用配置
- `authConfig` - 认证配置
- `apiConfig` - 第三方 API 配置
- `securityConfig` - 安全配置
- `dbConfig` - 数据库配置

### 3. 安全响应头

在 API 路由中返回安全响应头：
```typescript
import { getSecurityHeaders } from "@/lib/security";

export async function GET() {
  const headers = new Headers(getSecurityHeaders());
  return Response.json(data, { headers });
}
```

包含的响应头：
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`

### 4. 速率限制

简单的内存速率限制：
```typescript
import { checkRateLimit } from "@/lib/security";

const result = checkRateLimit(ipAddress, 100, 60000);
if (!result.allowed) {
  return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
}
```

### 5. 敏感数据掩码

用于日志输出：
```typescript
import { maskSensitiveValue, sanitizeForLogging } from "@/lib/security";

// 掩码 API 密钥
console.log(maskSensitiveValue("sk-abc123xyz789", 4, 4)); // "sk-1***********6789"

// 清理对象中的敏感字段
const safeLog = sanitizeForLogging(reqBody);
console.log(safeLog); // password, token 等字段显示为 [REDACTED]
```

---

## 环境变量清单

复制 `.env.example` 到 `.env.local` 并配置以下变量：

### 必需（生产环境）
| 变量名 | 说明 | 生成方式 |
|--------|------|----------|
| `AUTH_SECRET` | JWT 签名密钥 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_KEY` | 数据加密密钥 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### API 密钥（从 data/api_config.json 迁移）
| 变量名 | 说明 |
|--------|------|
| `SORA2_API_KEY` | Sora2 API 密钥 |
| `GRSAI_TOKEN` | GRS AI Token |

### 可选（有默认值）
| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `development` | 应用环境 |
| `ADMIN_USERNAME` | `admin` | 管理员用户名 |
| `AUTH_EXPIRES_IN` | `1d` | JWT 过期时间 |
| `MAX_UPLOAD_SIZE` | `10` | 最大上传大小(MB) |
| `RATE_LIMIT_MAX` | `100` | 速率限制 |

---

## 部署检查清单

- [ ] 复制 `.env.example` 为 `.env.local` 并填写所有必需值
- [ ] 生成强 `AUTH_SECRET`（至少 32 字符）
- [ ] 生成强 `ENCRYPTION_KEY`（至少 32 字符）
- [ ] 迁移 `data/api_config.json` 中的密钥到环境变量
- [ ] 删除或移动 `data/api_config.json` 文件
- [ ] 验证所有 API 密钥可以正常读取
- [ ] 配置生产环境数据库路径（可选）
- [ ] 启用 HTTPS（生产环境必需）
- [ ] 配置防火墙规则

---

## 安全最佳实践

1. **永远不要提交 `.env.local` 文件**
   ```bash
   # 确保 .env.local 在 .gitignore 中
   echo ".env.local" >> .gitignore
   ```

2. **定期轮换 API 密钥**
   - 建议每 3-6 个月更换一次
   - 使用环境变量可以快速更新

3. **使用 HTTPS**
   - 生产环境必须启用 HTTPS
   - 配置 HSTS 响应头

4. **监控和日志**
   - 启用请求日志记录
   - 使用 `sanitizeForLogging()` 清理日志输出

5. **数据库安全**
   - 定期备份数据库
   - 设置数据库文件权限（建议 600）

---

## 后续优化建议

1. **添加 Zod 验证库**（可选）
   ```bash
   npm install zod
   ```
   用于更强大的运行时类型验证

2. **添加 Redis 速率限制**（生产环境推荐）
   - 当前使用内存存储，重启后重置
   - Redis 可以提供分布式速率限制

3. **添加审计日志**
   - 记录敏感操作（登录、密码修改等）

4. **添加 CSRF 保护**
   - 对非 API 路由启用 CSRF token

5. **密码策略增强**
   - 实现密码历史检查
   - 添加密码过期机制
