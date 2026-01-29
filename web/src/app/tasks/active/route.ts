import { getActiveTasks } from "@/lib/studio";

export async function GET() {
  return Response.json(getActiveTasks());
}
