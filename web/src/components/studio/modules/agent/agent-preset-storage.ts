"use client";

export type AgentPreset = {
  id: string;
  name: string;
  assistantName: string;
  systemPrompt: string;
};

export const AGENT_PRESETS_KEY = "agent_custom_presets_v1";
export const AGENT_SELECTED_PRESET_KEY = "agent_selected_preset_v1";
export const AGENT_PRESET_EVENT = "agent-preset-changed";

function notifyPresetChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AGENT_PRESET_EVENT));
}

export function readAgentPresets(): AgentPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AGENT_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "string")
      .map((item) => ({
        id: item.id,
        name: String(item.name || "").slice(0, 40),
        assistantName: String(item.assistantName || "").slice(0, 40),
        systemPrompt: String(item.systemPrompt || "").slice(0, 4000),
      }))
      .filter((item) => item.systemPrompt.trim().length > 0);
  } catch {
    return [];
  }
}

export function writeAgentPresets(presets: AgentPreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AGENT_PRESETS_KEY, JSON.stringify(presets));
  notifyPresetChanged();
}

export function readSelectedPresetId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AGENT_SELECTED_PRESET_KEY) || "";
}

export function writeSelectedPresetId(presetId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AGENT_SELECTED_PRESET_KEY, presetId);
  notifyPresetChanged();
}

export function readSelectedPreset(): AgentPreset | null {
  const presetId = readSelectedPresetId();
  if (!presetId) return null;
  const presets = readAgentPresets();
  return presets.find((item) => item.id === presetId) || null;
}
