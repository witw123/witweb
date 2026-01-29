import { headers } from "next/headers";
import { verifyToken } from "./auth";

export async function getAuthUser() {
  const h = await headers();
  const auth = h.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}
