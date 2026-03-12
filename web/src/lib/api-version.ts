/**
 * API 版本控制工具
 *
 * 统一处理 API 版本前缀、旧路径迁移统计和弃用响应标注。
 * 这些逻辑集中放在这里，避免每个路由都各自维护版本文案与迁移埋点。
 */

/** 当前 API 版本号 */
export const CURRENT_API_VERSION = "v1" as const;

/** 已弃用 API 的使用记录 */
type DeprecatedApiUsageRecord = {
  /** 已弃用的路径 */
  deprecatedPath: string;
  /** 替代路径 */
  replacementPath: string;
  /** 使用次数 */
  count: number;
  /** 最后使用时间 */
  lastUsedAt: string;
};

const deprecatedApiUsage = new Map<string, DeprecatedApiUsageRecord>();

/**
 * 获取带版本号的 API 路径
 *
 * @param path - API 路径（如 /users 或 users）
 * @param version - API 版本（默认当前版本）
 * @returns 完整版本化路径（如 /api/v1/users）
 */
export function getVersionedApiPath(path: string, version = CURRENT_API_VERSION): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/api/${version}${normalized}`;
}

/**
 * 规范化已弃用路径
 *
 * 如果调用方没有显式传入旧路径，则根据替代路径推导出当前版本前缀之前的相对路径，
 * 方便后续把同一迁移关系聚合到一条统计记录上。
 *
 * @param {string} deprecatedPath - 已弃用路径
 * @param {string} replacementPath - 当前替代路径
 * @returns {string} 规范化后的旧路径
 */
function normalizeDeprecatedPath(deprecatedPath: string, replacementPath: string): string {
  if (deprecatedPath.trim()) return deprecatedPath;

  const versionPrefix = `/api/${CURRENT_API_VERSION}`;
  if (replacementPath.startsWith(versionPrefix)) {
    return replacementPath.slice(versionPrefix.length) || "/";
  }

  return replacementPath;
}

/**
 * 记录已弃用 API 的使用情况
 *
 * 用于追踪迁移进度，在内存中维护使用统计。
 *
 * @param replacementPath - 替代路径
 * @param deprecatedPath - 已弃用的路径
 * @returns 更新后的使用记录
 */
export function recordDeprecatedApiUsage(replacementPath: string, deprecatedPath = ""): DeprecatedApiUsageRecord {
  const normalizedDeprecatedPath = normalizeDeprecatedPath(deprecatedPath, replacementPath);
  // 以“旧路径=>新路径”作为 key，允许同一替代路径同时追踪多个历史入口。
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

/**
 * 获取所有已弃用 API 的使用记录
 *
 * @returns 按路径排序的使用记录数组
 */
export function getDeprecatedApiUsage(): DeprecatedApiUsageRecord[] {
  return [...deprecatedApiUsage.values()].sort((a, b) => a.deprecatedPath.localeCompare(b.deprecatedPath));
}

/**
 * 清空已弃用 API 使用记录
 */
export function clearDeprecatedApiUsage(): void {
  deprecatedApiUsage.clear();
}

/**
 * 为已弃用的 API 响应添加标准 HTTP 弃用头
 *
 * 设置 Deprecation、Sunset、Link 和 X-Deprecated-Route 头。
 *
 * @param response - 要标注的响应对象
 * @param replacementPath - 替代路径
 * @param deprecatedPath - 已弃用的路径
 * @returns 添加了弃用头的响应
 */
export function annotateDeprecatedResponse(
  response: Response,
  replacementPath: string,
  deprecatedPath = "",
): Response {
  // 先记录命中，再写出标准弃用响应头，便于日志与客户端同时感知迁移状态。
  const usage = recordDeprecatedApiUsage(replacementPath, deprecatedPath);

  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", "2026-12-31");
  response.headers.set("Link", `<${replacementPath}>; rel="successor-version"`);
  response.headers.set("X-Deprecated-Route", usage.deprecatedPath);
  return response;
}
