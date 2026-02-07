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
