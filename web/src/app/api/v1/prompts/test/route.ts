import { runPromptTest } from "@/lib/prompt-eval";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  template_id: z.string().trim().optional(),
  model: z.string().trim().optional(),
  system_prompt: z.string().trim().optional(),
  task_prompt: z.string().trim().optional(),
  tool_prompt: z.string().trim().optional(),
  output_schema_prompt: z.string().trim().optional(),
  test_input: z.string().trim().min(2),
  expected_keywords: z.array(z.string().trim()).optional(),
  required_fields: z.array(z.string().trim()).optional(),
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const result = await runPromptTest(user, {
    templateId: body.template_id,
    model: body.model,
    systemPrompt: body.system_prompt,
    taskPrompt: body.task_prompt,
    toolPrompt: body.tool_prompt,
    outputSchemaPrompt: body.output_schema_prompt,
    testInput: body.test_input,
    expectedKeywords: body.expected_keywords,
    requiredFields: body.required_fields,
  });

  return successResponse(result);
});
