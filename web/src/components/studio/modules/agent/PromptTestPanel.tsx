"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { get, getErrorMessage, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import { SubPageHeader } from "@/features/agent/components/SubPageHeader";

type ModelRegistryItem = {
  id: string;
  label: string;
};

type PromptTemplate = {
  id: string;
  scenario: string;
  name: string;
  version: number;
  system_prompt: string;
  task_prompt: string;
  output_schema_prompt: string;
  is_active: boolean;
};

type PromptTestResult = {
  run_id: string;
  model: string;
  score: number;
  output: string;
  parsed_output: unknown;
  schema_passed: boolean;
  missing_fields: string[];
  keyword_hits: string[];
  keyword_hit_rate: number;
  latency_ms: number;
  degraded: boolean;
  degrade_reason: string;
  template_id: string | null;
  template_version: number | null;
  rag_strategy?: string;
  knowledge_hit_count?: number;
  citation_count?: number;
  recent_runs: Array<{
    id: string;
    model: string;
    score: number;
    created_at: string;
  }>;
};

export function PromptTestPanel() {
  const { isAuthenticated } = useAuth();
  const [model, setModel] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("请输出一篇文章摘要 JSON，包含 title 和 summary 字段。");
  const [testInput, setTestInput] = useState("主题：AI 内容工作台如何帮助个人创作者。");
  const [outputSchemaPrompt, setOutputSchemaPrompt] = useState(`{
  "title": "string",
  "summary": "string"
}`);
  const [requiredFields, setRequiredFields] = useState("title,summary");
  const [expectedKeywords, setExpectedKeywords] = useState("AI,创作者,内容");
  const [result, setResult] = useState<PromptTestResult | null>(null);
  const [error, setError] = useState("");

  const modelQuery = useQuery({
    queryKey: queryKeys.modelRegistry,
    queryFn: async () => get<{ items: ModelRegistryItem[] }>(getVersionedApiPath("/models")),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const templatesQuery = useQuery({
    queryKey: queryKeys.promptTemplates(),
    queryFn: async () => get<{ items: PromptTemplate[] }>(getVersionedApiPath("/prompts/templates")),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const selectedTemplate = useMemo(
    () => (templatesQuery.data?.items || []).find((item) => item.id === templateId) || null,
    [templateId, templatesQuery.data]
  );

  const testMutation = useMutation({
    mutationFn: async () =>
      post<PromptTestResult>(getVersionedApiPath("/prompts/test"), {
        template_id: templateId || undefined,
        model: model || undefined,
        task_prompt: taskPrompt,
        output_schema_prompt: outputSchemaPrompt,
        test_input: testInput,
        required_fields: requiredFields.split(",").map((item) => item.trim()).filter(Boolean),
        expected_keywords: expectedKeywords.split(",").map((item) => item.trim()).filter(Boolean),
      }),
    onSuccess: (data) => {
      setResult(data);
      setError("");
    },
    onError: (mutationError) => {
      setError(getErrorMessage(mutationError));
    },
  });

  if (!isAuthenticated) {
    return <div className="studio-empty">请先登录后使用。</div>;
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-[#0a0a0a] overflow-hidden">
      <div className="p-6 md:p-8 lg:px-12 max-w-5xl mx-auto w-full flex flex-col flex-1 overflow-y-auto custom-scrollbar">
        <SubPageHeader
          title="Prompt 批量测试"
          description="选择一个模板版本，输入测试样本进行跑分，直接对比不同版本的输出质量、结构化稳定性和延迟。"
        />

        <div className="bg-[#11141c] border border-white/5 rounded-2xl p-6 shadow-xl relative mt-2">
          <div className="space-y-4">
            <div>
              <label className="studio-label">模板版本</label>
              <select className="studio-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">不使用模板</option>
                {(templatesQuery.data?.items || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} / v{item.version} {item.is_active ? "(当前)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="studio-label">模型</label>
              <select className="studio-input" value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">默认模型</option>
                {(modelQuery.data?.items || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedTemplate && (
              <div className="agent-assistant-banner">
                <span className="label">当前模板</span>
                <span className="value">
                  {selectedTemplate.name} / v{selectedTemplate.version}
                </span>
              </div>
            )}
            <div>
              <label className="studio-label">任务 Prompt</label>
              <textarea className="studio-input min-h-[140px]" value={taskPrompt} onChange={(e) => setTaskPrompt(e.target.value)} />
            </div>
            <div>
              <label className="studio-label">测试输入</label>
              <textarea className="studio-input min-h-[120px]" value={testInput} onChange={(e) => setTestInput(e.target.value)} />
            </div>
            <div>
              <label className="studio-label">输出 Schema</label>
              <textarea className="studio-input min-h-[120px]" value={outputSchemaPrompt} onChange={(e) => setOutputSchemaPrompt(e.target.value)} />
            </div>
            <div>
              <label className="studio-label">必填字段</label>
              <input className="studio-input" value={requiredFields} onChange={(e) => setRequiredFields(e.target.value)} />
            </div>
            <div>
              <label className="studio-label">关键词</label>
              <input className="studio-input" value={expectedKeywords} onChange={(e) => setExpectedKeywords(e.target.value)} />
            </div>
            <button type="button" className="studio-btn studio-btn-primary" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
              {testMutation.isPending ? "测试中..." : "运行测试"}
            </button>
            {error && <div className="p-3 bg-red-500/10 text-red-500 rounded-lg text-sm">{error}</div>}
          </div>
        </div>

        {result && (
          <div className="bg-[#11141c] border border-white/5 rounded-2xl p-6 shadow-xl relative mt-6 border-t-4 border-t-blue-500">
            <h3 className="text-lg font-bold text-white mb-4">测试报告</h3>
            <div className="agent-task-meta">
              <span>模型: {result.model}</span>
              <span>得分: {result.score}</span>
              <span>延迟: {result.latency_ms}ms</span>
              <span>Schema: {result.schema_passed ? "通过" : "失败"}</span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="studio-title-3">原始输出</h4>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-zinc-300">{result.output}</pre>
              </div>
              <div>
                <h4 className="studio-title-3">结构化结果</h4>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-zinc-300">
                  {JSON.stringify(result.parsed_output, null, 2)}
                </pre>
                <div className="mt-3 text-sm text-zinc-400">缺失字段: {result.missing_fields.join(", ") || "无"}</div>
                <div className="text-sm text-zinc-400">命中关键词: {result.keyword_hits.join(", ") || "无"}</div>
              </div>
            </div>

            {result.recent_runs.length > 0 && (
              <div className="mt-4">
                <h4 className="studio-title-3">最近回归记录</h4>
                <div className="space-y-2 mt-2">
                  {result.recent_runs.map((item) => (
                    <div key={item.id} className="agent-task-meta">
                      <span>{item.model}</span>
                      <span>得分 {item.score}</span>
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
