/**
 * 安全示例 API
 *
 * 演示多种安全特性的示例接口，包括：
 * - 速率限制
 * - 安全上下文创建
 * - SQL 注入检测
 * - 用户名和密码验证
 *
 * @route /api/secure-example
 * @method GET - 测试安全特性的查询接口
 * @method POST - 测试安全特性的操作接口
 */
import { NextRequest } from "next/server";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, validateQuery, z } from "@/lib/validate";
import {
  rateLimitMiddleware,
  createSecurityContext,
  securityLog,
} from "@/lib/security-middleware";
import { detectSqlInjection, isValidUsername, validatePassword } from "@/lib/security";

const getQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const postSchema = z.object({
  action: z.enum(["create", "update", "delete", "search"]),
  username: z
    .string()
    .min(3)
    .max(30)
    .refine((value) => isValidUsername(value), "Invalid username format"),
  password: z
    .string()
    .optional()
    .refine((value) => {
      if (!value) return true;
      return validatePassword(value).valid;
    }, "Invalid password format"),
  query: z.string().max(200).optional(),
});

/**
 * 安全示例 GET 请求
 *
 * 测试速率限制和安全上下文记录功能
 *
 * @param {NextRequest} req - Next.js 请求对象
 * @returns {Response} 包含分页参数的安全响应
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const rateLimitResult = rateLimitMiddleware(req);
  if (rateLimitResult) return rateLimitResult;

  const context = await createSecurityContext(req);
  securityLog("secure_example_access", context);

  const { page, limit } = await validateQuery(req, getQuerySchema);

  return successResponse({
    message: "Secure API response",
    data: { page, limit },
    timestamp: new Date().toISOString(),
  });
});

/**
 * 安全示例 POST 请求
 *
 * 执行安全操作，包括用户名验证、密码验证和 SQL 注入检测
 *
 * @param {NextRequest} req - Next.js 请求对象
 * @returns {Response} 处理结果的安全响应
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const rateLimitResult = rateLimitMiddleware(req);
  if (rateLimitResult) return rateLimitResult;

  const body = await validateBody(req, postSchema);
  const { action, username, password, query } = body;

  if (query && detectSqlInjection(query)) {
    const context = await createSecurityContext(req);
    securityLog("sql_injection_detected", context, { query, action });
    return errorResponses.badRequest("Invalid query parameter");
  }

  const context = await createSecurityContext(req);
  securityLog("secure_example_action", context, {
    action,
    username,
    hasPassword: !!password,
    hasQuery: !!query,
  });

  return successResponse({
    message: "Action processed securely",
    data: {
      action,
      username,
      query: query ? `${query.substring(0, 20)}...` : undefined,
    },
    timestamp: new Date().toISOString(),
  });
});
