import { postRepository } from "@/lib/repositories";
import { successResponse } from "@/lib/api-response";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  slug: z.string().trim().min(1, "slug is required"),
});

export const POST = withErrorHandler(async (_: Request, { params }: { params: Promise<{ slug: string }> }) => {

  const { slug } = validateParams(await params, paramsSchema);
  const viewCount = await postRepository.incrementViewCount(slug);
  return successResponse({ ok: true, view_count: viewCount });
});
