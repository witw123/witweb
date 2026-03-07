import { withErrorHandler } from "@/middleware/error-handler";
import { handleLoginPost } from "@/app/api/login/shared";

export const POST = withErrorHandler(async (req: Request) => {
  return handleLoginPost(req);
});
