import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

function resolveChatCompletionsUrl(rawEndpoint: string): string {
  const input = rawEndpoint.trim();
  if (!input) return "";

  const url = new URL(input);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path || path === "/") {
    url.pathname = "/v1/chat/completions";
    return url.toString();
  }
  if (path.endsWith("/v1/chat/completions")) {
    return url.toString();
  }
  if (path === "/v1") {
    url.pathname = "/v1/chat/completions";
    return url.toString();
  }
  url.pathname = `${path}/v1/chat/completions`;
  return url.toString();
}

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const endpointRaw = process.env.AGENT_LLM_ENDPOINT?.trim() || "";
  const apiKey = process.env.AGENT_LLM_API_KEY?.trim() || "";
  const model = process.env.AGENT_LLM_MODEL?.trim() || "gemini-3-pro";

  if (!endpointRaw) {
    return successResponse({
      ok: false,
      reason: "missing_endpoint",
      message: "未配置 AGENT_LLM_ENDPOINT",
    });
  }
  if (!apiKey) {
    return successResponse({
      ok: false,
      reason: "missing_api_key",
      message: "未配置 AGENT_LLM_API_KEY",
    });
  }

  const endpoint = resolveChatCompletionsUrl(endpointRaw);
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text().catch(() => "");
    return successResponse({
      ok: res.ok,
      endpoint,
      model,
      latency_ms: Date.now() - start,
      provider_status: res.status,
      provider_body_preview: text.slice(0, 300),
    });
  } catch (error: any) {
    const code = error?.cause?.code || error?.code || "";
    const name = error?.name || "Error";
    const message =
      name === "AbortError"
        ? "连接超时（15s）"
        : error?.message || "请求失败";

    return successResponse({
      ok: false,
      endpoint,
      model,
      latency_ms: Date.now() - start,
      error_name: name,
      error_code: code,
      message,
    });
  }
});

