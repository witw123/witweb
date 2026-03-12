/**
 * JWT 工具
 *
 * 提供 JSON Web Token 的创建、验证和解析功能
 * 用于用户身份验证和会话管理
 */

import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "@/types";

/**
 * JWT 签名算法
 * HS256 表示使用 HMAC-SHA256 进行签名
 */
const JWT_ALGORITHM = "HS256";

/**
 * 开发环境下的备用密钥
 * 仅在本地开发时使用，生产环境必须配置 AUTH_SECRET
 */
const DEV_FALLBACK_SECRET = "change-this-secret-min-32-characters-long";

/**
 * 解析 JWT 密钥
 *
 * 优先使用环境变量中的 AUTH_SECRET，否则使用开发备用密钥
 * 生产环境未配置密钥时抛出错误
 *
 * @returns {string} JWT 密钥字符串
 * @throws {Error} 生产环境未配置 AUTH_SECRET 时抛出
 */
function resolveJwtSecret(): string {
  const configuredSecret = process.env.AUTH_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }

  return DEV_FALLBACK_SECRET;
}

/**
 * 获取 JWT 密钥的 Uint8Array 格式
 *
 * @returns {Uint8Array} 编码后的密钥
 */
function getJwtSecretKey(): Uint8Array {
  const secret = resolveJwtSecret();
  return new TextEncoder().encode(secret);
}

/**
 * 创建 JWT 访问令牌
 *
 * 使用 JWT 签名用户信息，包含用户名和角色
 *
 * @param {string} username - 用户名
 * @param {string} expiresIn - 过期时间（如 '7d', '1h'）
 * @param {"super_admin"|"content_reviewer"|"operator"|"admin"|"user"|"bot"} [role="user"] - 用户角色
 * @returns {Promise<string>} JWT 令牌字符串
 */
export async function createJwtToken(
  username: string,
  expiresIn: string,
  role: "super_admin" | "content_reviewer" | "operator" | "admin" | "user" | "bot" = "user"
): Promise<string> {
  return new SignJWT({ sub: username, role })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecretKey());
}

/**
 * 验证 JWT 令牌并返回用户名
 *
 * @param {string} token - JWT 令牌字符串
 * @returns {Promise<string|undefined>} 用户名，验证失败时返回 undefined
 */
export async function verifyJwtToken(token: string): Promise<string | undefined> {
  const payload = await verifyJwtPayload(token);
  return payload.sub;
}

/**
 * 验证 JWT 令牌并返回完整载荷
 *
 * @param {string} token - JWT 令牌字符串
 * @returns {Promise<JWTPayload>} 解码后的 JWT 载荷
 * @throws {Error} 令牌无效或过期时抛出
 */
export async function verifyJwtPayload(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJwtSecretKey(), { algorithms: [JWT_ALGORITHM] });
  return payload as JWTPayload;
}
