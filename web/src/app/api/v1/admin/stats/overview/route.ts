import { GET as getStats } from "../route";

export async function GET() {
  return getStats(
    new Request("http://localhost/api/v1/admin/stats?view=overview") as never,
    { params: Promise.resolve({}) }
  );
}
