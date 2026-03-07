import { withErrorHandler } from "@/middleware/error-handler";
import { buildTrackVisitResponse } from "../../track-visit/shared";

export const POST = withErrorHandler(async (request: Request) => buildTrackVisitResponse(request));
