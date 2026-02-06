/**
 * 瀹夊叏 API 璺敱绀轰緥
 * 
 */

import { NextRequest } from "next/server";
import {
  createJsonResponse,
  rateLimitMiddleware,
  validateRequestMiddleware,
  
  createSecurityContext,
  securityLog,
} from "@/lib/security-middleware";
import { detectSqlInjection, isValidUsername, validatePassword } from "@/lib/security";

/**
 * GET 璇锋眰绀轰緥 - 甯﹂€熺巼闄愬埗
 */
export async function GET(req: NextRequest) {
  // 1. 閫熺巼闄愬埗妫€鏌?
  const rateLimitResult = rateLimitMiddleware(req);
  if (rateLimitResult) return rateLimitResult;
  
  // 2. 鑾峰彇瀹夊叏涓婁笅鏂囷紙鐢ㄤ簬鏃ュ織锛?
  const context = await createSecurityContext(req);
  securityLog("secure_example_access", context);
  
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  
  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
    return createJsonResponse(
      { error: "Invalid pagination parameters" },
      400
    );
  }
  
  return createJsonResponse({
    message: "Secure API response",
    data: { page, limit },
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST 璇锋眰绀轰緥 - 甯﹁璇佸拰璇锋眰浣撻獙璇?
 */
export async function POST(req: NextRequest) {
  // 1. 閫熺巼闄愬埗妫€鏌?
  const rateLimitResult = rateLimitMiddleware(req);
  if (rateLimitResult) return rateLimitResult;
  
  // 2. 璁よ瘉妫€鏌ワ紙濡傛灉闇€瑕侊級
  // const user = await authMiddleware(req);
  // if (user instanceof Response) return user;
  
  // 3. 瑙ｆ瀽璇锋眰浣?
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonResponse(
      { error: "Invalid JSON body" },
      400
    );
  }
  
  // 4. 楠岃瘉璇锋眰浣?
  const validation = validateRequestMiddleware<{
    action: string;
    username: string;
    password?: string;
    query?: string;
  }>(body, {
    action: {
      required: true,
      type: "string",
      pattern: /^(create|update|delete|search)$/,
    },
    username: {
      required: true,
      type: "string",
      minLength: 3,
      maxLength: 30,
      validator: (value) => {
        if (!isValidUsername(value)) {
          return "Username must be 3-30 characters, alphanumeric with underscores and hyphens only";
        }
        return true;
      },
    },
    password: {
      required: false,
      type: "string",
      validator: (value) => {
        const result = validatePassword(value);
        if (!result.valid) {
          return result.errors.join("; ");
        }
        return true;
      },
    },
    query: {
      required: false,
      type: "string",
      maxLength: 200,
    },
  });
  
  if (!validation.valid) {
    return validation.response;
  }
  
  const { action, username, password, query } = validation.data;
  
  // 5. SQL 娉ㄥ叆妫€鏌ワ紙瀵规煡璇㈠弬鏁帮級
  if (query && detectSqlInjection(query)) {
    const context = await createSecurityContext(req);
    securityLog("sql_injection_detected", context, { query, action });
    
    return createJsonResponse(
      { error: "Invalid query parameter" },
      400
    );
  }
  
  // 6. 鑾峰彇瀹夊叏涓婁笅鏂囧苟璁板綍
  const context = await createSecurityContext(req);
  securityLog("secure_example_action", context, { 
    action, 
    username,
    hasPassword: !!password,
    hasQuery: !!query,
  });
  
  return createJsonResponse({
    success: true,
    message: "Action processed securely",
    data: {
      action,
      username,
      // 姘歌繙涓嶈杩斿洖瀵嗙爜锛?
      query: query ? `${query.substring(0, 20)}...` : undefined,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * 浣跨敤绀轰緥锛?
 * 
 * GET /api/secure-example?page=1&limit=20
 * 
 * POST /api/secure-example
 * Content-Type: application/json
 * 
 * {
 *   "action": "search",
 *   "username": "john_doe",
 *   "query": "example search"
 * }
 */
