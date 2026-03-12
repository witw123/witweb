import { createdResponse, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import {
  activatePromptTemplate,
  createPromptTemplate,
  listPromptTemplates,
  PROMPT_TEMPLATE_SCENARIOS,
} from "@/lib/prompt-templates";
import { validateQuery, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const querySchema = z.object({
  scenario: z.enum(PROMPT_TEMPLATE_SCENARIOS).optional(),
});

const createSchema = z.object({
  scenario: z.enum(PROMPT_TEMPLATE_SCENARIOS),
  name: z.string().trim().min(1).max(80),
  assistant_name: z.string().trim().max(80).optional(),
  system_prompt: z.string().trim().optional(),
  task_prompt: z.string().trim().optional(),
  tool_prompt: z.string().trim().optional(),
  output_schema_prompt: z.string().trim().optional(),
  is_active: z.boolean().optional(),
});

const activateSchema = z.object({
  id: z.string().trim().min(1),
  activate: z.literal(true),
});

export const GET = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const query = await validateQuery(req, querySchema);
  return successResponse(await listPromptTemplates(user, query.scenario));
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await req.json();
  const activateResult = activateSchema.safeParse(body);
  if (activateResult.success) {
    const item = await activatePromptTemplate(user, activateResult.data.id);
    return successResponse(item);
  }

  const createBody = createSchema.parse(body);
  const item = await createPromptTemplate(user, {
    scenario: createBody.scenario,
    name: createBody.name,
    assistantName: createBody.assistant_name,
    systemPrompt: createBody.system_prompt,
    taskPrompt: createBody.task_prompt,
    toolPrompt: createBody.tool_prompt,
    outputSchemaPrompt: createBody.output_schema_prompt,
    isActive: createBody.is_active,
  });

  return createdResponse(item);
});
