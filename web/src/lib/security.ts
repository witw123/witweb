/**
 */

import crypto from "crypto";

// ============================================================================
// ============================================================================

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;

/**
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
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("hex");
}

// ============================================================================
// ============================================================================

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

/**
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
 */
export function encryptToString(text: string): string {
  return JSON.stringify(encrypt(text));
}

/**
 */
export function decryptFromString(encryptedString: string): string {
  const data = JSON.parse(encryptedString) as EncryptedData;
  return decrypt(data);
}

// ============================================================================
// ============================================================================

/**
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
 */
export function sanitizeLikePattern(input: string): string {
  if (!input || typeof input !== "string") return "";
  
  return input
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 */
export function isValidSqlIdentifier(identifier: string): boolean {
  if (!identifier || typeof identifier !== "string") return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
}

/**
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
// ============================================================================

/**
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
 */
export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== "string") return false;
  return /^[a-zA-Z0-9_-]{3,30}$/.test(username);
}

/**
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
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
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") return "";
  
  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

// ============================================================================
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

/**
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
// ============================================================================

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
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
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
// ============================================================================

/**
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
