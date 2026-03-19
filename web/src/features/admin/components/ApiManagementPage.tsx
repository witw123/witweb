"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, getErrorMessage, post, put } from "@/lib/api-client";
import type { ApiBinding, ApiCapability, ApiConnection, ApiProvider } from "@/lib/api-registry";
import AdminNotice from "./AdminNotice";

type ProvidersResponse = { items: ApiProvider[] };
type ConnectionsResponse = { items: ApiConnection[] };
type BindingsResponse = { items: ApiBinding[] };

type ApiFormat = "openai_compatible" | "anthropic";

type Draft = {
  id?: string;
  format: ApiFormat;
  provider_preset: string;
  provider_id: string;
  name: string;
  note: string;
  base_url: string;
  api_key: string;
  model: string;
  reasoning_model: string;
  api_version: string;
  capabilities: ApiCapability[];
  write_shared_config: boolean;
  hide_ai_signature: boolean;
  extended_thinking: boolean;
  teammates_mode: boolean;
  config_json: string;
};

const ALLOWED_PROVIDER_CODES = ["openai", "deepseek", "gemini", "anthropic", "custom_openai"] as const;
const PRESET_OPTIONS = [
  {
    key: "minimax_openai",
    label: "MiniMax",
    format: "openai_compatible" as const,
    providerCode: "custom_openai",
    name: "MiniMax",
    baseUrl: "https://api.minimaxi.com/v1",
    model: "MiniMax-M2.5",
  },
  {
    key: "openai",
    label: "OpenAI",
    format: "openai_compatible" as const,
    providerCode: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
  },
  {
    key: "deepseek",
    label: "DeepSeek",
    format: "openai_compatible" as const,
    providerCode: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    key: "gemini",
    label: "Gemini",
    format: "openai_compatible" as const,
    providerCode: "gemini",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-pro",
  },
  {
    key: "anthropic",
    label: "Anthropic",
    format: "anthropic" as const,
    providerCode: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet-latest",
  },
  {
    key: "custom_openai",
    label: "Custom OpenAI",
    format: "openai_compatible" as const,
    providerCode: "custom_openai",
    name: "Custom OpenAI Compatible",
    baseUrl: "",
    model: "gpt-4.1-mini",
  },
] as const;

const PROVIDER_DEFAULTS: Partial<
  Record<
    (typeof ALLOWED_PROVIDER_CODES)[number],
    {
      format: ApiFormat;
      model: string;
      base_url?: string;
      display_name?: string;
    }
  >
> = {
  openai: {
    format: "openai_compatible",
    model: "gpt-4.1-mini",
    base_url: "https://api.openai.com/v1",
    display_name: "OpenAI",
  },
  deepseek: {
    format: "openai_compatible",
    model: "deepseek-chat",
    base_url: "https://api.deepseek.com/v1",
    display_name: "DeepSeek",
  },
  gemini: {
    format: "openai_compatible",
    model: "gemini-2.5-pro",
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    display_name: "Gemini",
  },
  anthropic: {
    format: "anthropic",
    model: "claude-3-5-sonnet-latest",
    base_url: "https://api.anthropic.com/v1",
    display_name: "Anthropic",
  },
  custom_openai: {
    format: "openai_compatible",
    model: "gpt-4.1-mini",
    display_name: "Custom OpenAI Compatible",
  },
};

function defaultModelForFormat(format: ApiFormat) {
  return format === "anthropic" ? "claude-3-5-sonnet-latest" : "gpt-4.1-mini";
}

const TEXT = {
  title: "\u0041\u0050\u0049 \u7ba1\u7406",
  subtitle:
    "\u50cf cc-switch \u90a3\u6837\u5c06\u914d\u7f6e\u6536\u7f29\u5230\u6700\u5c11\uff1a\u9009\u62e9\u517c\u5bb9\u683c\u5f0f\u3001\u4f9b\u5e94\u5546\u9884\u8bbe\uff0c\u7136\u540e\u586b\u5199\u8bf7\u6c42\u5730\u5740\u3001API Key \u548c\u9ed8\u8ba4\u6a21\u578b\u3002",
  listTitle: "\u5df2\u4fdd\u5b58\u914d\u7f6e",
  listSubtitle:
    "\u70b9\u51fb\u5361\u7247\u53ef\u7ee7\u7eed\u7f16\u8f91\uff0c\u201c\u542f\u7528\u201d\u4f1a\u76f4\u63a5\u5207\u6362 Agent \u4e0e Prompt \u9ed8\u8ba4 API\u3002",
  newConfig: "\u65b0\u589e\u914d\u7f6e",
  save: "\u4fdd\u5b58",
  delete: "\u5220\u9664",
  test: "\u6d4b\u8bd5\u8fde\u63a5",
  enable: "\u542f\u7528",
  enabledNow: "\u5df2\u542f\u7528",
  edit: "\u7f16\u8f91",
  saved: "API \u914d\u7f6e\u5df2\u4fdd\u5b58\u5e76\u751f\u6548",
  deleted: "API \u914d\u7f6e\u5df2\u5220\u9664",
  enabled: "\u5df2\u8bbe\u4e3a\u9ed8\u8ba4 Agent / Prompt API",
  tested: "\u8fde\u63a5\u68c0\u6d4b\u5b8c\u6210\uff1a",
  untested: "\u672a\u68c0\u6d4b",
  noProvider: "\u5f53\u524d\u517c\u5bb9\u683c\u5f0f\u6ca1\u6709\u53ef\u7528\u7684\u4f9b\u5e94\u5546\u9884\u8bbe",
  presetLabel: "\u5feb\u6377\u9884\u8bbe",
  needName: "\u8bf7\u586b\u5199\u4f9b\u5e94\u5546\u540d\u79f0",
  needBaseUrl: "\u8bf7\u586b\u5199\u8bf7\u6c42\u5730\u5740",
  needModel: "\u8bf7\u586b\u5199\u4e3b\u6a21\u578b",
  needCapability: "\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u4f7f\u7528\u6a21\u5757",
  minimaxHint: "MiniMax OpenAI \u517c\u5bb9\u63a5\u53e3\u9ed8\u8ba4\u4f7f\u7528 https://api.minimaxi.com/v1\uff0c\u4e0d\u9700\u624b\u52a8\u586b /chat/completions\u3002",
  minimaxBaseUrlError: "MiniMax \u8bf7\u4f7f\u7528 https://api.minimaxi.com/v1 \u8fd9\u7c7b OpenAI \u517c\u5bb9\u5165\u53e3\u3002",
  endpointNormalized: "\u5df2\u81ea\u52a8\u89c4\u6574\u8bf7\u6c42\u5730\u5740\uff0c\u65e0\u9700\u624b\u586b /chat/completions\u3002",
  openaiHint:
    "\u9002\u7528\u4e8e OpenAI\u3001DeepSeek\u3001DashScope\u3001Gemini OpenAI \u517c\u5bb9\u5165\u53e3\u3002",
  anthropicHint:
    "\u9002\u7528\u4e8e Claude \u539f\u751f\u548c\u517c\u5bb9 Anthropic Messages \u7684\u670d\u52a1\u7aef\u70b9\u3002",
  configuredApis: "\u5df2\u914d\u7f6e API",
  currentFormat: "\u5f53\u524d\u517c\u5bb9\u683c\u5f0f",
  defaultAgent: "\u9ed8\u8ba4 Agent",
  envFallback: "\u73af\u5883\u53d8\u91cf",
  availableCount: "\u53ef\u7528\u72b6\u6001",
  searchPlaceholder: "\u641c\u7d22\u4f9b\u5e94\u5546\u3001\u5730\u5740\u6216\u6a21\u578b",
  noModel: "\u672a\u914d\u7f6e\u6a21\u578b",
  editConfig: "\u7f16\u8f91 API \u914d\u7f6e",
  newConfigTitle: "\u65b0\u589e API \u914d\u7f6e",
  formatLabel: "API \u683c\u5f0f",
  formatHintOpenAI: "\u9009\u62e9\u4f9b\u5e94\u5546 API \u7684 OpenAI \u517c\u5bb9\u8f93\u5165\u683c\u5f0f",
  formatHintAnthropic: "\u9009\u62e9\u4f9b\u5e94\u5546 API \u7684 Anthropic Messages \u517c\u5bb9\u8f93\u5165\u683c\u5f0f",
  providerLabel: "\u4f9b\u5e94\u5546",
  chooseProvider: "\u9009\u62e9\u4f9b\u5e94\u5546",
  providerNameLabel: "\u4f9b\u5e94\u5546\u540d\u79f0",
  providerNamePlaceholder: "\u4f8b\u5982\uff1aMiniMax / OpenAI \u751f\u4ea7",
  baseUrlLabel: "\u8bf7\u6c42\u5730\u5740",
  baseUrlHintAnthropic: "\u586b\u5199\u517c\u5bb9 Claude API \u7684\u670d\u52a1\u7aef\u5730\u5740\uff0c\u4e0d\u8981\u4ee5\u659c\u6760\u7ed3\u5c3e",
  baseUrlHintOpenAI: "\u586b\u5199 OpenAI \u517c\u5bb9 API \u7684\u670d\u52a1\u7aef\u5730\u5740\uff0c\u901a\u5e38\u4fdd\u7559\u5230 /v1",
  enterApiKey: "\u8f93\u5165 API Key",
  keepExistingSecret: "\uff08\u7559\u7a7a\u5219\u4fdd\u6301\u539f\u503c\uff09",
  modelLabel: "\u4e3b\u6a21\u578b",
  reasoningLabel: "\u63a8\u7406\u6a21\u578b\uff08\u53ef\u9009\uff09",
  reasoningPlaceholder: "\u5982\u9700\u8981\u53ef\u5355\u72ec\u914d\u7f6e",
  versionEmpty: "\u53ef\u7559\u7a7a",
  noteLabel: "\u5907\u6ce8",
  notePlaceholder: "\u4f8b\u5982\uff1a\u516c\u53f8\u4e13\u7528\u8d26\u53f7",
  capabilityLabel: "\u4f7f\u7528\u6a21\u5757",
  configJsonTitle: "\u914d\u7f6e JSON",
  writeSharedConfig: "\u5199\u5165\u901a\u7528\u914d\u7f6e",
  editSharedConfig: "\u7f16\u8f91\u901a\u7528\u914d\u7f6e",
  hideSignature: "\u9690\u85cf AI \u7f72\u540d",
  extendedThinking: "\u6269\u5c55\u601d\u8003",
  teammatesMode: "Teammates \u6a21\u5f0f",
  jsonHint:
    "\u4e0b\u9762\u7684 JSON \u4f1a\u968f\u8868\u5355\u81ea\u52a8\u751f\u6210\uff0c\u4f60\u4e5f\u53ef\u4ee5\u5728\u6b64\u57fa\u7840\u4e0a\u7ee7\u7eed\u6dfb\u52a0 env \u6216\u5176\u4ed6\u901a\u7528\u914d\u7f6e\u3002",
  invalidJson: "\u914d\u7f6e JSON \u4e0d\u662f\u5408\u6cd5\u7684 JSON",
  footerHint:
    "\u4fdd\u5b58\u540e\u4f1a\u6309\u6240\u9009\u6a21\u5757\u81ea\u52a8\u7ed1\u5b9a\uff0c\u5de6\u4fa7\u5361\u7247\u7684\u201c\u542f\u7528\u201d\u4f1a\u5feb\u901f\u5207\u5230 Agent / Prompt \u9ed8\u8ba4\u3002",
  newAnthropicConfig: "\u65b0\u5efa Anthropic \u517c\u5bb9\u914d\u7f6e",
  testCardTitle: "\u8fde\u63a5\u72b6\u6001",
  testStatus: "\u6700\u8fd1\u68c0\u6d4b",
  testMessage: "\u8fd4\u56de\u4fe1\u606f",
  testEndpoint: "\u5b9e\u9645\u547d\u4e2d\u5730\u5740",
  testBindings: "\u5f53\u524d\u7ed1\u5b9a\u6a21\u5757",
  notBound: "\u6682\u672a\u7ed1\u5b9a",
};

const FORMAT_META: Record<ApiFormat, { label: string; hint: string; apiVersionLabel: string; placeholder: string }> = {
  openai_compatible: {
    label: "OpenAI API Compatible",
    hint: TEXT.openaiHint,
    apiVersionLabel: "\u53ef\u9009\u7248\u672c",
    placeholder: "https://api.openai.com/v1",
  },
  anthropic: {
    label: "Anthropic Messages (\u539f\u751f)",
    hint: TEXT.anthropicHint,
    apiVersionLabel: "Anthropic Version",
    placeholder: "https://api.anthropic.com/v1",
  },
};

const CAPABILITY_OPTIONS: Array<{ key: ApiCapability; label: string }> = [
  { key: "agent_llm", label: "Agent \u4e3b\u6a21\u578b" },
  { key: "prompt_test", label: "Prompt \u6d4b\u8bd5" },
  { key: "embedding", label: "Embedding" },
  { key: "video_generation", label: "\u89c6\u9891\u80fd\u529b" },
  { key: "dify_runtime", label: "Dify" },
  { key: "n8n_dispatch", label: "n8n" },
];

const MANAGED_ENV_KEYS: Record<ApiFormat, string[]> = {
  openai_compatible: ["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL", "OPENAI_REASONING_MODEL", "OPENAI_API_VERSION"],
  anthropic: [
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_VERSION",
  ],
};

function parseConfigJson(text: string) {
  if (!text.trim()) return {};
  const value = JSON.parse(text);
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function buildManagedEnv(draft: Draft) {
  if (draft.format === "anthropic") {
    return {
      ANTHROPIC_AUTH_TOKEN: draft.api_key || "<YOUR_API_KEY>",
      ANTHROPIC_BASE_URL: draft.base_url || FORMAT_META.anthropic.placeholder,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: draft.model || defaultModelForFormat("anthropic"),
      ANTHROPIC_DEFAULT_OPUS_MODEL: draft.reasoning_model || draft.model || defaultModelForFormat("anthropic"),
      ANTHROPIC_DEFAULT_SONNET_MODEL: draft.model || defaultModelForFormat("anthropic"),
      ANTHROPIC_MODEL: draft.model || defaultModelForFormat("anthropic"),
      ANTHROPIC_VERSION: draft.api_version || "2023-06-01",
    };
  }

  return {
    OPENAI_API_KEY: draft.api_key || "<YOUR_API_KEY>",
    OPENAI_BASE_URL: draft.base_url || FORMAT_META.openai_compatible.placeholder,
    OPENAI_MODEL: draft.model || defaultModelForFormat("openai_compatible"),
    ...(draft.reasoning_model ? { OPENAI_REASONING_MODEL: draft.reasoning_model } : {}),
    ...(draft.api_version ? { OPENAI_API_VERSION: draft.api_version } : {}),
  };
}

function buildConfigObject(draft: Draft) {
  let existing: Record<string, unknown> = {};
  try {
    existing = parseConfigJson(draft.config_json);
  } catch {
    existing = {};
  }

  const existingEnv =
    existing.env && typeof existing.env === "object" && !Array.isArray(existing.env)
      ? (existing.env as Record<string, unknown>)
      : {};

  const extraEnv = Object.fromEntries(
    Object.entries(existingEnv).filter(([key]) => !MANAGED_ENV_KEYS[draft.format].includes(key))
  );

  const extraTopLevel = Object.fromEntries(
    Object.entries(existing).filter(([key]) => key !== "env" && key !== "features" && key !== "write_shared_config")
  );

  return {
    ...extraTopLevel,
    write_shared_config: draft.write_shared_config,
    features: {
      hide_ai_signature: draft.hide_ai_signature,
      extended_thinking: draft.extended_thinking,
      teammates_mode: draft.teammates_mode,
    },
    env: {
      ...buildManagedEnv(draft),
      ...extraEnv,
    },
  };
}

function formatConfigJson(draft: Draft) {
  return JSON.stringify(buildConfigObject(draft), null, 2);
}

function withGeneratedConfig(draft: Draft): Draft {
  return { ...draft, config_json: formatConfigJson(draft) };
}

function normalizeCompatibleBaseUrl(input: string) {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.replace(/\/chat\/completions$/i, "").replace(/\/messages$/i, "");
}

function isMiniMaxPreset(draft: Draft) {
  return draft.provider_preset === "minimax_openai";
}

function applyPresetToDraft(base: Draft, presetKey: string, providers: ApiProvider[]) {
  const preset = PRESET_OPTIONS.find((item) => item.key === presetKey);
  if (!preset) return base;
  const providerId =
    providers.find((item) => item.code === preset.providerCode && item.protocol_type === preset.format)?.id ||
    pickDefaultProviderId(preset.format, providers);

  return withGeneratedConfig({
    ...base,
    provider_preset: preset.key,
    format: preset.format,
    provider_id: providerId,
    name: preset.name,
    base_url: preset.baseUrl,
    model: preset.model,
    reasoning_model: "",
    api_version: preset.format === "anthropic" ? "2023-06-01" : "",
  });
}

function pickDefaultProviderId(format: ApiFormat, providers: ApiProvider[]) {
  const candidates = providers.filter((item) => item.protocol_type === format);
  if (format === "openai_compatible") {
    return candidates.find((item) => item.code === "custom_openai")?.id || candidates[0]?.id || "";
  }
  return candidates.find((item) => item.code === "anthropic")?.id || candidates[0]?.id || "";
}

function blankDraft(format: ApiFormat, providers: ApiProvider[]): Draft {
  return withGeneratedConfig({
    format,
    provider_preset: format === "anthropic" ? "anthropic" : "minimax_openai",
    provider_id: pickDefaultProviderId(format, providers),
    name: "",
    note: "",
    base_url: "",
    api_key: "",
    model: defaultModelForFormat(format),
    reasoning_model: "",
    api_version: format === "anthropic" ? "2023-06-01" : "",
    capabilities: ["agent_llm"],
    write_shared_config: false,
    hide_ai_signature: false,
    extended_thinking: false,
    teammates_mode: false,
    config_json: "",
  });
}

function getProviderPreset(provider: ApiProvider | null) {
  if (!provider) return null;
  return PROVIDER_DEFAULTS[provider.code as keyof typeof PROVIDER_DEFAULTS] || null;
}

function formatDate(value?: string | null) {
  if (!value) return TEXT.untested;
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function toneClass(status: string) {
  if (status === "ok" || status === "active" || status === "binding") return "success";
  if (status === "failed" || status === "error" || status === "unconfigured") return "error";
  return "muted";
}

function monogram(text: string) {
  return text
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() || "")
    .join("");
}

function toDraft(item: ApiConnection, bindings: ApiBinding[]): Draft {
  const publicConfig = item.public_config as Record<string, unknown>;
  const format = (item.provider_protocol_type as ApiFormat) || "openai_compatible";
  const configFlags =
    publicConfig.config_flags && typeof publicConfig.config_flags === "object" && !Array.isArray(publicConfig.config_flags)
      ? (publicConfig.config_flags as Record<string, unknown>)
      : {};
  const baseDraft: Draft = {
    id: item.id,
    format,
    provider_preset:
      typeof publicConfig.provider_preset === "string"
        ? publicConfig.provider_preset
        : item.name.toLowerCase().includes("minimax")
          ? "minimax_openai"
          : item.provider_code,
    provider_id: item.provider_id,
    name: item.name,
    note: typeof publicConfig.notes === "string" ? publicConfig.notes : "",
    base_url: item.base_url,
    api_key: "",
    model: item.model,
    reasoning_model: typeof publicConfig.reasoning_model === "string" ? publicConfig.reasoning_model : "",
    api_version: item.api_version || (format === "anthropic" ? "2023-06-01" : ""),
    capabilities: bindings.filter((binding) => binding.connection_id === item.id).map((binding) => binding.capability),
    write_shared_config: Boolean(publicConfig.write_shared_config),
    hide_ai_signature: Boolean(configFlags.hide_ai_signature),
    extended_thinking: Boolean(configFlags.extended_thinking),
    teammates_mode: Boolean(configFlags.teammates_mode),
    config_json:
      publicConfig.config_json && typeof publicConfig.config_json === "object"
        ? JSON.stringify(publicConfig.config_json, null, 2)
        : "",
  };

  return withGeneratedConfig(baseDraft);
}

export default function ApiManagementPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | "info">("info");
  const [search, setSearch] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const providersQuery = useQuery({
    queryKey: ["admin", "api-providers"],
    queryFn: () => get<ProvidersResponse>("/api/admin/api-providers"),
  });
  const connectionsQuery = useQuery({
    queryKey: ["admin", "api-connections"],
    queryFn: () => get<ConnectionsResponse>("/api/admin/api-connections"),
  });
  const bindingsQuery = useQuery({
    queryKey: ["admin", "api-bindings"],
    queryFn: () => get<BindingsResponse>("/api/admin/api-bindings"),
  });

  const providers = useMemo(
    () =>
      (providersQuery.data?.items ?? []).filter(
        (item) =>
          (["openai_compatible", "anthropic"] as ApiFormat[]).includes(item.protocol_type as ApiFormat) &&
          ALLOWED_PROVIDER_CODES.includes(item.code as (typeof ALLOWED_PROVIDER_CODES)[number])
      ),
    [providersQuery.data]
  );
  const connections = useMemo(
    () =>
      (connectionsQuery.data?.items ?? []).filter((item) =>
        (["openai_compatible", "anthropic"] as ApiFormat[]).includes(item.provider_protocol_type as ApiFormat)
      ),
    [connectionsQuery.data]
  );
  const bindings = bindingsQuery.data?.items ?? [];
  const defaultAgentBinding = bindings.find((item) => item.capability === "agent_llm")?.connection_id || "";
  const defaultPromptBinding = bindings.find((item) => item.capability === "prompt_test")?.connection_id || "";

  const currentDraft = draft ?? blankDraft("openai_compatible", providers);
  const providerOptions = providers.filter((item) => item.protocol_type === currentDraft.format);
  const selectedProvider = providers.find((item) => item.id === currentDraft.provider_id) ?? null;
  const selectedConnection = connections.find((item) => item.id === selectedConnectionId) ?? null;
  const selectedConnectionBindings = selectedConnection
    ? bindings.filter((item) => item.connection_id === selectedConnection.id)
    : [];

  const filteredConnections = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return connections;
    return connections.filter((item) =>
      [item.name, item.provider_name, item.base_url, item.model].join(" ").toLowerCase().includes(keyword)
    );
  }, [connections, search]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "api-connections"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "api-bindings"] }),
    ]);
  };

  const setDraftField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => {
      const next = { ...(prev ?? currentDraft), [key]: value } as Draft;
      return key === "config_json" ? next : withGeneratedConfig(next);
    });
  };

  const syncBindings = async (connectionId: string, nextCapabilities: ApiCapability[]) => {
    const nextSet = new Set(nextCapabilities);
    const previous = bindings.filter((item) => item.connection_id === connectionId).map((item) => item.capability);
    const touched = new Set<ApiCapability>([...previous, ...nextCapabilities]);

    await Promise.all(
      Array.from(touched).map((capability) =>
        put<ApiBinding>(`/api/admin/api-bindings/${capability}`, {
          connection_id: nextSet.has(capability) ? connectionId : null,
          enabled: true,
          model_override: "",
        })
      )
    );
  };

  const saveMutation = useMutation({
    mutationFn: async (input: Draft) => {
      const providerId = input.provider_id || pickDefaultProviderId(input.format, providers);
      const provider = providers.find((item) => item.id === providerId) ?? null;
      const name = input.name.trim() || provider?.name || "";
      const rawBaseUrl = input.base_url.trim() || provider?.default_base_url || "";
      const normalizedBaseUrl = normalizeCompatibleBaseUrl(rawBaseUrl);
      const baseUrl = normalizedBaseUrl;
      const model = input.model.trim() || defaultModelForFormat(input.format);
      const capabilities = Array.from(new Set(input.capabilities));

      if (!providerId) throw new Error(TEXT.noProvider);
      if (!name) throw new Error(TEXT.needName);
      if (!baseUrl) throw new Error(TEXT.needBaseUrl);
      if (!model) throw new Error(TEXT.needModel);
      if (capabilities.length === 0) throw new Error(TEXT.needCapability);
      if (isMiniMaxPreset(input)) {
        if (!/^https:\/\/api\.minimaxi\.com\/v1$/i.test(baseUrl)) {
          throw new Error(TEXT.minimaxBaseUrlError);
        }
      }

      let parsedConfig: Record<string, unknown>;
      try {
        parsedConfig = parseConfigJson(input.config_json || formatConfigJson(input));
      } catch {
        throw new Error(TEXT.invalidJson);
      }

      const payload = {
        provider_id: providerId,
        name,
        base_url: baseUrl,
        model,
        api_version: input.api_version.trim(),
        status: "active" as const,
        public_config: {
          provider_preset: input.provider_preset,
          reasoning_model: input.reasoning_model.trim(),
          notes: input.note.trim(),
          write_shared_config: input.write_shared_config,
          config_flags: {
            hide_ai_signature: input.hide_ai_signature,
            extended_thinking: input.extended_thinking,
            teammates_mode: input.teammates_mode,
          },
          config_json: parsedConfig,
        },
        secret_config: {
          api_key: input.api_key.trim() || undefined,
        },
      };

      const saved = input.id
        ? await put<ApiConnection>(`/api/admin/api-connections/${input.id}`, payload)
        : await post<ApiConnection>("/api/admin/api-connections", payload);

      await syncBindings(saved.id, capabilities);
      return saved;
    },
    onSuccess: async (connection) => {
      setNoticeTone("success");
      setNotice(`${TEXT.saved}${/\/chat\/completions/i.test(currentDraft.base_url) ? ` ${TEXT.endpointNormalized}` : ""}`);
      setSelectedConnectionId(connection.id);
      setDraft(toDraft(connection, bindings));
      await refreshAll();
    },
    onError: (error) => {
      setNoticeTone("error");
      setNotice(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del<{ ok: true }>(`/api/admin/api-connections/${id}`),
    onSuccess: async () => {
      setNoticeTone("success");
      setNotice(TEXT.deleted);
      setSelectedConnectionId("");
      setDraft(blankDraft("openai_compatible", providers));
      await refreshAll();
    },
    onError: (error) => {
      setNoticeTone("error");
      setNotice(getErrorMessage(error));
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => post<{ status: string; message: string }>(`/api/admin/api-connections/${id}/test`),
    onSuccess: async (result) => {
      setNoticeTone(result.status === "ok" ? "success" : "info");
      setNotice(`${TEXT.tested}${result.message}`);
      await refreshAll();
    },
    onError: (error) => {
      setNoticeTone("error");
      setNotice(getErrorMessage(error));
      void refreshAll();
    },
  });

  const quickEnableMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      await Promise.all([
        put<ApiBinding>("/api/admin/api-bindings/agent_llm", {
          connection_id: connectionId,
          enabled: true,
          model_override: "",
        }),
        put<ApiBinding>("/api/admin/api-bindings/prompt_test", {
          connection_id: connectionId,
          enabled: true,
          model_override: "",
        }),
      ]);
    },
    onSuccess: async () => {
      setNoticeTone("success");
      setNotice(TEXT.enabled);
      await refreshAll();
    },
    onError: (error) => {
      setNoticeTone("error");
      setNotice(getErrorMessage(error));
    },
  });

  const startNewConfig = (format: ApiFormat = "openai_compatible") => {
    setSelectedConnectionId("");
    setDraft(format === "openai_compatible" ? applyPresetToDraft(blankDraft(format, providers), "minimax_openai", providers) : applyPresetToDraft(blankDraft(format, providers), "anthropic", providers));
  };

  const selectConnection = (item: ApiConnection) => {
    setSelectedConnectionId(item.id);
    setDraft(toDraft(item, bindings));
  };

  const applyProviderSelection = (providerId: string) => {
    const provider = providers.find((item) => item.id === providerId) ?? null;
    const preset = getProviderPreset(provider);
    setDraft((prev) => {
      const base = prev ?? currentDraft;
      return withGeneratedConfig({
        ...base,
        provider_preset: provider?.code || base.provider_preset,
        provider_id: providerId,
        format: (preset?.format || provider?.protocol_type || base.format) as ApiFormat,
        name: base.name.trim() ? base.name : preset?.display_name || provider?.name || "",
        base_url: base.base_url.trim() ? base.base_url : preset?.base_url || provider?.default_base_url || "",
        model: base.model.trim() ? base.model : preset?.model || defaultModelForFormat(base.format),
        api_version:
          base.api_version.trim() ||
          ((preset?.format || provider?.protocol_type) === "anthropic" ? "2023-06-01" : ""),
      });
    });
  };

  return (
    <div className="api-admin-page">
      <div className="page-header">
        <h1 className="page-title">{TEXT.title}</h1>
        <p className="page-subtitle">{TEXT.subtitle}</p>
      </div>

      <AdminNotice message={notice} tone={noticeTone} />

      <div className="api-admin-kpis">
        <div className="api-admin-kpi">
          <span className="api-admin-kpi-label">{TEXT.configuredApis}</span>
          <strong>{connections.length}</strong>
        </div>
        <div className="api-admin-kpi">
          <span className="api-admin-kpi-label">{TEXT.currentFormat}</span>
          <strong>{currentDraft.format === "anthropic" ? "Anthropic" : "OpenAI"}</strong>
        </div>
        <div className="api-admin-kpi">
          <span className="api-admin-kpi-label">{TEXT.defaultAgent}</span>
          <strong>{bindings.find((item) => item.capability === "agent_llm")?.connection_name || TEXT.envFallback}</strong>
        </div>
        <div className="api-admin-kpi">
          <span className="api-admin-kpi-label">{TEXT.availableCount}</span>
          <strong>{connections.filter((item) => item.status === "active").length}</strong>
        </div>
      </div>

      <section className="api-registry-layout">
        <div className="api-registry-pane api-registry-pane-list">
          <div className="api-pane-head">
            <div>
              <h2 className="card-title">{TEXT.listTitle}</h2>
              <p className="api-pane-subtitle">{TEXT.listSubtitle}</p>
            </div>
            <button type="button" className="btn-admin btn-admin-primary" onClick={() => startNewConfig()}>
              {TEXT.newConfig}
            </button>
          </div>

          <div className="api-filter-row">
            <input
              className="admin-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={TEXT.searchPlaceholder}
            />
          </div>

          <div className="api-registry-stack">
            {filteredConnections.map((item) => {
              const isEnabled = item.id === defaultAgentBinding && item.id === defaultPromptBinding;
              return (
                <div key={item.id} className={`api-registry-card ${selectedConnectionId === item.id ? "active" : ""}`}>
                <button type="button" className="api-registry-select" onClick={() => selectConnection(item)}>
                  <span className="api-registry-logo">{monogram(item.name || item.provider_name)}</span>
                  <span className="api-registry-meta">
                    <span className="api-registry-title-row">
                      <strong className="api-registry-title">{item.name}</strong>
                      <span className={`admin-status admin-status-${toneClass(item.status)}`}>{item.status}</span>
                    </span>
                    <span className="api-registry-link">{item.base_url}</span>
                    <span className="api-registry-subline">
                      {item.provider_protocol_type === "anthropic" ? "Anthropic" : "OpenAI"} · {item.model || TEXT.noModel} · {formatDate(item.last_checked_at)}
                    </span>
                  </span>
                </button>
                <div className="api-quick-actions">
                  <button
                    type="button"
                    className={`api-action-pill primary ${isEnabled ? "active" : ""}`}
                    onClick={() => !isEnabled && quickEnableMutation.mutate(item.id)}
                    disabled={isEnabled}
                  >
                    {isEnabled ? TEXT.enabledNow : TEXT.enable}
                  </button>
                  <button type="button" className="api-action-pill" onClick={() => selectConnection(item)}>
                    {TEXT.edit}
                  </button>
                </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="api-registry-pane api-registry-pane-editor">
          <div className="api-editor-panel">
            <div className="api-editor-topline">
              <div className="api-editor-provider">
                <div className="api-editor-provider-mark">{monogram(currentDraft.name || selectedProvider?.name || "AI")}</div>
                <div>
                  <div className="api-editor-provider-name">
                    {currentDraft.id ? TEXT.editConfig : TEXT.newConfigTitle}
                  </div>
                  <div className="api-editor-provider-hint">{FORMAT_META[currentDraft.format].hint}</div>
                </div>
              </div>
              <div className="api-pane-actions">
                {currentDraft.id ? (
                  <>
                    <button
                      type="button"
                      className="btn-admin"
                      onClick={() => currentDraft.id && testMutation.mutate(currentDraft.id)}
                    >
                      {TEXT.test}
                    </button>
                    <button
                      type="button"
                      className="btn-admin btn-admin-danger"
                      onClick={() => currentDraft.id && deleteMutation.mutate(currentDraft.id)}
                    >
                      {TEXT.delete}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="btn-admin btn-admin-primary"
                  onClick={() => saveMutation.mutate(currentDraft)}
                >
                  {TEXT.save}
                </button>
              </div>
            </div>

            <div className="api-editor-grid">
              <div className="api-field api-field-span-2">
                <span className="api-field-label">{TEXT.presetLabel}</span>
                <div className="api-template-shortcuts">
                  {PRESET_OPTIONS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className={`api-template-chip ${currentDraft.provider_preset === preset.key ? "active" : ""}`}
                      onClick={() => setDraft((prev) => applyPresetToDraft(prev ?? currentDraft, preset.key, providers))}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {isMiniMaxPreset(currentDraft) ? <span className="api-field-help">{TEXT.minimaxHint}</span> : null}
              </div>

              <label className="api-field api-field-span-2">
                <span className="api-field-label">{TEXT.formatLabel}</span>
                <select
                  className="admin-select"
                  value={currentDraft.format}
                  onChange={(event) => {
                    const format = event.target.value as ApiFormat;
                    setDraft((prev) =>
                      withGeneratedConfig({
                        ...(prev ?? currentDraft),
                        format,
                        provider_id: pickDefaultProviderId(format, providers),
                        model: (prev?.model || currentDraft.model || "").trim() || defaultModelForFormat(format),
                        name:
                          (prev?.name || currentDraft.name || "").trim() ||
                          getProviderPreset(
                            providers.find((item) => item.id === pickDefaultProviderId(format, providers)) ?? null
                          )?.display_name ||
                          "",
                        base_url:
                          (prev?.base_url || currentDraft.base_url || "").trim() ||
                          getProviderPreset(
                            providers.find((item) => item.id === pickDefaultProviderId(format, providers)) ?? null
                          )?.base_url ||
                          providers.find((item) => item.id === pickDefaultProviderId(format, providers))?.default_base_url ||
                          "",
                        api_version: format === "anthropic" ? "2023-06-01" : "",
                      })
                    );
                  }}
                >
                  <option value="openai_compatible">{FORMAT_META.openai_compatible.label}</option>
                  <option value="anthropic">{FORMAT_META.anthropic.label}</option>
                </select>
                <span className="api-field-help">
                  {currentDraft.format === "anthropic"
                    ? TEXT.formatHintAnthropic
                    : TEXT.formatHintOpenAI}
                </span>
              </label>

              <label className="api-field">
                <span className="api-field-label">{TEXT.providerLabel}</span>
                <select
                  className="admin-select"
                  value={currentDraft.provider_id}
                  onChange={(event) => applyProviderSelection(event.target.value)}
                >
                  <option value="">{TEXT.chooseProvider}</option>
                  {providerOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="api-field">
                <span className="api-field-label">{TEXT.providerNameLabel}</span>
                <input
                  className="admin-input"
                  value={currentDraft.name}
                  onChange={(event) => setDraftField("name", event.target.value)}
                  placeholder={TEXT.providerNamePlaceholder}
                />
              </label>

              <label className="api-field api-field-span-2">
                <span className="api-field-label">{TEXT.baseUrlLabel}</span>
                <input
                  className="admin-input"
                  value={currentDraft.base_url}
                  onChange={(event) => setDraftField("base_url", event.target.value)}
                  placeholder={FORMAT_META[currentDraft.format].placeholder}
                />
                <span className="api-field-help">
                  {currentDraft.format === "anthropic"
                    ? TEXT.baseUrlHintAnthropic
                    : TEXT.baseUrlHintOpenAI}
                </span>
              </label>

              <label className="api-field api-field-span-2">
                <span className="api-field-label">API Key</span>
                <input
                  className="admin-input"
                  type="password"
                  value={currentDraft.api_key}
                  onChange={(event) => setDraftField("api_key", event.target.value)}
                  placeholder={
                    selectedConnection?.has_secret
                      ? `${selectedConnection.masked_secret}${TEXT.keepExistingSecret}`
                      : TEXT.enterApiKey
                  }
                />
              </label>

              <label className="api-field">
                <span className="api-field-label">{TEXT.modelLabel}</span>
                <input
                  className="admin-input"
                  value={currentDraft.model}
                  onChange={(event) => setDraftField("model", event.target.value)}
                  placeholder={currentDraft.format === "anthropic" ? "claude-3-5-sonnet-latest" : "gpt-4.1-mini"}
                />
              </label>

              <label className="api-field">
                <span className="api-field-label">{TEXT.reasoningLabel}</span>
                <input
                  className="admin-input"
                  value={currentDraft.reasoning_model}
                  onChange={(event) => setDraftField("reasoning_model", event.target.value)}
                  placeholder={TEXT.reasoningPlaceholder}
                />
              </label>

              <label className="api-field">
                <span className="api-field-label">{FORMAT_META[currentDraft.format].apiVersionLabel}</span>
                <input
                  className="admin-input"
                  value={currentDraft.api_version}
                  onChange={(event) => setDraftField("api_version", event.target.value)}
                  placeholder={currentDraft.format === "anthropic" ? "2023-06-01" : TEXT.versionEmpty}
                />
              </label>

              <label className="api-field">
                <span className="api-field-label">{TEXT.noteLabel}</span>
                <input
                  className="admin-input"
                  value={currentDraft.note}
                  onChange={(event) => setDraftField("note", event.target.value)}
                  placeholder={TEXT.notePlaceholder}
                />
              </label>

              <div className="api-field api-field-span-2">
                <span className="api-field-label">{TEXT.capabilityLabel}</span>
                <div className="api-capability-grid">
                  {CAPABILITY_OPTIONS.map((item) => {
                    const checked = currentDraft.capabilities.includes(item.key);
                    return (
                      <label key={item.key} className={`api-capability-chip ${checked ? "active" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...currentDraft.capabilities, item.key]
                              : currentDraft.capabilities.filter((value) => value !== item.key);
                            setDraftField("capabilities", Array.from(new Set(next)));
                          }}
                        />
                        {item.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="api-field api-field-span-2">
                <div className="api-json-toolbar">
                  <div>
                    <span className="api-field-label">{TEXT.configJsonTitle}</span>
                    <p className="api-field-help">{TEXT.jsonHint}</p>
                  </div>
                  <label className="api-checkline">
                    <input
                      type="checkbox"
                      checked={currentDraft.write_shared_config}
                      onChange={(event) => setDraftField("write_shared_config", event.target.checked)}
                    />
                    {TEXT.writeSharedConfig}
                  </label>
                </div>

                <div className="api-json-toggle-row">
                  <label className="api-capability-chip">
                    <input
                      type="checkbox"
                      checked={currentDraft.hide_ai_signature}
                      onChange={(event) => setDraftField("hide_ai_signature", event.target.checked)}
                    />
                    {TEXT.hideSignature}
                  </label>
                  <label className="api-capability-chip">
                    <input
                      type="checkbox"
                      checked={currentDraft.extended_thinking}
                      onChange={(event) => setDraftField("extended_thinking", event.target.checked)}
                    />
                    {TEXT.extendedThinking}
                  </label>
                  <label className="api-capability-chip">
                    <input
                      type="checkbox"
                      checked={currentDraft.teammates_mode}
                      onChange={(event) => setDraftField("teammates_mode", event.target.checked)}
                    />
                    {TEXT.teammatesMode}
                  </label>
                </div>

                <textarea
                  className="admin-input api-json-editor"
                  value={currentDraft.config_json}
                  onChange={(event) => setDraftField("config_json", event.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="api-editor-footer">
              <span className="api-editor-tip">
                {TEXT.footerHint}
              </span>
              <button type="button" className="btn-admin" onClick={() => startNewConfig("anthropic")}>
                {TEXT.newAnthropicConfig}
              </button>
            </div>

            <div className="api-connection-result-card">
              <div className="api-connection-result-head">
                <h3 className="card-title">{TEXT.testCardTitle}</h3>
                <span className={`admin-status admin-status-${toneClass(selectedConnection?.last_check_status || "unknown")}`}>
                  {selectedConnection?.last_check_status || TEXT.untested}
                </span>
              </div>
              <div className="api-connection-result-grid">
                <div className="api-result-item">
                  <span className="api-result-label">{TEXT.testStatus}</span>
                  <strong>{selectedConnection ? formatDate(selectedConnection.last_checked_at) : TEXT.untested}</strong>
                </div>
                <div className="api-result-item">
                  <span className="api-result-label">{TEXT.testEndpoint}</span>
                  <strong>{(currentDraft.base_url || selectedConnection?.base_url || FORMAT_META[currentDraft.format].placeholder).trim()}</strong>
                </div>
                <div className="api-result-item api-result-item-span-2">
                  <span className="api-result-label">{TEXT.testMessage}</span>
                  <strong>{selectedConnection?.last_check_message || "\u4fdd\u5b58\u540e\u53ef\u70b9\u51fb\u201c\u6d4b\u8bd5\u8fde\u63a5\u201d\u67e5\u770b\u68c0\u6d4b\u7ed3\u679c\u3002"}</strong>
                </div>
                <div className="api-result-item api-result-item-span-2">
                  <span className="api-result-label">{TEXT.testBindings}</span>
                  <div className="api-result-chips">
                    {(selectedConnectionBindings.length > 0
                      ? selectedConnectionBindings.map((binding) => binding.capability)
                      : currentDraft.capabilities
                    ).map((capability) => (
                      <span key={capability} className="api-result-chip">
                        {CAPABILITY_OPTIONS.find((item) => item.key === capability)?.label || capability}
                      </span>
                    ))}
                    {selectedConnectionBindings.length === 0 && currentDraft.capabilities.length === 0 ? (
                      <span className="api-result-chip muted">{TEXT.notBound}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
