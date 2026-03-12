"use client";

/**
 * ErrorMonitoringProvider 错误监控提供者组件
 *
 * 在应用程序启动时初始化错误监控系统，
 * 用于捕获和记录客户端运行时的错误信息。
 *
 * @component
 * @example
 * <ErrorMonitoringProvider>
 *   <App />
 * </ErrorMonitoringProvider>
 */

import { useEffect, type ReactNode } from "react";
import { initErrorMonitoring } from "@/lib/monitoring";

/**
 * ErrorMonitoringProvider 组件属性
 */
export default function ErrorMonitoringProvider({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    initErrorMonitoring();
  }, []);

  return <>{children}</>;
}
