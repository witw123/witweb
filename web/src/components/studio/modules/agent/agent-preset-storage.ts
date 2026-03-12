/**
 * Agent 预设存储
 *
 * 负责管理 Agent 自定义预设的持久化存储
 * 使用 localStorage 保存用户的预设配置
 */

"use client";

/**
 * Agent 预设配置
 */
export type AgentPreset = {
  /** 预设唯一标识 */
  id: string;
  /** 预设名称 */
  name: string;
  /** 助手名称 */
  assistantName: string;
  /** 系统提示词 */
  systemPrompt: string;
};

/** localStorage 中存储预设的键名 */
export const AGENT_PRESETS_KEY = "agent_custom_presets_v1";
/** localStorage 中存储当前选中预设 ID 的键名 */
export const AGENT_SELECTED_PRESET_KEY = "agent_selected_preset_v1";
/** 预设变更事件名称 */
export const AGENT_PRESET_EVENT = "agent-preset-changed";

/**
 * 通知预设已变更
 *
 * 触发自定义事件，通知其他组件刷新预设数据
 */
function notifyPresetChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AGENT_PRESET_EVENT));
}

/**
 * 读取已保存的 Agent 预设列表
 *
 * 从 localStorage 获取预设并进行数据验证和清洗
 *
 * @returns {AgentPreset[]} 预设数组，无效数据会被过滤
 */
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

/**
 * 保存 Agent 预设列表
 *
 * 将预设数组写入 localStorage，并触发变更通知
 *
 * @param {AgentPreset[]} presets - 要保存的预设数组
 */
export function writeAgentPresets(presets: AgentPreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AGENT_PRESETS_KEY, JSON.stringify(presets));
  notifyPresetChanged();
}

/**
 * 读取当前选中的预设 ID
 *
 * @returns {string} 选中的预设 ID，空字符串表示未选中
 */
export function readSelectedPresetId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AGENT_SELECTED_PRESET_KEY) || "";
}

/**
 * 保存当前选中的预设 ID
 *
 * @param {string} presetId - 要选中的预设 ID
 */
export function writeSelectedPresetId(presetId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AGENT_SELECTED_PRESET_KEY, presetId);
  notifyPresetChanged();
}

/**
 * 读取当前选中的预设
 *
 * 根据保存的预设 ID 获取对应的预设对象
 *
 * @returns {AgentPreset | null} 选中的预设，未选中或不存在则返回 null
 */
export function readSelectedPreset(): AgentPreset | null {
  const presetId = readSelectedPresetId();
  if (!presetId) return null;
  const presets = readAgentPresets();
  return presets.find((item) => item.id === presetId) || null;
}
