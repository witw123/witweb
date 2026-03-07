"use client";

import { cn } from "@/lib/utils/cn";
import type { EditorStats } from "@/features/blog/hooks/useMarkdownEditor";

export interface EditorStatusBarProps {
  stats: EditorStats;
  savedAt?: string;
  isSaving?: boolean;
  className?: string;
}

function formatSavedTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "刚刚";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 10) return "刚刚";
  if (diffMin < 1) return `${diffSec} 秒前`;
  if (diffMin < 60) return `${diffMin} 分钟前`;

  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function EditorStatusBar({ stats, savedAt, isSaving, className }: EditorStatusBarProps) {
  const formatNumber = (n: number): string => {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  return (
    <div className={cn("flex items-center gap-4 px-2 py-1.5 text-xs text-zinc-500", className)}>
      {/* Save status */}
      <div className="flex items-center gap-1.5">
        {isSaving ? (
          <>
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>保存中...</span>
          </>
        ) : savedAt ? (
          <>
            <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>已保存 {formatSavedTime(savedAt)}</span>
          </>
        ) : (
          <span>未保存</span>
        )}
      </div>

      <span className="text-zinc-700">|</span>

      {/* Word count */}
      <div className="flex items-center gap-3">
        <span>{formatNumber(stats.chineseChars + stats.words)} 字</span>
        <span>阅读约 {stats.readingTime} 分钟</span>
      </div>
    </div>
  );
}

export default EditorStatusBar;
