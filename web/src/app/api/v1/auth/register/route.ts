import { withErrorHandler } from "@/middleware/error-handler";
import { handleRegisterPost } from "@/app/api/register/shared";

export const POST = withErrorHandler(async (req: Request) => {
  return handleRegisterPost(req);
});
