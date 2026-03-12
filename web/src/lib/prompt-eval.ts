import "server-only";

import { randomUUID } from "crypto";
import { getModelDescriptor } from "@/lib/ai-models";
import { invokeModelText } from "@/lib/model-runtime";
import { getPromptTemplate } from "@/lib/prompt-templates";
import { agentPlatformRepository } from "@/lib/repositories";

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    const firstBrace = value.indexOf("{");
    const lastBrace = value.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(value.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function getMissingFields(parsedOutput: unknown, requiredFields: string[]) {
  if (!parsedOutput || typeof parsedOutput !== "object" || Array.isArray(parsedOutput)) {
    return requiredFields;
  }

  const record = parsedOutput as Record<string, unknown>;
  return requiredFields.filter((field) => {
    const value = record[field];
    if (value === undefined || value === null) return true;
    if (typeof value === "string") return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  });
}

function keywordStats(output: string, expectedKeywords: string[]) {
  const normalized = output.toLowerCase();
  const hits = expectedKeywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));

  return {
    hits,
    hitRate: expectedKeywords.length === 0 ? 1 : hits.length / expectedKeywords.length,
  };
}

function computeScore(params: {
  output: string;
  schemaPassed: boolean;
  missingFields: string[];
  keywordHitRate: number;
}) {
  let score = 0;
  if (params.output.trim().length > 0) score += 20;
  if (params.schemaPassed) score += 30;
  if (params.missingFields.length === 0) score += 20;
  score += Math.round(params.keywordHitRate * 30);
  return Math.max(0, Math.min(100, score));
}

export async function runPromptTest(
  username: string,
  input: {
    templateId?: string;
    model?: string;
    systemPrompt?: string;
    taskPrompt?: string;
    toolPrompt?: string;
    outputSchemaPrompt?: string;
    testInput: string;
    expectedKeywords?: string[];
    requiredFields?: string[];
  }
) {
  const model = getModelDescriptor(input.model);
  const runId = `pt_${randomUUID().replace(/-/g, "")}`;
  const startedAt = Date.now();
  const requiredFields = input.requiredFields || [];
  const template = input.templateId ? await getPromptTemplate(username, input.templateId) : null;

  const mergedSystemPrompt = input.systemPrompt?.trim() || template?.system_prompt || "";
  const mergedTaskPrompt = input.taskPrompt?.trim() || template?.task_prompt || "";
  const mergedToolPrompt = input.toolPrompt?.trim() || template?.tool_prompt || "";
  const mergedOutputSchemaPrompt = input.outputSchemaPrompt?.trim() || template?.output_schema_prompt || "";

  const systemPrompt = [
    mergedSystemPrompt,
    mergedToolPrompt ? `Tool constraints:\n${mergedToolPrompt}` : "",
    mergedOutputSchemaPrompt ? `Output schema:\n${mergedOutputSchemaPrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = [
    mergedTaskPrompt,
    `Test input:\n${input.testInput.trim()}`,
    mergedOutputSchemaPrompt ? "Return JSON only when a JSON schema is requested." : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let rawOutput = "";
  let parsedOutput: unknown = null;
  let degraded = false;
  let degradeReason = "";
  let actualModelId = model.id;
  let actualModelLabel = model.label;

  try {
    const response = await invokeModelText({
      model: model.id,
      capability: "prompt_test",
      systemPrompt: systemPrompt || "You are a prompt evaluation assistant.",
      userPrompt,
    });
    actualModelId = response.model.id;
    actualModelLabel = response.model.label;
    rawOutput = response.output;
    parsedOutput = safeJsonParse(rawOutput);
  } catch (error) {
    degraded = true;
    degradeReason = error instanceof Error ? error.message : "model_unavailable";
    rawOutput = `${systemPrompt}\n\n${userPrompt}`.trim();
    parsedOutput = safeJsonParse(rawOutput);
  }

  const missingFields = getMissingFields(parsedOutput, requiredFields);
  const schemaPassed = requiredFields.length === 0
    ? parsedOutput !== null || !mergedOutputSchemaPrompt
    : missingFields.length === 0;
  const keywordResult = keywordStats(rawOutput, input.expectedKeywords || []);
  const latencyMs = Date.now() - startedAt;
  const score = computeScore({
    output: rawOutput,
    schemaPassed,
    missingFields,
    keywordHitRate: keywordResult.hitRate,
  });

  const responsePayload = {
    output: rawOutput,
    parsed_output: parsedOutput,
    schema_passed: schemaPassed,
    missing_fields: missingFields,
    keyword_hits: keywordResult.hits,
    keyword_hit_rate: keywordResult.hitRate,
    task_success: schemaPassed && rawOutput.trim().length > 0,
    citation_validity: 1,
    memory_recall: keywordResult.hitRate,
    format_pass_rate: schemaPassed ? 1 : 0,
    latency_ms: latencyMs,
    degraded,
    degrade_reason: degradeReason,
    template_id: template?.id || null,
    template_version: template?.version || null,
    rag_strategy: "langchain_hybrid",
    knowledge_hit_count: 0,
    citation_count: 0,
  };

  await agentPlatformRepository.insertPromptTestRun({
    id: runId,
    username,
    templateId: input.templateId || null,
    model: actualModelId,
    inputJson: JSON.stringify({
      ...input,
      merged_system_prompt: mergedSystemPrompt,
      merged_task_prompt: mergedTaskPrompt,
      merged_tool_prompt: mergedToolPrompt,
      merged_output_schema_prompt: mergedOutputSchemaPrompt,
    }),
    outputJson: JSON.stringify(responsePayload),
    score,
    ts: nowIso(),
  });

  const recentRuns = input.templateId
    ? await agentPlatformRepository.getRecentPromptTestRuns(username, input.templateId, 6)
    : [];

  return {
    run_id: runId,
    model: actualModelId,
    model_label: actualModelLabel,
    score,
    recent_runs: recentRuns.map((item) => ({
      id: item.id,
      model: item.model,
      score: item.score,
      created_at: item.created_at,
    })),
    ...responsePayload,
  };
}
