import "server-only";

type TurnstileVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isTurnstileEnabled(): boolean {
  return isTruthy(process.env.TURNSTILE_ENABLED) && !!process.env.TURNSTILE_SECRET_KEY;
}

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return undefined;
}

export async function verifyTurnstileToken(req: Request, token: string | undefined): Promise<boolean> {
  if (!isTurnstileEnabled()) return true;
  if (!token || !token.trim()) return false;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  const ip = getClientIp(req);
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as TurnstileVerifyResponse;
    return !!data.success;
  } catch {
    return false;
  }
}
