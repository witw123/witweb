import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "change-this-secret");
const algo = "HS256";

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
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const username = await verifyToken(token);
    return username ? { username } : null;
  } catch (err) {
    return null;
  }
}
