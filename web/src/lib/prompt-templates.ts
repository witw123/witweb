import "server-only";

import { randomUUID } from "crypto";
import { agentPlatformRepository } from "@/lib/repositories";

function nowIso() {
  return new Date().toISOString();
}

export const PROMPT_TEMPLATE_SCENARIOS = [
  "topic_research",
  "article_writing",
  "publish_prep",
  "comment_reply",
  "video_script",
] as const;

export type PromptTemplateScenario = (typeof PROMPT_TEMPLATE_SCENARIOS)[number];

export async function listPromptTemplates(username: string, scenario?: string) {
  const items = await agentPlatformRepository.listPromptTemplates(username, scenario);
  return {
    items: items.map((item) => ({
      id: item.id,
      scenario: item.scenario,
      name: item.name,
      assistant_name: item.assistant_name,
      version: item.version,
      system_prompt: item.system_prompt,
      task_prompt: item.task_prompt,
      tool_prompt: item.tool_prompt,
      output_schema_prompt: item.output_schema_prompt,
      is_active: Boolean(item.is_active),
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
  };
}

export async function createPromptTemplate(
  username: string,
  input: {
    scenario: PromptTemplateScenario;
    name: string;
    assistantName?: string;
    systemPrompt?: string;
    taskPrompt?: string;
    toolPrompt?: string;
    outputSchemaPrompt?: string;
    isActive?: boolean;
  }
) {
  const name = input.name.trim().slice(0, 80);
  const version = await agentPlatformRepository.getNextPromptTemplateVersion(username, input.scenario, name);
  const id = `tpl_${randomUUID().replace(/-/g, "")}`;
  const ts = nowIso();

  await agentPlatformRepository.createPromptTemplate({
    id,
    username,
    scenario: input.scenario,
    name,
    assistantName: (input.assistantName || "").trim().slice(0, 80),
    version,
    systemPrompt: (input.systemPrompt || "").trim(),
    taskPrompt: (input.taskPrompt || "").trim(),
    toolPrompt: (input.toolPrompt || "").trim(),
    outputSchemaPrompt: (input.outputSchemaPrompt || "").trim(),
    isActive: input.isActive !== false,
    ts,
  });

  if (input.isActive !== false) {
    await agentPlatformRepository.activatePromptTemplate(id, username);
  }

  return await agentPlatformRepository.getPromptTemplateById(id, username);
}

export async function activatePromptTemplate(username: string, id: string) {
  return await agentPlatformRepository.activatePromptTemplate(id, username);
}

export async function getPromptTemplate(username: string, id: string) {
  return await agentPlatformRepository.getPromptTemplateById(id, username);
}
