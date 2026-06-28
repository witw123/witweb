/**
 * TagInput - 多标签输入组件
 *
 * 以逗号分隔字符串作为外部值，内部提供 chip 式增删交互，兼容现有文章 API。
 */
"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils/cn";

type TagInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function parseTags(value: string): string[] {
  const seen = new Set<string>();
  return String(value || "")
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function serializeTags(tags: string[]): string {
  return tags.join(",");
}

export function TagInput({
  value,
  onChange,
  placeholder = "输入标签后按回车",
  disabled,
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const tags = parseTags(value);

  const commitDraft = useCallback(() => {
    const nextTags = parseTags(`${serializeTags(tags)},${draft}`);
    if (nextTags.length !== tags.length || draft.trim()) {
      onChange(serializeTags(nextTags));
    }
    setDraft("");
  }, [draft, onChange, tags]);

  const removeTag = useCallback(
    (index: number) => {
      onChange(serializeTags(tags.filter((_, currentIndex) => currentIndex !== index)));
    },
    [onChange, tags],
  );

  return (
    <div
      className={cn(
        "min-h-[42px] w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-2",
        "focus-within:border-blue-500 transition-colors",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-100"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              aria-label={`移除标签 ${tag}`}
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-200 hover:bg-blue-300/20 hover:text-white"
              onClick={() => removeTag(index)}
              disabled={disabled}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm text-zinc-100 placeholder-zinc-600 outline-none"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === "，") {
              event.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          placeholder={tags.length ? "" : placeholder}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default TagInput;
