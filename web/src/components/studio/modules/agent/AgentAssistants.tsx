"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { get, getErrorMessage, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import { SubPageHeader } from "@/features/agent/components/SubPageHeader";

type PromptTemplate = {
  id: string;
  scenario: string;
  name: string;
  assistant_name: string;
  version: number;
  system_prompt: string;
  task_prompt: string;
  tool_prompt: string;
  output_schema_prompt: string;
  is_active: boolean;
  updated_at: string;
};

const scenarioOptions = [
  { value: "article_writing", label: "写作助手" },
  { value: "topic_research", label: "选题助手" },
  { value: "publish_prep", label: "发布助手" },
  { value: "comment_reply", label: "评论回复" },
  { value: "video_script", label: "视频脚本" },
] as const;

export function AgentAssistants() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [selectedScenario, setSelectedScenario] = useState<(typeof scenarioOptions)[number]["value"]>("article_writing");
  const [name, setName] = useState("");
  const [assistantName, setAssistantName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [toolPrompt, setToolPrompt] = useState("");
  const [outputSchemaPrompt, setOutputSchemaPrompt] = useState("");
  const [error, setError] = useState("");

  const templatesQuery = useQuery({
    queryKey: queryKeys.promptTemplates(),
    queryFn: async () => get<{ items: PromptTemplate[] }>(getVersionedApiPath("/prompts/templates")),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      post<PromptTemplate>(getVersionedApiPath("/prompts/templates"), {
        scenario: selectedScenario,
        name,
        assistant_name: assistantName,
        system_prompt: systemPrompt,
        task_prompt: taskPrompt,
        tool_prompt: toolPrompt,
        output_schema_prompt: outputSchemaPrompt,
        is_active: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.promptTemplates() });
      setName("");
      setAssistantName("");
      setSystemPrompt("");
      setTaskPrompt("");
      setToolPrompt("");
      setOutputSchemaPrompt("");
      setError("");
    },
    onError: (mutationError) => {
      setError(getErrorMessage(mutationError));
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) =>
      post<PromptTemplate>(getVersionedApiPath("/prompts/templates"), {
        id,
        activate: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.promptTemplates() });
      setError("");
    },
    onError: (mutationError) => {
      setError(getErrorMessage(mutationError));
    },
  });

  const groupedTemplates = useMemo(() => {
    const items = templatesQuery.data?.items || [];
    return scenarioOptions.map((scenario) => ({
      ...scenario,
      items: items.filter((item) => item.scenario === scenario.value),
    }));
  }, [templatesQuery.data]);

  if (!isAuthenticated) {
    return <div className="studio-empty">请先登录后使用。</div>;
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-[#0a0a0a] overflow-hidden">
      <div className="p-6 md:p-8 lg:px-12 max-w-7xl mx-auto w-full flex flex-col flex-1 overflow-y-auto custom-scrollbar">
        <SubPageHeader
          title="助手高级设置"
          description="在这里维护和创建专属于各个环节的系统提示词（System Prompt），它们将在不同场景下重用。"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2 pb-12">
          {/* 左侧模板库 */}
          <section className="bg-[#11141c] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              现有版本库
            </h3>

            <div className="space-y-6">
              {groupedTemplates.map((group) => (
                <div key={group.value} className="space-y-2">
                  <div className="agent-task-top">
                    <h4>{group.label}</h4>
                    <span className="agent-task-id">{group.items.length} 个版本</span>
                  </div>
                  {group.items.length === 0 ? (
                    <div className="studio-empty">暂无模板</div>
                  ) : (
                    group.items.map((item) => (
                      <article key={item.id} className="agent-task-card">
                        <div className="agent-task-main">
                          <div className="agent-task-top">
                            <h4>{item.name}</h4>
                            <span className={`studio-badge ${item.is_active ? "studio-badge-success" : "studio-badge-warning"}`}>
                              v{item.version} {item.is_active ? "当前生效" : "可切换"}
                            </span>
                          </div>
                          <div className="agent-task-meta">
                            <span>助手名称: {item.assistant_name || "未设置"}</span>
                            <span>更新时间: {new Date(item.updated_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="studio-btn studio-btn-secondary"
                          disabled={activateMutation.isPending || item.is_active}
                          onClick={() => activateMutation.mutate(item.id)}
                        >
                          设为当前模板
                        </button>
                      </article>
                    ))
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 右侧编辑表单 */}
          <section className="bg-[#11141c] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              新建系统设定与模板
            </h3>

            <div className="space-y-3">
              <div>
                <label className="studio-label">场景</label>
                <select className="studio-input" value={selectedScenario} onChange={(e) => setSelectedScenario(e.target.value as typeof selectedScenario)}>
                  {scenarioOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="studio-label">模板名称</label>
                <input className="studio-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </div>
              <div>
                <label className="studio-label">助手名称</label>
                <input className="studio-input" value={assistantName} onChange={(e) => setAssistantName(e.target.value)} maxLength={80} />
              </div>
              <div>
                <label className="studio-label">System Prompt</label>
                <textarea className="studio-input min-h-[120px]" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
              </div>
              <div>
                <label className="studio-label">Task Prompt</label>
                <textarea className="studio-input min-h-[120px]" value={taskPrompt} onChange={(e) => setTaskPrompt(e.target.value)} />
              </div>
              <div>
                <label className="studio-label">Tool Prompt</label>
                <textarea className="studio-input min-h-[100px]" value={toolPrompt} onChange={(e) => setToolPrompt(e.target.value)} />
              </div>
              <div>
                <label className="studio-label">Output Schema Prompt</label>
                <textarea className="studio-input min-h-[100px]" value={outputSchemaPrompt} onChange={(e) => setOutputSchemaPrompt(e.target.value)} />
              </div>
              <button
                type="button"
                className="studio-btn studio-btn-primary w-full"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || name.trim().length === 0}
              >
                {createMutation.isPending ? "保存中..." : "保存为新版本并启用"}
              </button>
              {error && <div className="p-3 bg-red-500/10 text-red-500 rounded-lg text-sm">{error}</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
