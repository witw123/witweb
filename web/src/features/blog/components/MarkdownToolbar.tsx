/**
 * MarkdownToolbar - Markdown 工具栏组件
 *
 * 为编辑器提供常用 Markdown 操作入口，包括包裹、插入前缀、模板片段和图片上传。
 * 它只负责描述动作，不直接操作正文，真正的文本变换由上层 Hook 处理。
 */
"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils/cn";

export type ToolbarAction =
  | { type: "wrap"; before: string; after: string }
  | { type: "prefix"; prefix: string }
  | { type: "template"; template: string }
  | { type: "handler"; handler: () => void };

export interface ToolbarButton {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  action: ToolbarAction;
}

interface MarkdownToolbarProps {
  onAction: (action: ToolbarAction) => void;
  onImageUpload?: () => void;
  disabled?: boolean;
  className?: string;
}

const BoldIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
  </svg>
);

const ItalicIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4l-4 16h-4l4-16z" />
  </svg>
);

const LinkIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const ImageIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CodeIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const H2Icon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4zm0 6h6v6H4zm10-6h2v12h-2zm6 0h-2v6h2a3 3 0 000-6z" />
  </svg>
);

const ListIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const QuoteIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

/** 单个工具按钮，负责展示图标和快捷键提示。 */
function ToolbarButtonComponent({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        "p-2 rounded-md transition-all duration-200",
        "text-zinc-500 hover:text-zinc-200",
        "hover:bg-zinc-800/80 active:bg-zinc-800 active:scale-95",
        "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
        className
      )}
    >
      {icon}
    </button>
  );
}

export function MarkdownToolbar({ onAction, onImageUpload, disabled, className }: MarkdownToolbarProps) {
  const handleAction = useCallback(
    (action: ToolbarAction) => {
      if (disabled) return;
      onAction(action);
    },
    [onAction, disabled]
  );

  const buttons: ToolbarButton[] = [
    {
      id: "bold",
      icon: BoldIcon,
      label: "加粗",
      shortcut: "Ctrl+B",
      action: { type: "wrap", before: "**", after: "**" },
    },
    {
      id: "italic",
      icon: ItalicIcon,
      label: "斜体",
      shortcut: "Ctrl+I",
      action: { type: "wrap", before: "*", after: "*" },
    },
    {
      id: "heading",
      icon: H2Icon,
      label: "标题",
      action: { type: "prefix", prefix: "## " },
    },
    {
      id: "link",
      icon: LinkIcon,
      label: "链接",
      shortcut: "Ctrl+K",
      action: { type: "template", template: "[{text}](url)" },
    },
    {
      id: "image",
      icon: ImageIcon,
      label: "图片",
      action: { type: "handler", handler: onImageUpload || (() => {}) },
    },
    {
      id: "code",
      icon: CodeIcon,
      label: "代码块",
      shortcut: "Ctrl+Shift+C",
      action: { type: "template", template: "```\n{text}\n```" },
    },
    {
      id: "list",
      icon: ListIcon,
      label: "列表",
      action: { type: "prefix", prefix: "- " },
    },
    {
      id: "quote",
      icon: QuoteIcon,
      label: "引用",
      action: { type: "prefix", prefix: "> " },
    },
  ];

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {buttons.map((button) => (
        <ToolbarButtonComponent
          key={button.id}
          icon={button.icon}
          label={button.label}
          shortcut={button.shortcut}
          onClick={() => handleAction(button.action)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export default MarkdownToolbar;
