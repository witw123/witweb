import { logError } from "@/lib/logger";
import type { SuccessResponse } from "@/lib/api-response";
import { getVersionedApiPath } from "@/lib/api-version";

function readSuccessData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as Partial<SuccessResponse<T>>;
  if (parsed.success !== true) return null;
  return parsed.data ?? null;
}

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
