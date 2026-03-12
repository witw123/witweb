"use client";

/**
 * Loading 加载组件
 *
 * 提供统一的旋转加载指示器和可选文本，适合页面级和局部区域的等待态展示。
 */

interface LoadingProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

/** 不同尺寸下的圆环大小与边框粗细。 */
const sizeStyles = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-3",
};

export function Loading({ size = "md", text, className = "" }: LoadingProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`animate-spin rounded-full border-zinc-400 border-t-blue-500 ${sizeStyles[size]}`}
      />
      {text && <p className="text-zinc-400 text-sm">{text}</p>}
    </div>
  );
}
