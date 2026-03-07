export const CURRENT_API_VERSION = "v1" as const;

type DeprecatedApiUsageRecord = {
  deprecatedPath: string;
  replacementPath: string;
  count: number;
  lastUsedAt: string;
};

const deprecatedApiUsage = new Map<string, DeprecatedApiUsageRecord>();

export function getVersionedApiPath(path: string, version = CURRENT_API_VERSION): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/api/${version}${normalized}`;
}

function normalizeDeprecatedPath(deprecatedPath: string, replacementPath: string): string {
  if (deprecatedPath.trim()) return deprecatedPath;

  const versionPrefix = `/api/${CURRENT_API_VERSION}`;
  if (replacementPath.startsWith(versionPrefix)) {
    return replacementPath.slice(versionPrefix.length) || "/";
  }

  return replacementPath;
}

export function recordDeprecatedApiUsage(replacementPath: string, deprecatedPath = ""): DeprecatedApiUsageRecord {
  const normalizedDeprecatedPath = normalizeDeprecatedPath(deprecatedPath, replacementPath);
  const key = `${normalizedDeprecatedPath}=>${replacementPath}`;
  const current = deprecatedApiUsage.get(key);

  const next: DeprecatedApiUsageRecord = {
    deprecatedPath: normalizedDeprecatedPath,
    replacementPath,
    count: (current?.count || 0) + 1,
    lastUsedAt: new Date().toISOString(),
  };

  deprecatedApiUsage.set(key, next);
  return next;
}

export function getDeprecatedApiUsage(): DeprecatedApiUsageRecord[] {
  return [...deprecatedApiUsage.values()].sort((a, b) => a.deprecatedPath.localeCompare(b.deprecatedPath));
}

export function clearDeprecatedApiUsage(): void {
  deprecatedApiUsage.clear();
}

export function annotateDeprecatedResponse(
  response: Response,
  replacementPath: string,
  deprecatedPath = "",
): Response {
  const usage = recordDeprecatedApiUsage(replacementPath, deprecatedPath);

  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", "2026-12-31");
  response.headers.set("Link", `<${replacementPath}>; rel="successor-version"`);
  response.headers.set("X-Deprecated-Route", usage.deprecatedPath);
  return response;
}
