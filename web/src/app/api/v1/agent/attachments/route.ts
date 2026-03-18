import { createdResponse, errorResponses } from "@/lib/api-response";
import { saveAgentAttachmentFile } from "@/lib/agent-attachments";
import { getAuthUser } from "@/lib/http";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return errorResponses.badRequest("缺少附件文件");
  }

  const attachment = await saveAgentAttachmentFile(file);
  return createdResponse(attachment);
});
