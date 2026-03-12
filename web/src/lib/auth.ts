/**
 * 认证工具
 *
 * 提供用户认证相关的功能，包括密码哈希、令牌创建和验证
 * 支持登录、登出和会话管理
 */

import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { authConfig } from "./config";
import { createJwtToken, verifyJwtToken } from "./jwt";

/**
 * 安全警告：检查 AUTH_SECRET 长度
 *
 * 生产环境下，密钥长度应至少为 32 个字符
 * 此检查仅在服务器端执行
 */
if (typeof window === "undefined" && authConfig.secret.length > 0 && authConfig.secret.length < 32) {
  console.warn("[SECURITY WARNING] AUTH_SECRET should be at least 32 characters long for production use");
}

/**
 * 创建用户访问令牌
 *
 * 生成包含用户名和角色的 JWT 令牌
 *
 * @param {string} username - 用户名
 * @param {"super_admin"|"content_reviewer"|"operator"|"admin"|"user"|"bot"} [role="user"] - 用户角色
 * @returns {Promise<string>} JWT 令牌字符串
 */
export async function createToken(
  username: string,
  role: "super_admin" | "content_reviewer" | "operator" | "admin" | "user" | "bot" = "user"
) {
  return createJwtToken(username, authConfig.expiresIn, role);
}

/**
 * 验证 JWT 令牌
 *
 * @param {string} token - JWT 令牌字符串
 * @returns {Promise<string|undefined>} 用户名，验证失败时返回 undefined
 */
export async function verifyToken(token: string) {
  return verifyJwtToken(token);
}

/**
 * 密码哈希
 *
 * 使用 bcrypt 对密码进行哈希处理
 * 哈希强度为 10（计算成本适中）
 *
 * @param {string} password - 明文密码
 * @returns {string} 哈希后的密码
 */
export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

/**
 * 验证密码
 *
 * @param {string} password - 明文密码
 * @param {string} hash - 存储的哈希值
 * @returns {boolean} 密码是否匹配
 */
export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

/**
 * 验证请求认证
 *
 * 从请求头中提取 Bearer 令牌并验证
 *
 * @param {NextRequest} req - Next.js 请求对象
 * @returns {Promise<{username: string}|null>} 验证成功返回用户名，否则返回 null
 */
export async function verifyAuth(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7);
  try {
    const username = await verifyToken(token);
    return username ? { username } : null;
  } catch {
    return null;
  }
}
