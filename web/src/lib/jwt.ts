import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "@/types";

const JWT_ALGORITHM = "HS256";
const DEV_FALLBACK_SECRET = "change-this-secret-min-32-characters-long";

function resolveJwtSecret(): string {
  const configuredSecret = process.env.AUTH_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }

  return DEV_FALLBACK_SECRET;
}

function getJwtSecretKey(): Uint8Array {
  const secret = resolveJwtSecret();
  return new TextEncoder().encode(secret);
}

export async function createJwtToken(
  username: string,
  expiresIn: string,
  role: "super_admin" | "content_reviewer" | "operator" | "admin" | "user" | "bot" = "user"
): Promise<string> {
  return new SignJWT({ sub: username, role })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecretKey());
}

export async function verifyJwtToken(token: string): Promise<string | undefined> {
  const payload = await verifyJwtPayload(token);
  return payload.sub;
}

export async function verifyJwtPayload(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJwtSecretKey(), { algorithms: [JWT_ALGORITHM] });
  return payload as JWTPayload;
}
