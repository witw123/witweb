import { withErrorHandler } from "@/middleware/error-handler";
import { withDeprecation } from "@/lib/deprecation";
import { handleLoginPost } from "@/app/api/login/shared";

export const POST = withErrorHandler(async (req: Request) => {
  return withDeprecation(await handleLoginPost(req), "/api/v1/auth/login");
});
