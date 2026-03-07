import { useCallback, useRef } from "react";
import type { ToolbarAction } from "@/features/blog/components/MarkdownToolbar";

export interface EditorStats {
  chars: number;
  words: number;
  chineseChars: number;
  readingTime: number;
}

export interface UseMarkdownEditorOptions {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  onPublish?: () => void;
}

export function useMarkdownEditor({ content, onChange, onSave, onPublish }: UseMarkdownEditorOptions) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Calculate statistics
  const stats: EditorStats = calculateStats(content);

  // Insert text at cursor position
  const insertText = useCallback(
    (text: string, replaceSelection = true) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(content + text);
        return;
      }

      const start = textarea.selectionStart || 0;
      const end = replaceSelection ? textarea.selectionEnd || start : start;
      const selectedText = content.slice(start, end);

      const newContent = content.slice(0, start) + text + content.slice(end);
      onChange(newContent);

      // Set cursor position after update
      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPos = start + text.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [content, onChange]
  );

  // Wrap selected text with prefix/suffix
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

      // Select the wrapped text
      requestAnimationFrame(() => {
        textarea.focus();
        const newStart = start + before.length;
        const newEnd = newStart + selectedText.length;
        textarea.setSelectionRange(newStart, newEnd);
      });
    },
    [content, onChange]
  );

  // Insert prefix at line start
  const insertPrefix = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(prefix + content);
        return;
      }

      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || start;

      // Find the start of current line
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

  // Insert from template
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
        // Position cursor after inserted text
        textarea.setSelectionRange(start + text.length, start + text.length);
      });
    },
    [content, onChange]
  );

  // Handle toolbar action
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

  // Handle keyboard shortcuts
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

function calculateStats(content: string): EditorStats {
  const chars = content.length;
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  // Average reading speed: 400 Chinese chars/min or 200 English words/min
  const readingTime = Math.ceil((chineseChars + words * 2) / 400);

  return { chars, words, chineseChars, readingTime };
}

export default useMarkdownEditor;
