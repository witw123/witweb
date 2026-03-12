import "server-only";

import { randomUUID } from "crypto";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { agentConfig, apiConfig } from "@/lib/config";
import { recordAdminAudit } from "@/lib/admin-audit";
import { decryptFromString, encryptToString, maskSensitiveValue } from "@/lib/security";
import { apiRegistryRepository, type ApiBindingRow, type ApiConnectionRow, type ApiProviderRow } from "@/lib/repositories";

export const API_CAPABILITIES = [
  "agent_llm",
  "prompt_test",
  "embedding",
  "video_generation",
  "dify_runtime",
  "n8n_dispatch",
] as const;

export type ApiCapability = (typeof API_CAPABILITIES)[number];
export type ProviderCode =
  | "openai"
  | "gemini"
  | "deepseek"
  | "dashscope"
  | "openrouter"
  | "anthropic"
  | "dify"
  | "n8n"
  | "custom_openai"
  | "custom_webhook";

export interface ApiProvider {
  id: string;
  code: ProviderCode | string;
  name: string;
  category: string;
  protocol_type: string;
  auth_scheme: string;
  docs_url: string;
  default_base_url: string;
  supports_models: boolean;
  supports_custom_headers: boolean;
  supports_webhook: boolean;
  is_builtin: boolean;
  enabled: boolean;
  config_schema: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApiConnection {
  id: string;
  provider_id: string;
  provider_code: string;
  provider_name: string;
  provider_protocol_type: string;
  provider_auth_scheme: string;
  name: string;
  base_url: string;
  model: string;
  organization_id: string;
  project_id: string;
  api_version: string;
  status: string;
  is_default_candidate: boolean;
  public_config: Record<string, unknown>;
  has_secret: boolean;
  masked_secret: string | null;
  last_checked_at: string | null;
  last_check_status: string;
  last_check_message: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ApiBinding {
  capability: ApiCapability;
  connection_id: string | null;
  connection_name: string | null;
  provider_name: string | null;
  provider_code: string | null;
  model_override: string;
  enabled: boolean;
  updated_by: string;
  updated_at: string;
  source: "binding" | "env" | "unconfigured";
}

export interface ResolvedApiConfig {
  capability: ApiCapability;
  source: "binding" | "env";
  provider_code: string;
  protocol_type: string;
  auth_scheme: string;
  base_url: string;
  model: string;
  api_key?: string;
  token?: string;
  secret?: string;
  organization_id?: string;
  project_id?: string;
  api_version?: string;
  webhook_url?: string;
  extra_headers?: Record<string, string>;
  app_id?: string;
  workflow_id?: string;
  connection_id?: string;
  connection_name?: string;
}

type SecretConfig = {
  api_key?: string;
  token?: string;
  secret?: string;
  extra_headers?: Record<string, string>;
  webhook_url?: string;
};

type ConnectionInput = {
  provider_id: string;
  name: string;
  base_url?: string;
  model?: string;
  organization_id?: string;
  project_id?: string;
  api_version?: string;
  status?: string;
  is_default_candidate?: boolean;
  public_config?: Record<string, unknown>;
  secret_config?: SecretConfig;
};

function nowIso() {
  return new Date().toISOString();
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function decryptSecretConfig(raw: string): SecretConfig {
  if (!raw) return {};
  try {
    return parseJson<SecretConfig>(decryptFromString(raw), {});
  } catch {
    return {};
  }
}

function encryptSecretConfig(secret: SecretConfig) {
  const compact: SecretConfig = {};
  if (secret.api_key) compact.api_key = secret.api_key.trim();
  if (secret.token) compact.token = secret.token.trim();
  if (secret.secret) compact.secret = secret.secret.trim();
  if (secret.webhook_url) compact.webhook_url = secret.webhook_url.trim();
  if (secret.extra_headers && Object.keys(secret.extra_headers).length > 0) compact.extra_headers = secret.extra_headers;
  if (Object.keys(compact).length === 0) return "";
  return encryptToString(JSON.stringify(compact));
}

function maskSecret(secret: SecretConfig) {
  const raw = secret.api_key || secret.token || secret.secret || "";
  return raw ? maskSensitiveValue(raw) : null;
}

function toProvider(row: ApiProviderRow): ApiProvider {
  return {
    ...row,
    code: row.code,
    config_schema: parseJson(row.config_schema_json, {}),
  };
}

function toConnection(
  row:
    | (ApiConnectionRow & {
        provider_name: string;
        provider_code: string;
        provider_protocol_type: string;
        provider_auth_scheme: string;
      })
    | null
): ApiConnection | null {
  if (!row) return null;
  const secret = decryptSecretConfig(row.secret_config_encrypted);
  return {
    id: row.id,
    provider_id: row.provider_id,
    provider_code: row.provider_code,
    provider_name: row.provider_name,
    provider_protocol_type: row.provider_protocol_type,
    provider_auth_scheme: row.provider_auth_scheme,
    name: row.name,
    base_url: row.base_url,
    model: row.model,
    organization_id: row.organization_id,
    project_id: row.project_id,
    api_version: row.api_version,
    status: row.status,
    is_default_candidate: row.is_default_candidate,
    public_config: parseJson(row.public_config_json, {}),
    has_secret: Boolean(row.secret_config_encrypted),
    masked_secret: maskSecret(secret),
    last_checked_at: row.last_checked_at,
    last_check_status: row.last_check_status,
    last_check_message: row.last_check_message,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getEnvFallback(capability: ApiCapability): ResolvedApiConfig | null {
  if (capability === "agent_llm" || capability === "prompt_test" || capability === "embedding") {
    if (agentConfig.providers.openai.apiKey) {
      return {
        capability,
        source: "env",
        provider_code: "openai",
        protocol_type: "openai_compatible",
        auth_scheme: "bearer",
        base_url: agentConfig.providers.openai.baseUrl,
        model: "gpt-4.1-mini",
        api_key: agentConfig.providers.openai.apiKey,
      };
    }
    if (agentConfig.providers.deepseek.apiKey) {
      return {
        capability,
        source: "env",
        provider_code: "deepseek",
        protocol_type: "openai_compatible",
        auth_scheme: "bearer",
        base_url: agentConfig.providers.deepseek.baseUrl,
        model: "deepseek-chat",
        api_key: agentConfig.providers.deepseek.apiKey,
      };
    }
    if (agentConfig.providers.dashscope.apiKey) {
      return {
        capability,
        source: "env",
        provider_code: "dashscope",
        protocol_type: "openai_compatible",
        auth_scheme: "bearer",
        base_url: agentConfig.providers.dashscope.baseUrl,
        model: "qwen-plus",
        api_key: agentConfig.providers.dashscope.apiKey,
      };
    }
    if (agentConfig.providers.gemini.apiKey) {
      return {
        capability,
        source: "env",
        provider_code: "gemini",
        protocol_type: "openai_compatible",
        auth_scheme: "bearer",
        base_url: agentConfig.providers.gemini.baseUrl,
        model: "gemini-2.5-flash",
        api_key: agentConfig.providers.gemini.apiKey,
      };
    }
    if (agentConfig.apiKey && agentConfig.endpoint) {
      return {
        capability,
        source: "env",
        provider_code: "custom_openai",
        protocol_type: "openai_compatible",
        auth_scheme: "bearer",
        base_url: agentConfig.endpoint,
        model: agentConfig.model || "gemini-3-pro",
        api_key: agentConfig.apiKey,
      };
    }
  }

  if (capability === "n8n_dispatch" && agentConfig.integrations.n8nWebhookUrl) {
    return {
      capability,
      source: "env",
      provider_code: "n8n",
      protocol_type: "webhook",
      auth_scheme: "token",
      base_url: agentConfig.integrations.n8nWebhookUrl,
      webhook_url: agentConfig.integrations.n8nWebhookUrl,
      model: "",
    };
  }

  if (capability === "dify_runtime" && agentConfig.integrations.difyBaseUrl && agentConfig.integrations.difyApiKey) {
    return {
      capability,
      source: "env",
      provider_code: "dify",
      protocol_type: "dify",
      auth_scheme: "bearer",
      base_url: agentConfig.integrations.difyBaseUrl,
      model: "",
      api_key: agentConfig.integrations.difyApiKey,
    };
  }

  if (capability === "video_generation") {
    if (apiConfig.sora2.apiKey && apiConfig.sora2.baseUrl) {
      return {
        capability,
        source: "env",
        provider_code: "custom_webhook",
        protocol_type: "webhook",
        auth_scheme: "bearer",
        base_url: apiConfig.sora2.baseUrl,
        model: "sora-2",
        api_key: apiConfig.sora2.apiKey,
      };
    }
    if (apiConfig.grsai.token) {
      return {
        capability,
        source: "env",
        provider_code: "custom_webhook",
        protocol_type: "webhook",
        auth_scheme: "bearer",
        base_url: apiConfig.grsai.domesticUrl,
        model: "sora-2",
        token: apiConfig.grsai.token,
      };
    }
  }

  return null;
}

export async function listApiProviders() {
  const rows = await apiRegistryRepository.listProviders();
  return rows.map(toProvider);
}

export async function listApiConnections() {
  const rows = await apiRegistryRepository.listConnections();
  return rows.map(toConnection).filter((item): item is ApiConnection => Boolean(item));
}

export async function listApiBindings() {
  const rows = await apiRegistryRepository.listBindings();
  return API_CAPABILITIES.map((capability) => {
    const found = rows.find((row) => row.capability === capability);
    if (found) {
      return {
        capability,
        connection_id: found.connection_id,
        connection_name: found.connection_name,
        provider_name: found.provider_name,
        provider_code: found.provider_code,
        model_override: found.model_override,
        enabled: found.enabled,
        updated_by: found.updated_by,
        updated_at: found.updated_at,
        source: "binding",
      } satisfies ApiBinding;
    }
    return {
      capability,
      connection_id: null,
      connection_name: null,
      provider_name: null,
      provider_code: null,
      model_override: "",
      enabled: false,
      updated_by: "",
      updated_at: "",
      source: getEnvFallback(capability) ? "env" : "unconfigured",
    } satisfies ApiBinding;
  });
}

export async function createApiProvider(
  actor: string,
  input: {
    code: string;
    name: string;
    category: string;
    protocol_type: string;
    auth_scheme: string;
    docs_url?: string;
    default_base_url?: string;
    supports_models?: boolean;
    supports_custom_headers?: boolean;
    supports_webhook?: boolean;
    enabled?: boolean;
    config_schema?: Record<string, unknown>;
  },
  req?: Request
) {
  const existing = await apiRegistryRepository.getProviderByCode(input.code);
  if (existing) {
    throw new ApiError(ErrorCode.CONFLICT, "Provider code already exists");
  }

  const ts = nowIso();
  const row: ApiProviderRow = {
    id: `provider_${randomUUID().replace(/-/g, "")}`,
    code: input.code.trim(),
    name: input.name.trim(),
    category: input.category.trim(),
    protocol_type: input.protocol_type.trim(),
    auth_scheme: input.auth_scheme.trim(),
    docs_url: (input.docs_url || "").trim(),
    default_base_url: (input.default_base_url || "").trim(),
    supports_models: Boolean(input.supports_models),
    supports_custom_headers: Boolean(input.supports_custom_headers),
    supports_webhook: Boolean(input.supports_webhook),
    is_builtin: false,
    enabled: input.enabled !== false,
    config_schema_json: JSON.stringify(input.config_schema || {}),
    created_at: ts,
    updated_at: ts,
  };
  await apiRegistryRepository.createProvider(row);
  await recordAdminAudit({
    actor,
    action: "admin.api_provider.create",
    targetType: "system",
    targetId: row.id,
    detail: { code: row.code, name: row.name },
    req,
  });
  return toProvider(row);
}

export async function updateApiProvider(
  id: string,
  actor: string,
  input: {
    name?: string;
    category?: string;
    protocol_type?: string;
    auth_scheme?: string;
    docs_url?: string;
    default_base_url?: string;
    supports_models?: boolean;
    supports_custom_headers?: boolean;
    supports_webhook?: boolean;
    enabled?: boolean;
    config_schema?: Record<string, unknown>;
  },
  req?: Request
) {
  const provider = await apiRegistryRepository.getProviderById(id);
  if (!provider) throw new ApiError(ErrorCode.NOT_FOUND, "Provider not found");
  await apiRegistryRepository.updateProvider(id, {
    name: input.name?.trim(),
    category: input.category?.trim(),
    protocol_type: input.protocol_type?.trim(),
    auth_scheme: input.auth_scheme?.trim(),
    docs_url: input.docs_url?.trim(),
    default_base_url: input.default_base_url?.trim(),
    supports_models: input.supports_models,
    supports_custom_headers: input.supports_custom_headers,
    supports_webhook: input.supports_webhook,
    enabled: input.enabled,
    config_schema_json: input.config_schema ? JSON.stringify(input.config_schema) : undefined,
    updated_at: nowIso(),
  });
  await recordAdminAudit({
    actor,
    action: "admin.api_provider.update",
    targetType: "system",
    targetId: id,
    detail: input,
    req,
  });
  return toProvider((await apiRegistryRepository.getProviderById(id)) as ApiProviderRow);
}

export async function createApiConnection(actor: string, input: ConnectionInput, req?: Request) {
  const provider = await apiRegistryRepository.getProviderById(input.provider_id);
  if (!provider) throw new ApiError(ErrorCode.NOT_FOUND, "Provider not found");

  const ts = nowIso();
  const row: ApiConnectionRow = {
    id: `conn_${randomUUID().replace(/-/g, "")}`,
    provider_id: input.provider_id,
    name: input.name.trim(),
    base_url: (input.base_url || provider.default_base_url || "").trim(),
    model: (input.model || "").trim(),
    organization_id: (input.organization_id || "").trim(),
    project_id: (input.project_id || "").trim(),
    api_version: (input.api_version || "").trim(),
    status: input.status || "active",
    is_default_candidate: Boolean(input.is_default_candidate),
    public_config_json: JSON.stringify(input.public_config || {}),
    secret_config_encrypted: encryptSecretConfig(input.secret_config || {}),
    last_checked_at: null,
    last_check_status: "unknown",
    last_check_message: "",
    created_by: actor,
    created_at: ts,
    updated_at: ts,
  };
  await apiRegistryRepository.createConnection(row);
  await recordAdminAudit({
    actor,
    action: "admin.api_connection.create",
    targetType: "system",
    targetId: row.id,
    detail: { provider_id: row.provider_id, name: row.name },
    req,
  });
  return await getApiConnection(idOrThrow(row.id));
}

function idOrThrow(id: string) {
  if (!id) throw new ApiError(ErrorCode.INTERNAL_ERROR, "missing_id");
  return id;
}

export async function getApiConnection(id: string) {
  const row = await apiRegistryRepository.getConnectionById(id);
  const connection = toConnection(row);
  if (!connection) throw new ApiError(ErrorCode.NOT_FOUND, "Connection not found");
  return connection;
}

export async function updateApiConnection(id: string, actor: string, input: Partial<ConnectionInput>, req?: Request) {
  const existing = await apiRegistryRepository.getConnectionById(id);
  if (!existing) throw new ApiError(ErrorCode.NOT_FOUND, "Connection not found");
  const currentSecret = decryptSecretConfig(existing.secret_config_encrypted);
  const nextSecret =
    input.secret_config !== undefined
      ? {
          ...currentSecret,
          ...Object.fromEntries(
            Object.entries(input.secret_config).filter(([, value]) => value !== undefined && value !== "")
          ),
        }
      : currentSecret;

  await apiRegistryRepository.updateConnection(id, {
    provider_id: input.provider_id,
    name: input.name?.trim(),
    base_url: input.base_url?.trim(),
    model: input.model?.trim(),
    organization_id: input.organization_id?.trim(),
    project_id: input.project_id?.trim(),
    api_version: input.api_version?.trim(),
    status: input.status,
    is_default_candidate: input.is_default_candidate,
    public_config_json: input.public_config ? JSON.stringify(input.public_config) : undefined,
    secret_config_encrypted: input.secret_config !== undefined ? encryptSecretConfig(nextSecret) : undefined,
    updated_at: nowIso(),
  });
  await recordAdminAudit({
    actor,
    action: "admin.api_connection.update",
    targetType: "system",
    targetId: id,
    detail: {
      provider_id: input.provider_id,
      name: input.name,
      status: input.status,
    },
    req,
  });
  return await getApiConnection(id);
}

export async function deleteApiConnection(id: string, actor: string, req?: Request) {
  const bindingCount = await apiRegistryRepository.countBindingsByConnection(id);
  if (bindingCount > 0) {
    throw new ApiError(ErrorCode.CONFLICT, "Connection is still bound to one or more capabilities");
  }
  const result = await apiRegistryRepository.deleteConnection(id);
  if (!result.changes) throw new ApiError(ErrorCode.NOT_FOUND, "Connection not found");
  await recordAdminAudit({
    actor,
    action: "admin.api_connection.delete",
    targetType: "system",
    targetId: id,
    req,
  });
  return { ok: true };
}

export async function updateApiBinding(
  capability: ApiCapability,
  actor: string,
  input: { connection_id?: string | null; model_override?: string; enabled?: boolean },
  req?: Request
) {
  if (!API_CAPABILITIES.includes(capability)) {
    throw new ApiError(ErrorCode.BAD_REQUEST, "Unsupported capability");
  }
  if (input.connection_id) {
    const connection = await apiRegistryRepository.getConnectionById(input.connection_id);
    if (!connection) throw new ApiError(ErrorCode.NOT_FOUND, "Connection not found");
  }
  const row: ApiBindingRow = {
    capability,
    connection_id: input.connection_id || null,
    model_override: (input.model_override || "").trim(),
    enabled: input.enabled !== false,
    updated_by: actor,
    updated_at: nowIso(),
  };
  await apiRegistryRepository.upsertBinding(row);
  await recordAdminAudit({
    actor,
    action: "admin.api_binding.update",
    targetType: "system",
    targetId: capability,
    detail: { ...row },
    req,
  });
  return (await listApiBindings()).find((item) => item.capability === capability);
}

export async function resolveApiConfig(capability: ApiCapability): Promise<ResolvedApiConfig | null> {
  const binding = await apiRegistryRepository.getBinding(capability);
  if (binding) {
    if (!binding.enabled) {
      return null;
    }

    if (binding.connection_id) {
      const connection = await apiRegistryRepository.getConnectionById(binding.connection_id);
      if (connection && connection.status === "active") {
        const secret = decryptSecretConfig(connection.secret_config_encrypted);
        const publicConfig = parseJson<Record<string, unknown>>(connection.public_config_json, {});
        const webhookUrl =
          typeof publicConfig.webhook_url === "string"
            ? publicConfig.webhook_url
            : secret.webhook_url || connection.base_url;

        return {
          capability,
          source: "binding",
          provider_code: connection.provider_code,
          protocol_type: connection.provider_protocol_type,
          auth_scheme: connection.provider_auth_scheme,
          base_url: connection.base_url,
          model: binding.model_override || connection.model,
          api_key: secret.api_key,
          token: secret.token,
          secret: secret.secret,
          organization_id: connection.organization_id || undefined,
          project_id: connection.project_id || undefined,
          api_version: connection.api_version || undefined,
          extra_headers: secret.extra_headers,
          webhook_url: webhookUrl || undefined,
          app_id: typeof publicConfig.app_id === "string" ? publicConfig.app_id : undefined,
          workflow_id: typeof publicConfig.workflow_id === "string" ? publicConfig.workflow_id : undefined,
          connection_id: connection.id,
          connection_name: connection.name,
        };
      }

      return null;
    }

    return getEnvFallback(capability);
  }

  return getEnvFallback(capability);
}

function buildHeaders(config: ResolvedApiConfig) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.auth_scheme === "bearer" && config.api_key) {
    headers.Authorization = `Bearer ${config.api_key}`;
  }
  if (config.auth_scheme === "token" && config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }
  if (config.protocol_type === "anthropic") {
    if (config.api_key) headers["x-api-key"] = config.api_key;
    headers["anthropic-version"] = config.api_version || "2023-06-01";
    delete headers.Authorization;
  }
  Object.assign(headers, config.extra_headers || {});
  return headers;
}

async function readResponseDetail(res: Response) {
  const text = (await res.text()).trim();
  if (!text) return "";

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error === "object") {
      const nested = parsed.error as Record<string, unknown>;
      if (typeof nested.message === "string") return nested.message;
      return JSON.stringify(parsed.error);
    }
    if (typeof parsed.message === "string") return parsed.message;
    return JSON.stringify(parsed);
  } catch {
    return text.slice(0, 300);
  }
}

function buildAnthropicTestEndpoints(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "");
  const endpoints = [base.endsWith("/messages") ? base : `${base}/messages`];

  if (!base.endsWith("/v1") && !base.endsWith("/v1/messages")) {
    endpoints.push(base.endsWith("/messages") ? `${base.slice(0, -"/messages".length)}/v1/messages` : `${base}/v1/messages`);
  }

  return Array.from(new Set(endpoints));
}

export async function testApiConnection(id: string, actor: string, req?: Request) {
  const row = await apiRegistryRepository.getConnectionById(id);
  if (!row) throw new ApiError(ErrorCode.NOT_FOUND, "Connection not found");
  const secret = decryptSecretConfig(row.secret_config_encrypted);
  const publicConfig = parseJson<Record<string, unknown>>(row.public_config_json, {});

  const resolved: ResolvedApiConfig = {
    capability: "agent_llm",
    source: "binding",
    provider_code: row.provider_code,
    protocol_type: row.provider_protocol_type,
    auth_scheme: row.provider_auth_scheme,
    base_url: row.base_url,
    model: row.model,
    api_key: secret.api_key,
    token: secret.token,
    secret: secret.secret,
    organization_id: row.organization_id || undefined,
    project_id: row.project_id || undefined,
    api_version: row.api_version || undefined,
    extra_headers: secret.extra_headers,
    webhook_url: typeof publicConfig.webhook_url === "string" ? publicConfig.webhook_url : secret.webhook_url,
    app_id: typeof publicConfig.app_id === "string" ? publicConfig.app_id : undefined,
    workflow_id: typeof publicConfig.workflow_id === "string" ? publicConfig.workflow_id : undefined,
    connection_id: row.id,
    connection_name: row.name,
  };

  const startedAt = nowIso();
  try {
    let message = "Connection OK";
    if (resolved.protocol_type === "webhook") {
      const target = resolved.webhook_url || resolved.base_url;
      const res = await fetch(target, {
        method: "POST",
        headers: buildHeaders(resolved),
        body: JSON.stringify({ event: "connection.test", timestamp: startedAt }),
        signal: AbortSignal.timeout(10_000),
      });
      message = `HTTP ${res.status}`;
      if (!res.ok) throw new Error(message);
    } else if (resolved.protocol_type === "dify") {
      const res = await fetch(`${resolved.base_url.replace(/\/$/, "")}/v1/parameters`, {
        method: "GET",
        headers: buildHeaders(resolved),
        signal: AbortSignal.timeout(10_000),
      });
      message = `HTTP ${res.status}`;
      if (!res.ok) throw new Error(message);
    } else if (resolved.protocol_type === "anthropic") {
      let lastError = "";
      let connected = false;

      for (const endpoint of buildAnthropicTestEndpoints(resolved.base_url)) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: buildHeaders(resolved),
          body: JSON.stringify({
            model: resolved.model || "claude-3-5-sonnet-latest",
            max_tokens: 16,
            messages: [
              {
                role: "user",
                content: [{ type: "text", text: "ping" }],
              },
            ],
          }),
          signal: AbortSignal.timeout(15_000),
        });

        if (res.ok) {
          message = `HTTP ${res.status} @ ${endpoint}`;
          connected = true;
          break;
        }

        const detail = await readResponseDetail(res);
        lastError = `HTTP ${res.status} @ ${endpoint}${detail ? ` - ${detail}` : ""}`;

        if (res.status !== 404) {
          break;
        }
      }

      if (!connected) {
        throw new Error(lastError || "Anthropic compatible connection failed");
      }
    } else {
      const base = resolved.base_url.replace(/\/$/, "");
      const endpoint = base.endsWith("/chat/completions")
        ? base
        : base.endsWith("/v1") || base.endsWith("/openai")
          ? `${base}/chat/completions`
          : `${base}/chat/completions`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: buildHeaders(resolved),
        body: JSON.stringify({
          model: resolved.model || "gpt-4.1-mini",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 8,
          stream: false,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const detail = res.ok ? "" : await readResponseDetail(res);
      message = `HTTP ${res.status}${detail ? ` - ${detail}` : ""}`;
      if (!res.ok) throw new Error(message);
    }

    await apiRegistryRepository.updateConnection(id, {
      last_checked_at: startedAt,
      last_check_status: "ok",
      last_check_message: message,
      updated_at: nowIso(),
    });
    await recordAdminAudit({
      actor,
      action: "admin.api_connection.test",
      targetType: "system",
      targetId: id,
      detail: { status: "ok", message },
      req,
    });
    return { id, status: "ok", message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown test error";
    await apiRegistryRepository.updateConnection(id, {
      last_checked_at: startedAt,
      last_check_status: "failed",
      last_check_message: message.slice(0, 500),
      updated_at: nowIso(),
    });
    await recordAdminAudit({
      actor,
      action: "admin.api_connection.test",
      targetType: "system",
      targetId: id,
      detail: { status: "failed", message },
      req,
    });
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, message);
  }
}
