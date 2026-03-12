"use client";

/**
 * 性能监控工具
 *
 * 收集和报告前端性能指标，包括页面加载时间、FCP、LCP 等
 * 用于性能优化和问题诊断
 */

interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  
  pageLoadTime?: number;
  apiResponseTime?: Record<string, number[]>;
}

type LayoutShiftEntry = PerformanceEntry & {
  hadRecentInput?: boolean;
  value: number;
};

const metrics: PerformanceMetrics = {
  apiResponseTime: {},
};

/**
 * 初始化 Web Vitals 性能监控
 *
 * 使用 PerformanceObserver 监听 LCP、FID、CLS 等核心 Web 指标
 * 仅在浏览器环境中执行
 */
export function initWebVitalsMonitoring(): void {
  if (typeof window === "undefined") return;

  if ("PerformanceObserver" in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        metrics.lcp = lastEntry.startTime;
        logMetric("LCP", metrics.lcp);
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
    } catch {
    }

    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as LayoutShiftEntry;
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
          }
        }
        metrics.cls = clsValue;
      });
      clsObserver.observe({ entryTypes: ["layout-shift"] });
    } catch {
    }

    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidEntry = entry as PerformanceEventTiming;
          metrics.fid = fidEntry.processingStart - fidEntry.startTime;
          logMetric("FID", metrics.fid);
        }
      });
      fidObserver.observe({ entryTypes: ["first-input"] });
    } catch {
    }
  }

  // TTFB
  if (typeof performance !== "undefined") {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    if (navigation) {
      metrics.ttfb = navigation.responseStart - navigation.startTime;
      logMetric("TTFB", metrics.ttfb);
    }
  }
}

/**
 * 记录 API 响应时间
 *
 * 将 API 请求耗时存储到内存中，用于后续统计分析
 *
 * @param endpoint - API 端点路径
 * @param duration - 请求耗时（毫秒）
 */
export function recordApiTiming(endpoint: string, duration: number): void {
  if (!metrics.apiResponseTime) {
    metrics.apiResponseTime = {};
  }
  if (!metrics.apiResponseTime[endpoint]) {
    metrics.apiResponseTime[endpoint] = [];
  }
  metrics.apiResponseTime[endpoint].push(duration);

  if (metrics.apiResponseTime[endpoint].length > 100) {
    metrics.apiResponseTime[endpoint].shift();
  }
}

/**
 * 获取平均 API 响应时间
 *
 * 计算指定端点或所有端点的平均响应时间
 *
 * @param endpoint - 可选，指定端点；不指定则返回所有端点的统计
 * @returns 指定端点返回平均耗时数字，否则返回端点到耗时的映射对象
 */
export function getAverageApiResponseTime(endpoint?: string): number | Record<string, number> {
  if (!metrics.apiResponseTime) return endpoint ? 0 : {};

  if (endpoint) {
    const times = metrics.apiResponseTime[endpoint];
    if (!times || times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  const result: Record<string, number> = {};
  for (const [key, times] of Object.entries(metrics.apiResponseTime)) {
    if (times.length > 0) {
      result[key] = times.reduce((a, b) => a + b, 0) / times.length;
    }
  }
  return result;
}

/**
 * 记录页面加载时间
 *
 * 监听页面 load 事件，计算页面从导航到完全加载的耗时
 * 仅在浏览器环境中执行
 */
export function recordPageLoadTime(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("load", () => {
    setTimeout(() => {
      const timing = performance.timing;
      metrics.pageLoadTime = timing.loadEventEnd - timing.navigationStart;
      logMetric("Page Load Time", metrics.pageLoadTime);
    }, 0);
  });
}

/**
 * 获取性能指标快照
 *
 * 返回当前收集的所有性能指标的副本
 *
 * @returns 性能指标对象
 */
export function getMetrics(): PerformanceMetrics {
  return { ...metrics };
}

/**
 * 记录性能指标到控制台
 *
 * 在开发环境下输出性能指标，便于调试
 *
 * @param name - 指标名称
 * @param value - 指标值（毫秒）
 */
function logMetric(name: string, value: number | undefined): void {
  if (value === undefined) return;
  
  if (process.env.NODE_ENV === "development") {
    console.log(`[Performance] ${name}: ${value.toFixed(2)}ms`);
  }

  // gtag('event', 'web_vitals', { name, value });
}

/**
 * 防抖函数
 *
 * 返回一个新函数，该函数被调用后，在等待 wait 毫秒内不再被调用才执行原函数
 *
 * @template T - 函数类型
 * @param func - 要防抖的函数
 * @param wait - 等待时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 *
 * 返回一个新函数，该函数被调用后，至少等待 limit 毫秒才会再次执行
 *
 * @template T - 函数类型
 * @param func - 要节流的函数
 * @param limit - 最小执行间隔（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 同步函数性能测量
 *
 * 执行函数并测量其执行耗时，在开发环境输出日志
 *
 * @template T - 返回值类型
 * @param name - 测量名称
 * @param fn - 要执行的函数
 * @returns 函数的返回值
 */
export function measure<T>(name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  if (process.env.NODE_ENV === "development") {
    console.log(`[Measure] ${name}: ${duration.toFixed(2)}ms`);
  }
  
  return result;
}

/**
 * 异步函数性能测量
 *
 * 执行异步函数并测量其执行耗时，在开发环境输出日志
 *
 * @template T - Promise resolve 类型
 * @param name - 测量名称
 * @param fn - 要执行的异步函数
 * @returns Promise 的返回值
 */
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  
  if (process.env.NODE_ENV === "development") {
    console.log(`[Measure] ${name}: ${duration.toFixed(2)}ms`);
  }
  
  return result;
}
