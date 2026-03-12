"use client";

/**
 * QueryProvider React Query 提供者组件
 *
 * 负责创建全局唯一的 QueryClient，并注入项目统一的缓存策略。
 * 这里使用 `useState` 延迟初始化，确保客户端生命周期内只创建一次实例。
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
