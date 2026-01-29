import { getHistory } from "@/lib/studio";

export async function GET() {
  return Response.json(getHistory());
}
