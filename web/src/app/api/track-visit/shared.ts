/**
 * Track Visit API - 访问追踪数据处理
 *
 * 提供记录用户访问行为的功能
 * 记录访问者 ID、访问页面、用户代理和 IP 地址
 */

import { headers } from "next/headers";
import { successResponse } from "@/lib/api-response";
import { postRepository } from "@/lib/repositories";
import { validateBody, z } from "@/lib/validate";

const trackVisitSchema = z.object({
  visitorId: z.string().min(1, "Visitor ID 不能为空"),
  pageUrl: z.string().default("/"),
});

/**
 * 构建访问追踪 POST 响应
 *
 * 记录用户访问行为，包括访问页面、用户代理和 IP 地址
 * 用于站点访问统计
 *
 * @param {Request} request - HTTP 请求对象，包含 visitorId 和 pageUrl
 * @returns {Promise<Response>} 记录结果响应
 */
export async function buildTrackVisitResponse(request: Request): Promise<Response> {
  const { visitorId, pageUrl } = await validateBody(request, trackVisitSchema);

  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";

  await postRepository.recordSiteVisit(visitorId, pageUrl || "/", userAgent, ipAddress);

  return successResponse({ recorded: true });
}
