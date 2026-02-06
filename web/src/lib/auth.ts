import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { authConfig } from "./config";

const secret = new TextEncoder().encode(authConfig.secret || "change-this-secret-min-32-characters-long");
const algo = "HS256";

if (typeof window === "undefined" && secret.length < 32) {
  console.warn("[SECURITY WARNING] AUTH_SECRET should be at least 32 characters long for production use");
}

export async function createToken(username: string) {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: algo })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: [algo] });
  return payload.sub as string | undefined;
}

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

import { NextRequest } from "next/server";

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
