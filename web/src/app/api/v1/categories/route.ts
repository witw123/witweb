import { withErrorHandler } from "@/middleware/error-handler";
import { buildCategoriesResponse } from "../../categories/shared";

export const GET = withErrorHandler(async () => buildCategoriesResponse());
