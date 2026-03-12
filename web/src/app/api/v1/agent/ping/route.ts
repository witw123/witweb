import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { resolveApiConfig } from "@/lib/api-registry";

function resolveChatCompletionsUrl(rawEndpoint: string): string {
  const input = rawEndpoint.trim();
  if (!input) return "";

  const url = new URL(input);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path || path === "/") {
    url.pathname = "/chat/completions";
    return url.toString();
  }
  if (path.endsWith("/chat/completions")) {
    return url.toString();
  }
  if (path === "/v1" || path === "/openai") {
    url.pathname = `${path}/chat/completions`;
    return url.toString();
  }
  url.pathname = `${path}/chat/completions`;
  return url.toString();
}

function resolveAnthropicUrl(rawEndpoint: string): string {
  const input = rawEndpoint.trim();
  if (!input) return "";
  const url = new URL(input);
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/messages") ? path : `${path || "/v1"}/messages`;
  return url.toString();
}

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const runtime = await resolveApiConfig("agent_llm");
  if (!runtime) {
    return successResponse({
      ok: false,
      reason: "missing_runtime_config",
      message: "Agent LLM 未配置",
    });
  }

  const endpoint =
    runtime.protocol_type === "anthropic"
      ? resolveAnthropicUrl(runtime.base_url)
      : resolveChatCompletionsUrl(runtime.base_url);
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const body =
      runtime.protocol_type === "anthropic"
        ? {
            model: runtime.model || "claude-3-5-sonnet-latest",
            max_tokens: 16,
            messages: [{ role: "user", content: "ping" }],
          }
        : {
            model: runtime.model || "gpt-4.1-mini",
            stream: false,
            messages: [{ role: "user", content: "ping" }],
          };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(runtime.extra_headers || {}),
    };

    if (runtime.protocol_type === "anthropic" && runtime.api_key) {
      headers["x-api-key"] = runtime.api_key;
      headers["anthropic-version"] = runtime.api_version || "2023-06-01";
    } else if (runtime.api_key) {
      headers.Authorization = `Bearer ${runtime.api_key}`;
    } else if (runtime.token) {
      headers.Authorization = `Bearer ${runtime.token}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text().catch(() => "");
    return successResponse({
      ok: res.ok,
      endpoint,
      model: runtime.model,
      source: runtime.source,
      provider_code: runtime.provider_code,
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
      model: runtime.model,
      source: runtime.source,
      provider_code: runtime.provider_code,
      latency_ms: Date.now() - start,
      error_name: name,
      error_code: code,
      message,
    });
  }
});
