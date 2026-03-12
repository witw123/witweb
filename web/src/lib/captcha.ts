/**
 * Cloudflare Turnstile 验证码工具
 *
 * 提供 Turnstile 验证码的验证功能，用于防止机器人攻击。
 * Turnstile 是 Cloudflare 提供的验证码服务，替代传统的 reCAPTCHA。
 *
 * @module captcha
 */

import "server-only";

/**
 * Turnstile 验证响应类型
 *
 * @interface TurnstileVerifyResponse
 */
type TurnstileVerifyResponse = {
  /** 验证是否成功 */
  success?: boolean;
  /** 错误代码列表 */
  "error-codes"?: string[];
};

/**
 * 检查环境变量是否为真值
 *
 * 将字符串环境变量转换为布尔值，支持多种真值格式：
 * "1", "true", "yes", "on"（不区分大小写）
 *
 * @param {string | undefined} value - 环境变量值
 * @returns {boolean} 转换后的布尔值
 */
function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * 检查 Turnstile 验证码是否启用
 *
 * 检查环境变量以确定是否启用 Turnstile 验证。
 * 需要同时设置 TURNSTILE_ENABLED=true 和 TURNSTILE_SECRET_KEY
 *
 * @returns {boolean} 是否启用 Turnstile 验证
 */
export function isTurnstileEnabled(): boolean {
  return isTruthy(process.env.TURNSTILE_ENABLED) && !!process.env.TURNSTILE_SECRET_KEY;
}

/**
 * 获取客户端真实 IP 地址
 *
 * 从请求头中提取客户端 IP，支持代理场景：
 * - X-Forwarded-For: 负载均衡/代理场景的首选 IP
 * - X-Real-IP: 代理服务器直接设置的客户端 IP
 *
 * @param {Request} req - HTTP 请求对象
 * @returns {string | undefined} 客户端 IP 地址，未知时返回 undefined
 */
function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return undefined;
}

/**
 * 验证 Turnstile 验证码 Token
 *
 * 向 Cloudflare Turnstile 验证服务端发送请求，验证客户端提交的 token。
 * 如果 Turnstile 未启用，直接返回 true。
 *
 * @param {Request} req - HTTP 请求对象，用于获取客户端 IP
 * @param {string | undefined} token - 客户端提交的 Turnstile token
 * @returns {Promise<boolean>} 验证是否成功
 *
 * @throws {Error} 网络请求失败时返回 false
 *
 * @example
 * const isValid = await verifyTurnstileToken(request, token);
 * if (!isValid) {
 *   return Response.json({ error: '验证失败' }, { status: 400 });
 * }
 */
export async function verifyTurnstileToken(req: Request, token: string | undefined): Promise<boolean> {
  if (!isTurnstileEnabled()) return true;
  if (!token || !token.trim()) return false;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  const ip = getClientIp(req);
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as TurnstileVerifyResponse;
    return !!data.success;
  } catch {
    return false;
  }
}
