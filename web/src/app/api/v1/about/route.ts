import { withErrorHandler } from "@/middleware/error-handler";
import { buildAboutGetResponse, buildAboutPutResponse } from "../../about/shared";

export const GET = withErrorHandler(async () => buildAboutGetResponse());
export const PUT = withErrorHandler(async (req: Request) => buildAboutPutResponse(req));
