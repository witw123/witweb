/**
 * 安全工具模块
 *
 * 提供数据加密、SQL 注入检测、输入验证等安全相关功能
 */

import crypto from "crypto";

// ============================================================================
// 加密相关配置
// ============================================================================

/** 加密算法：AES-256-GCM（带认证标签的伽罗瓦计数器模式） */
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
/** 密钥长度：32 字节（256 位） */
const KEY_LENGTH = 32;
/** 初始向量长度：16 字节 */
const IV_LENGTH = 16;
/** 盐值长度：64 字节 */
const SALT_LENGTH = 64;

/**
 * 获取加密密钥
 *
 * 从环境变量 ENCRYPTION_KEY 获取密钥，若未设置则使用备用密钥
 * 注意：生产环境必须配置 ENCRYPTION_KEY
 *
 * @returns {Buffer} 加密密钥 Buffer
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    return Buffer.from(envKey.slice(0, 32));
  }
  console.warn("[SECURITY WARNING] ENCRYPTION_KEY not set, using fallback key");
  return crypto.scryptSync("fallback-dev-key-do-not-use-in-production", "salt", KEY_LENGTH);
}

/**
 * 生成随机加密密钥
 *
 * 生成一个 64 字符的十六进制字符串（32 字节）
 *
 * @returns {string} 随机加密密钥
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("hex");
}

// ============================================================================
// 加密/解密函数
// ============================================================================

/**
 * 加密数据
 *
 * @interface EncryptedData - 加密结果数据结构
 */
export interface EncryptedData {
  /** Base64 编码的加密数据 */
  encrypted: string;
  /** Base64 编码的初始向量 */
  iv: string;
  /** Base64 编码的认证标签 */
  authTag: string;
  /** Base64 编码的盐值 */
  salt: string;
}

/**
 * 加密字符串
 *
 * 使用 AES-256-GCM 算法加密数据，生成包含密文、IV、认证标签和盐值的对象
 *
 * @param {string} text - 待加密的明文字符串
 * @returns {EncryptedData} 加密结果对象
 */
export function encrypt(text: string): EncryptedData {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const key = crypto.scryptSync(getEncryptionKey(), salt, KEY_LENGTH);
  
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    salt: salt.toString("base64"),
  };
}

/**
 * 解密字符串
 *
 * 使用 AES-256-GCM 算法解密数据
 *
 * @param {EncryptedData} data - 加密数据对象
 * @returns {string} 解密后的明文字符串
 * @throws {Error} 解密失败时抛出错误
 */
export function decrypt(data: EncryptedData): string {
  try {
    const salt = Buffer.from(data.salt, "base64");
    const iv = Buffer.from(data.iv, "base64");
    const authTag = Buffer.from(data.authTag, "base64");
    
    const key = crypto.scryptSync(getEncryptionKey(), salt, KEY_LENGTH);
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data.encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch { 
    throw new Error("Decryption failed: invalid data or key");
  }
}

/**
 * 加密字符串为 JSON 字符串
 *
 * @param {string} text - 待加密的明文字符串
 * @returns {string} 加密后的 JSON 字符串
 */
export function encryptToString(text: string): string {
  return JSON.stringify(encrypt(text));
}

/**
 * 从 JSON 字符串解密
 *
 * @param {string} encryptedString - 加密后的 JSON 字符串
 * @returns密后的明文字 {string} 解符串
 */
export function decryptFromString(encryptedString: string): string {
  const data = JSON.parse(encryptedString) as EncryptedData;
  return decrypt(data);
}

// ============================================================================
// SQL 注入检测与预防
// ============================================================================

/**
 * 检测 SQL 注入
 *
 * 检查输入是否包含常见的 SQL 注入模式
 * 注意：此函数作为辅助检测，推荐使用参数化查询防止 SQL 注入
 *
 * @param {string} input - 待检测的用户输入
 * @returns {boolean} 是否检测到可能的 SQL 注入
 */
export function detectSqlInjection(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  
  const dangerousPatterns = [
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,  // 'or'
    /((\%27)|(\'))union/i,  // 'union
    /exec(\s|\+)+(s|x)p\w+/i,  // exec xp_
    /UNION\s+SELECT/i,  // UNION SELECT
    /INSERT\s+INTO/i,  // INSERT INTO
    /DELETE\s+FROM/i,  // DELETE FROM
    /DROP\s+TABLE/i,  // DROP TABLE
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * 清理 LIKE 查询模式
 *
 * 转义 % 和 _ 字符，防止 LIKE 注入
 *
 * @param {string} input - 用户输入的搜索关键词
 * @returns {string} 转义后的字符串
 */
export function sanitizeLikePattern(input: string): string {
  if (!input || typeof input !== "string") return "";
  
  return input
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * 验证 SQL 标识符
 *
 * 检查字符串是否为合法的 SQL 表名或列名（仅允许字母、数字、下划线，不能数字开头）
 *
 * @param {string} identifier - 待验证的标识符
 * @returns {boolean} 是否为合法的 SQL 标识符
 */
export function isValidSqlIdentifier(identifier: string): boolean {
  if (!identifier || typeof identifier !== "string") return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
}

/**
 * 验证并解析排序字段
 *
 * 检查排序字段是否在允许列表中，防止 SQL 注入
 *
 * @param {string} sortField - 排序字段字符串（如 "created_at DESC"）
 * @param {string[]} allowedFields - 允许排序的字段列表
 * @param {string} [defaultField="id"] - 默认排序字段
 * @returns {string} 安全的排序字段字符串
 */
export function validateSortField(
  sortField: string,
  allowedFields: string[],
  defaultField: string = "id"
): string {
  if (!sortField || typeof sortField !== "string") return defaultField;
  
  const field = sortField.replace(/\s+(ASC|DESC)$/i, "").trim();
  
  if (allowedFields.includes(field) && isValidSqlIdentifier(field)) {
    const direction = /\s+DESC$/i.test(sortField) ? "DESC" : "ASC";
    return `${field} ${direction}`;
  }
  
  return defaultField;
}

// ============================================================================
// HTML 转义与用户输入验证
// ============================================================================

/**
 * HTML 转义
 *
 * 将特殊字符转换为 HTML 实体，防止 XSS 攻击
 *
 * @param {string} input - 用户输入
 * @returns {string} 转义后的字符串
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== "string") return "";
  
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  
  return input.replace(/[&<>"'/]/g, char => htmlEscapes[char] || char);
}

/**
 * 验证用户名格式
 *
 * 用户名规则：3-30 个字符，仅包含字母、数字、下划线和连字符
 *
 * @param {string} username - 用户名
 * @returns {boolean} 是否符合格式要求
 */
export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== "string") return false;
  return /^[a-zA-Z0-9_-]{3,30}$/.test(username);
}

/**
 * 验证邮箱格式
 *
 * 检查字符串是否符合基本的邮箱格式
 *
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否符合格式要求
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * 验证密码强度
 *
 * 检查密码是否满足基本要求：6-256 位
 *
 * @param {string} password - 密码
 * @returns {{valid: boolean; errors: string[]}} 验证结果和错误信息列表
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!password || typeof password !== "string") {
    return { valid: false, errors: ["请输入密码"] };
  }
  
  if (password.length < 6) {
    errors.push("密码至少 6 位");
  }
  
  if (password.length > 256) {
    errors.push("密码最多 256 位");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证并规范化分页参数
 *
 * 确保页码和每页数量在有效范围内
 *
 * @param {number|string} page - 页码
 * @param {number|string} limit - 每页数量
 * @param {number} [maxLimit=100] - 每页最大数量限制
 * @returns {{page: number; limit: number}} 规范化后的分页参数
 */
export function validatePagination(
  page: number | string,
  limit: number | string,
  maxLimit: number = 100
): { page: number; limit: number } {
  let parsedPage = typeof page === "string" ? parseInt(page, 10) : page;
  let parsedLimit = typeof limit === "string" ? parseInt(limit, 10) : limit;
  
  if (isNaN(parsedPage) || parsedPage < 1) parsedPage = 1;
  if (isNaN(parsedLimit) || parsedLimit < 1) parsedLimit = 20;
  if (parsedLimit > maxLimit) parsedLimit = maxLimit;
  
  return { page: parsedPage, limit: parsedLimit };
}

/**
 * 清理输入
 *
 * 去除控制字符，仅保留可见字符
 *
 * @param {string} input - 用户输入
 * @returns {string} 清理后的字符串
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  
  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

// ============================================================================
// 请求验证
// ============================================================================

/**
 * 验证错误
 */
export interface ValidationError {
  /** 字段名 */
  field: string;
  /** 错误消息 */
  message: string;
}

/**
 * 通用请求体验证
 *
 * 根据规则验证请求体中的字段
 *
 * @template T - 期望的数据类型
 * @param {unknown} body - 请求体对象
 * @param {object} rules - 验证规则
 * @returns {{valid: boolean; data?: T; errors?: ValidationError[]}} 验证结果
 */
export function validateRequest<T extends Record<string, unknown>>(
  body: unknown,
  rules: {
    [K in keyof T]: {
      required?: boolean;
      type?: "string" | "number" | "boolean" | "array" | "object";
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      validator?: (value: unknown) => boolean | string;
    };
  }
): { valid: boolean; data?: T; errors?: ValidationError[] } {
  if (!body || typeof body !== "object") {
    return { valid: false, errors: [{ field: "body", message: "Invalid request body" }] };
  }
  
  const errors: ValidationError[] = [];
  const data: Partial<T> = {};
  
  for (const [field, rule] of Object.entries(rules)) {
    const value = (body as Record<string, unknown>)[field];
    
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push({ field, message: `${String(field)} is required` });
      continue;
    }
    
    if (value === undefined || value === null) {
      continue;
    }
    
    if (rule.type) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== rule.type) {
        errors.push({ field, message: `${String(field)} must be of type ${rule.type}` });
        continue;
      }
    }
    
    if (typeof value === "string") {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push({ field, message: `${String(field)} must be at least ${rule.minLength} characters` });
        continue;
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push({ field, message: `${String(field)} must not exceed ${rule.maxLength} characters` });
        continue;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({ field, message: `${String(field)} format is invalid` });
        continue;
      }
    }
    
    if (rule.validator) {
      const result = rule.validator(value);
      if (result !== true) {
        errors.push({ field, message: typeof result === "string" ? result : `${String(field)} is invalid` });
        continue;
      }
    }
    
    (data as Record<string, unknown>)[field] = value;
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, data: data as T };
}

// ============================================================================
// 安全响应头
// ============================================================================

/**
 * 获取安全响应头
 *
 * 返回一组 HTTP 安全响应头，用于增强应用安全性
 *
 * @returns {Record<string, string>} 安全响应头对象
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self' https:;",
  };
}

// ============================================================================
// 速率限制
// ============================================================================

/**
 * 速率限制条目
 */
interface RateLimitEntry {
  /** 当前计数 */
  count: number;
  /** 重置时间戳 */
  resetTime: number;
}

/** 速率限制存储（内存中） */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * 检查速率限制
 *
 * 基于内存的简单速率限制实现
 *
 * @param {string} key - 限流标识（如 IP 地址或用户 ID）
 * @param {number} [maxRequests=100] - 时间窗口内的最大请求数
 * @param {number} [windowMs=60000] - 时间窗口（毫秒）
 * @returns {{allowed: boolean; remaining: number; resetTime: number}} 限流结果
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return { allowed: true, remaining: maxRequests - 1, resetTime: newEntry.resetTime };
  }
  
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }
  
  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}

/**
 * 清理过期的速率限制记录
 *
 * 删除已过期的速率限制条目，释放内存
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupRateLimitStore, 3600000);

// ============================================================================
// 日志脱敏
// ============================================================================

/**
 * 遮盖敏感值
 *
 * 在日志中遮盖敏感信息，仅显示首尾部分
 *
 * @param {string} value - 敏感值
 * @param {number} [visibleStart=4] - 开头可见字符数
 * @param {number} [visibleEnd=4] - 结尾可见字符数
 * @returns {string} 遮盖后的字符串
 */
export function maskSensitiveValue(
  value: string,
  visibleStart: number = 4,
  visibleEnd: number = 4
): string {
  if (!value || typeof value !== "string") return "";
  if (value.length <= visibleStart + visibleEnd) return "*".repeat(value.length);
  
  const start = value.slice(0, visibleStart);
  const end = value.slice(-visibleEnd);
  const middleLength = value.length - visibleStart - visibleEnd;
  
  return `${start}${"*".repeat(middleLength)}${end}`;
}

/**
 * 日志脱敏
 *
 * 将对象中的敏感字段替换为占位符，防止敏感信息泄露到日志
 *
 * @template T - 对象类型
 * @param {T} obj - 待处理的对象
 * @param {string[]} [sensitiveFields=["password","token","api_key","secret","authorization"]] - 敏感字段列表
 * @returns {Partial<T>} 脱敏后的对象
 */
export function sanitizeForLogging<T extends Record<string, unknown>>(
  obj: T,
  sensitiveFields: string[] = ["password", "token", "api_key", "secret", "authorization"]
): Partial<T> {
  const result: Partial<T> = { ...obj };
  
  for (const field of sensitiveFields) {
    if (field in result) {
      (result as Record<string, unknown>)[field] = "[REDACTED]";
    }
  }
  
  return result;
}
