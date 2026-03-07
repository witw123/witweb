import { withErrorHandler } from "@/middleware/error-handler";
import { withDeprecation } from "@/lib/deprecation";
import { handleRegisterPost } from "@/app/api/register/shared";

export const POST = withErrorHandler(async (req: Request) => {
  return withDeprecation(await handleRegisterPost(req), "/api/v1/auth/register");
});
