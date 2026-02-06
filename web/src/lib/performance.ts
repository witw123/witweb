"use client";

/**
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

const metrics: PerformanceMetrics = {
  apiResponseTime: {},
};

/**
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
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
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
 */
export function getMetrics(): PerformanceMetrics {
  return { ...metrics };
}

/**
 */
function logMetric(name: string, value: number | undefined): void {
  if (value === undefined) return;
  
  if (process.env.NODE_ENV === "development") {
    console.log(`[Performance] ${name}: ${value.toFixed(2)}ms`);
  }

  // gtag('event', 'web_vitals', { name, value });
}

/**
 */
export function debounce<T extends (...args: any[]) => void>(
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
 */
export function throttle<T extends (...args: any[]) => void>(
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
