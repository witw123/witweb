/**
 * 图片上传客户端
 *
 * 提供前端图片上传功能，将图片发送到服务端 API
 */

import { logError } from "@/lib/logger";
import type { SuccessResponse } from "@/lib/api-response";
import { getVersionedApiPath } from "@/lib/api-version";

function readSuccessData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as Partial<SuccessResponse<T>>;
  if (parsed.success !== true) return null;
  return parsed.data ?? null;
}

/**
 * 上传图片请求
 *
 * 将 FormData 中的图片上传到服务器，返回图片 URL
 * 失败时记录错误日志并抛出异常
 *
 * @param input.formData - 包含图片的 FormData
 * @param input.source - 调用来源标识
 * @param input.context - 额外上下文信息（可选）
 * @param input.fallbackMessage - 自定义错误消息（可选）
 * @returns 上传后的图片 URL
 * @throws 上传失败时抛出错误
 */
export async function uploadImageRequest(input: {
  formData: FormData;
  source: string;
  context?: Record<string, unknown>;
  fallbackMessage?: string;
}): Promise<string> {
  const response = await fetch(getVersionedApiPath("/upload/image"), {
    method: "POST",
    body: input.formData,
  });

  const payload = await response.json().catch(() => ({}));
  const data = readSuccessData<{ url: string }>(payload);
  const imageUrl = data?.url;

  if (!response.ok || !imageUrl) {
    const message =
      (payload as { error?: { message?: string } })?.error?.message ||
      input.fallbackMessage ||
      "图片上传失败。";

    logError({
      source: input.source,
      error: message,
      context: {
        status: response.status,
        ...input.context,
      },
    });

    throw new Error(message);
  }

  return imageUrl;
}
