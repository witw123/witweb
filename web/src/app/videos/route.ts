import { getLocalVideos } from "@/lib/studio";

export async function GET() {
  return Response.json(getLocalVideos());
}
