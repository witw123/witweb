import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { authConfig } from "./config";
import { createJwtToken, verifyJwtToken } from "./jwt";

if (typeof window === "undefined" && authConfig.secret.length > 0 && authConfig.secret.length < 32) {
  console.warn("[SECURITY WARNING] AUTH_SECRET should be at least 32 characters long for production use");
}

export async function createToken(
  username: string,
  role: "admin" | "user" | "bot" = "user"
) {
  return createJwtToken(username, authConfig.expiresIn, role);
}

export async function verifyToken(token: string) {
  return verifyJwtToken(token);
}

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

export async function verifyAuth(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7);
  try {
    const username = await verifyToken(token);
    return username ? { username } : null;
  } catch {
    return null;
  }
}
