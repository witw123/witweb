import "server-only";

import { agentConfig } from "@/lib/config";

export type ModelCapability =
  | "chat"
  | "stream"
  | "structured_output"
  | "embedding"
  | "rerank";

export type ModelProvider = "openai" | "dashscope" | "deepseek" | "gemini" | "custom";

export interface ModelDescriptor {
  id: string;
  provider: ModelProvider;
  label: string;
  endpoint: string;
  configured: boolean;
  capabilities: ModelCapability[];
  recommendedFor: string[];
  costTier: "low" | "medium" | "high";
  timeoutMs: number;
  fallbackModelId?: string;
}

const MODEL_REGISTRY: ModelDescriptor[] = [
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    label: "OpenAI GPT-4.1 Mini",
    endpoint: agentConfig.providers.openai.baseUrl,
    configured: Boolean(agentConfig.providers.openai.apiKey),
    capabilities: ["chat", "stream", "structured_output", "embedding"],
    recommendedFor: ["classification", "tool-planning", "prompt-test"],
    costTier: "medium",
    timeoutMs: 20_000,
    fallbackModelId: "deepseek-chat",
  },
  {
    id: "qwen-plus",
    provider: "dashscope",
    label: "通义千问 Qwen Plus",
    endpoint: agentConfig.providers.dashscope.baseUrl,
    configured: Boolean(agentConfig.providers.dashscope.apiKey),
    capabilities: ["chat", "stream", "structured_output", "embedding"],
    recommendedFor: ["cn-content", "prompt-test", "knowledge-qa"],
    costTier: "medium",
    timeoutMs: 20_000,
    fallbackModelId: "qwen-turbo",
  },
  {
    id: "qwen-turbo",
    provider: "dashscope",
    label: "通义千问 Qwen Turbo",
    endpoint: agentConfig.providers.dashscope.baseUrl,
    configured: Boolean(agentConfig.providers.dashscope.apiKey),
    capabilities: ["chat", "stream", "structured_output"],
    recommendedFor: ["classification", "extract"],
    costTier: "low",
    timeoutMs: 15_000,
  },
  {
    id: "deepseek-chat",
    provider: "deepseek",
    label: "DeepSeek Chat",
    endpoint: agentConfig.providers.deepseek.baseUrl,
    configured: Boolean(agentConfig.providers.deepseek.apiKey),
    capabilities: ["chat", "stream", "structured_output"],
    recommendedFor: ["planning", "sql", "knowledge-qa"],
    costTier: "low",
    timeoutMs: 20_000,
  },
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    label: "Gemini 2.5 Flash",
    endpoint: agentConfig.providers.gemini.baseUrl,
    configured: Boolean(agentConfig.providers.gemini.apiKey),
    capabilities: ["chat", "stream", "structured_output", "embedding"],
    recommendedFor: ["fast-draft", "extract", "prompt-test"],
    costTier: "low",
    timeoutMs: 15_000,
    fallbackModelId: "gemini-3-pro",
  },
  {
    id: "gemini-3-pro",
    provider: "custom",
    label: "Configured Agent Model",
    endpoint: agentConfig.endpoint,
    configured: Boolean(agentConfig.apiKey && agentConfig.endpoint),
    capabilities: ["chat", "stream", "structured_output"],
    recommendedFor: ["writing", "planning", "agent-run"],
    costTier: "high",
    timeoutMs: 30_000,
    fallbackModelId: "gemini-2.5-flash",
  },
];

export function listAvailableModels() {
  return MODEL_REGISTRY.map((model) => ({
    ...model,
    status: model.configured ? "ready" : "missing_credentials",
  }));
}

export function getModelDescriptor(modelId?: string): ModelDescriptor {
  if (modelId) {
    const matched = MODEL_REGISTRY.find((item) => item.id === modelId);
    if (matched) return matched;
  }

  return (
    MODEL_REGISTRY.find((item) => item.id === agentConfig.model) ||
    MODEL_REGISTRY.find((item) => item.configured) ||
    MODEL_REGISTRY[MODEL_REGISTRY.length - 1]
  );
}

export function getModelApiKey(provider: ModelProvider): string {
  switch (provider) {
    case "openai":
      return agentConfig.providers.openai.apiKey;
    case "dashscope":
      return agentConfig.providers.dashscope.apiKey;
    case "deepseek":
      return agentConfig.providers.deepseek.apiKey;
    case "gemini":
      return agentConfig.providers.gemini.apiKey;
    default:
      return agentConfig.apiKey;
  }
}

export function getModelBaseUrl(provider: ModelProvider): string {
  switch (provider) {
    case "openai":
      return agentConfig.providers.openai.baseUrl;
    case "dashscope":
      return agentConfig.providers.dashscope.baseUrl;
    case "deepseek":
      return agentConfig.providers.deepseek.baseUrl;
    case "gemini":
      return agentConfig.providers.gemini.baseUrl;
    default:
      return agentConfig.endpoint;
  }
}
