/**
 * Markdown 编辑器 Hook
 *
 * 封装正文输入框的快捷编辑能力，包括工具栏动作、快捷键和基础统计。
 * 该 Hook 不持有内容状态本身，只负责基于受控内容计算新值并通过回调回传。
 */

import { useCallback, useRef } from "react";
import type { ToolbarAction } from "@/features/blog/components/MarkdownToolbar";

/** 编辑器统计数据。 */
export interface EditorStats {
  chars: number;
  words: number;
  chineseChars: number;
  readingTime: number;
}

/** Markdown 编辑器配置。 */
export interface UseMarkdownEditorOptions {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  onPublish?: () => void;
}

/**
 * 提供 Markdown 编辑能力
 *
 * @param {UseMarkdownEditorOptions} options - 编辑器配置
 * @returns {object} 编辑器引用、统计和动作处理器
 */
export function useMarkdownEditor({ content, onChange, onSave, onPublish }: UseMarkdownEditorOptions) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const stats: EditorStats = calculateStats(content);

  /**
   * 在光标位置插入文本
   *
   * 当没有 textarea 引用时退化为直接拼接到末尾，保证非聚焦场景也能工作。
   */
  const insertText = useCallback(
    (text: string, replaceSelection = true) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(content + text);
        return;
      }

      const start = textarea.selectionStart || 0;
      const end = replaceSelection ? textarea.selectionEnd || start : start;

      const newContent = content.slice(0, start) + text + content.slice(end);
      onChange(newContent);

      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPos = start + text.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [content, onChange]
  );

  /**
   * 用指定前后缀包裹选中文本
   *
   * 未选中文本时默认填入“文字”，减少工具栏动作后的空结果。
   */
  const wrapSelection = useCallback(
    (before: string, after: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(before + content + after);
        return;
      }

      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || start;
      const selectedText = content.slice(start, end) || "文字";

      const newContent = content.slice(0, start) + before + selectedText + after + content.slice(end);
      onChange(newContent);

      requestAnimationFrame(() => {
        textarea.focus();
        const newStart = start + before.length;
        const newEnd = newStart + selectedText.length;
        textarea.setSelectionRange(newStart, newEnd);
      });
    },
    [content, onChange]
  );

  /** 在当前行行首插入前缀，适合标题、引用和列表。 */
  const insertPrefix = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(prefix + content);
        return;
      }

      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || start;

      const lineStart = content.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = content.indexOf("\n", end);
      const actualLineEnd = lineEnd === -1 ? content.length : lineEnd;

      const lineContent = content.slice(lineStart, actualLineEnd);
      const newContent = content.slice(0, lineStart) + prefix + lineContent + content.slice(actualLineEnd);
      onChange(newContent);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      });
    },
    [content, onChange]
  );

  /** 按模板插入文本，支持用当前选区替换 `{text}` 占位符。 */
  const insertTemplate = useCallback(
    (template: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(content + template.replace("{text}", ""));
        return;
      }

      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || start;
      const selectedText = content.slice(start, end) || "文字";

      const text = template.replace("{text}", selectedText);
      const newContent = content.slice(0, start) + text + content.slice(end);
      onChange(newContent);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      });
    },
    [content, onChange]
  );

  /** 根据工具栏动作类型分派到具体编辑操作。 */
  const handleAction = useCallback(
    (action: ToolbarAction) => {
      switch (action.type) {
        case "wrap":
          wrapSelection(action.before, action.after);
          break;
        case "prefix":
          insertPrefix(action.prefix);
          break;
        case "template":
          insertTemplate(action.template);
          break;
        case "handler":
          action.handler();
          break;
      }
    },
    [wrapSelection, insertPrefix, insertTemplate]
  );

  /**
   * 处理编辑器快捷键
   *
   * 使用 Ctrl/Cmd 作为跨平台修饰键，兼容 Windows 和 macOS。
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod) {
        switch (e.key.toLowerCase()) {
          case "s":
            e.preventDefault();
            onSave?.();
            break;
          case "b":
            e.preventDefault();
            wrapSelection("**", "**");
            break;
          case "i":
            e.preventDefault();
            wrapSelection("*", "*");
            break;
          case "k":
            e.preventDefault();
            insertTemplate("[{text}](url)");
            break;
          case "enter":
            e.preventDefault();
            onPublish?.();
            break;
        }
      }
    },
    [wrapSelection, insertTemplate, onSave, onPublish]
  );

  return {
    textareaRef,
    stats,
    handleAction,
    handleKeyDown,
    insertText,
  };
}

/**
 * 计算编辑器统计数据
 *
 * 中文按字符、英文按词估算阅读时长，提供给状态栏展示。
 *
 * @param {string} content - 当前正文内容
 * @returns {EditorStats} 统计结果
 */
function calculateStats(content: string): EditorStats {
  const chars = content.length;
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const readingTime = Math.ceil((chineseChars + words * 2) / 400);

  return { chars, words, chineseChars, readingTime };
}

export default useMarkdownEditor;
