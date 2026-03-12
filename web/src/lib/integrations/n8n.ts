import "server-only";

import { randomUUID } from "crypto";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { resolveApiConfig } from "@/lib/api-registry";
import { agentPlatformRepository } from "@/lib/repositories";

export const CONTENT_EVENT_TYPES = [
  "content.draft.created",
  "content.post.published",
  "content.video.ready",
] as const;

export type ContentEventType = (typeof CONTENT_EVENT_TYPES)[number];

function nowIso() {
  return new Date().toISOString();
}

export async function dispatchContentEvent(
  username: string,
  input: {
    eventType: ContentEventType;
    payload: Record<string, unknown>;
    goalId?: string | null;
    targetUrl?: string;
  }
) {
  const resolved = await resolveApiConfig("n8n_dispatch");
  const targetUrl = (input.targetUrl || resolved?.webhook_url || resolved?.base_url || "").trim();
  if (!targetUrl) {
    throw new ApiError(ErrorCode.BAD_REQUEST, "N8N_WEBHOOK_URL is not configured");
  }

  const id = `delivery_${randomUUID().replace(/-/g, "")}`;
  const ts = nowIso();

  await agentPlatformRepository.createContentDelivery({
    id,
    username,
    goalId: input.goalId || null,
    eventType: input.eventType,
    targetUrl,
    status: "pending",
    payloadJson: JSON.stringify(input.payload),
    ts,
  });

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(resolved?.auth_scheme === "bearer" && resolved.api_key
          ? { Authorization: `Bearer ${resolved.api_key}` }
          : {}),
        ...(resolved?.auth_scheme === "token" && resolved.token
          ? { Authorization: `Bearer ${resolved.token}` }
          : {}),
        ...(resolved?.extra_headers || {}),
      },
      body: JSON.stringify({
        event_type: input.eventType,
        goal_id: input.goalId || null,
        username,
        payload: input.payload,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const bodyText = await res.text().catch(() => "");
    await agentPlatformRepository.updateContentDelivery({
      id,
      status: res.ok ? "sent" : "failed",
      responseCode: res.status,
      responseBodyPreview: bodyText.slice(0, 500),
      ts: nowIso(),
    });

    if (!res.ok) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "n8n webhook request failed", {
        status: res.status,
        body: bodyText.slice(0, 200),
      });
    }

    return {
      delivery_id: id,
      status: "sent",
      response_code: res.status,
      target_url: targetUrl,
    };
  } catch (error) {
    if (!(error instanceof ApiError)) {
      await agentPlatformRepository.updateContentDelivery({
        id,
        status: "failed",
        responseBodyPreview: error instanceof Error ? error.message.slice(0, 500) : "unknown_error",
        ts: nowIso(),
      });
    }
    throw error;
  }
}

export async function listRecentContentDeliveries(username: string, goalId?: string | null) {
  if (typeof agentPlatformRepository.listContentDeliveries !== "function") {
    return [];
  }

  const items = await agentPlatformRepository.listContentDeliveries(username, goalId, 8);
  return items.map((item) => ({
    id: item.id,
    goal_id: item.goal_id,
    event_type: item.event_type,
    target_url: item.target_url,
    status: item.status,
    response_code: item.response_code,
    response_body_preview: item.response_body_preview,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}
