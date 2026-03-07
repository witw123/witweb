import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { agentConfig } from "@/lib/config";

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

  const endpointRaw = agentConfig.endpoint;
  const apiKey = agentConfig.apiKey;
  const model = agentConfig.model || "gemini-3-pro";

  if (!endpointRaw) {
    return successResponse({
      ok: false,
      reason: "missing_endpoint",
      message: "AGENT_LLM_ENDPOINT is not configured",
    });
  }
  if (!apiKey) {
    return successResponse({
      ok: false,
      reason: "missing_api_key",
      message: "AGENT_LLM_API_KEY is not configured",
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
  } catch (error: unknown) {
    const err = error as { cause?: { code?: string }; code?: string; name?: string; message?: string } | null;
    const code = err?.cause?.code || err?.code || "";
    const name = err?.name || "Error";
    const message = name === "AbortError" ? "Connection timed out (15s)" : err?.message || "Request failed";

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
