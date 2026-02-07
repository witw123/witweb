import { initDb } from "@/lib/db-init";
import { publicProfile } from "@/lib/user";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "username is required"),
});

export const GET = withErrorHandler(async (_: Request, { params }: { params: Promise<{ username: string }> }) => {
  initDb();

  const viewer = await getAuthUser();
  const { username } = validateParams(await params, paramsSchema);

  const profile = publicProfile(username, viewer || undefined);
  if (!profile) return errorResponses.notFound("User not found");

  return successResponse(profile);
});
