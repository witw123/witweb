"use client";

import { useEffect, useState } from "react";
import {
  type AgentPreset,
  readAgentPresets,
  readSelectedPresetId,
  writeAgentPresets,
  writeSelectedPresetId,
} from "./agent-preset-storage";

export function AgentAssistants() {
  const [presets, setPresets] = useState<AgentPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [name, setName] = useState("");
  const [assistantName, setAssistantName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPresets(readAgentPresets());
    setSelectedPresetId(readSelectedPresetId());
  }, []);

  useEffect(() => {
    writeAgentPresets(presets);
  }, [presets]);

  useEffect(() => {
    writeSelectedPresetId(selectedPresetId);
  }, [selectedPresetId]);

  function savePreset() {
    const prompt = systemPrompt.trim();
    if (!prompt) {
      setError("请先输入系统提示词");
      return;
    }

    const next: AgentPreset = {
      id: `preset_${Date.now()}`,
      name: (name.trim() || assistantName.trim() || "自定义助手").slice(0, 40),
      assistantName: assistantName.trim().slice(0, 40),
      systemPrompt: prompt.slice(0, 4000),
    };

    setPresets((prev) => [next, ...prev].slice(0, 20));
    setSelectedPresetId(next.id);
    setName("");
    setAssistantName("");
    setSystemPrompt("");
    setError("");
  }

  function applyPreset(presetId: string) {
    setSelectedPresetId(presetId);
    const selected = presets.find((item) => item.id === presetId);
    if (!selected) return;
    setName(selected.name);
    setAssistantName(selected.assistantName);
    setSystemPrompt(selected.systemPrompt);
    setError("");
  }

  function deletePreset() {
    if (!selectedPresetId) return;
    setPresets((prev) => prev.filter((item) => item.id !== selectedPresetId));
    setSelectedPresetId("");
  }

  return (
    <div className="agent-assistants-grid">
      <section className="studio-panel studio-panel-glass">
        <h3 className="agent-panel-title">助手模板库</h3>
        <p className="agent-panel-desc">管理长期可复用的系统提示词，并设置当前生效助手。</p>

        <div className="agent-assistant-tools">
          <select className="studio-input" value={selectedPresetId} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">默认系统助手（不使用自定义）</option>
            {presets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <div className="agent-assistant-actions">
            <button type="button" className="studio-btn studio-btn-secondary" onClick={() => setSelectedPresetId("")}>设为默认</button>
            <button type="button" className="studio-btn studio-btn-secondary" onClick={deletePreset} disabled={!selectedPresetId}>删除模板</button>
          </div>
        </div>

        <div className="agent-assistant-banner mt-4">
          <span className="label">当前生效</span>
          <span className="value">
            {selectedPresetId
              ? presets.find((item) => item.id === selectedPresetId)?.name || "自定义助手"
              : "默认系统助手"}
          </span>
        </div>
      </section>

      <section className="studio-panel studio-panel-glass">
        <h3 className="agent-panel-title">新建模板</h3>
        <p className="agent-panel-desc">保存后立即可用于“创作模式”。</p>

        <div className="space-y-3">
          <div>
            <label className="studio-label">模板名称</label>
            <input className="studio-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：产品文案助手" maxLength={40} />
          </div>
          <div>
            <label className="studio-label">助手名称（可选）</label>
            <input className="studio-input" value={assistantName} onChange={(e) => setAssistantName(e.target.value)} placeholder="例如：增长写作助手" maxLength={40} />
          </div>
          <div>
            <label className="studio-label">系统提示词</label>
            <textarea className="studio-input min-h-[240px]" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="输入你的系统规则、语气和输出要求..." maxLength={4000} />
          </div>
          <button type="button" className="studio-btn studio-btn-primary w-full" onClick={savePreset}>保存模板并启用</button>
          {error && <div className="studio-status studio-status-error">{error}</div>}
        </div>
      </section>
    </div>
  );
}
