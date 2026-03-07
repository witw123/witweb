import { GET as getStats } from "../route";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = url.searchParams.get("days") ?? "7";
  return getStats(
    new Request(`http://localhost/api/v1/admin/stats?view=trends&days=${days}`) as never,
    { params: Promise.resolve({}) }
  );
}
