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
    <div className="mx-auto grid h-full min-h-[520px] max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="studio-panel studio-panel-glass flex flex-col">
        <h3 className="studio-section-title mb-1">助手模板</h3>
        <p className="studio-section-desc mb-4">在这里管理可复用的提示词助手，并设置当前生效助手。</p>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <select
              className="studio-input"
              value={selectedPresetId}
              onChange={(e) => applyPreset(e.target.value)}
            >
              <option value="">默认系统助手（不使用自定义）</option>
              {presets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="studio-btn studio-btn-secondary whitespace-nowrap px-4"
              onClick={() => setSelectedPresetId("")}
            >
              设为默认
            </button>
            <button
              type="button"
              className="studio-btn studio-btn-secondary whitespace-nowrap px-4"
              onClick={deletePreset}
              disabled={!selectedPresetId}
            >
              删除
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/35 p-3 text-sm text-zinc-300">
            当前生效:{" "}
            {selectedPresetId
              ? presets.find((item) => item.id === selectedPresetId)?.name || "自定义助手"
              : "默认系统助手"}
          </div>
        </div>
      </section>

      <section className="studio-panel studio-panel-glass flex flex-col">
        <h3 className="studio-section-title mb-1">新建/编辑模板</h3>
        <p className="studio-section-desc mb-4">创建后可在“创作模式”直接生效。</p>

        <div className="space-y-3">
          <div>
            <label className="studio-label">模板名称</label>
            <input
              className="studio-input"
              placeholder="例如：科技写作助手"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>
          <div>
            <label className="studio-label">助手名称（可选）</label>
            <input
              className="studio-input"
              placeholder="例如：架构评审助手"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              maxLength={40}
            />
          </div>
          <div>
            <label className="studio-label">系统提示词</label>
            <textarea
              className="studio-input min-h-[220px]"
              placeholder="输入你的系统提示词规则..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              maxLength={4000}
            />
          </div>
          <button type="button" className="studio-btn studio-btn-primary w-full" onClick={savePreset}>
            保存模板并启用
          </button>
          {error && <div className="studio-status studio-status-error">{error}</div>}
        </div>
      </section>
    </div>
  );
}

