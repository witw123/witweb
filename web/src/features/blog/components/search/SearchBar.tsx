"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import type { PostListItem } from "@/types/blog";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  posts: PostListItem[];
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  posts,
  placeholder = "搜索标题或标签...",
}: SearchBarProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const tagSuggestions = useMemo(() => {
    return Array.from(
      new Set(
        posts
          .flatMap((post) => (post.tags || "").split(/[,，]/))
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    );
  }, [posts]);

  const titleSuggestions = useMemo(() => {
    return Array.from(new Set(posts.map((post) => post.title).filter(Boolean)));
  }, [posts]);

  const normalizedInput = value.trim().toLowerCase();
  const filteredTags = normalizedInput
    ? tagSuggestions.filter((tag) => tag.toLowerCase().includes(normalizedInput))
    : [];
  const filteredTitles = normalizedInput
    ? titleSuggestions.filter((title) => title.toLowerCase().includes(normalizedInput))
    : [];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        onSearch(value);
        setShowSuggestions(false);
      }
    },
    [value, onSearch]
  );

  const handleTagClick = useCallback(
    (tag: string) => {
      onChange(tag);
      onSearch(tag);
      setShowSuggestions(false);
    },
    [onChange, onSearch]
  );

  const handleTitleClick = useCallback(
    (title: string) => {
      onChange(title);
      onSearch(title);
      setShowSuggestions(false);
    },
    [onChange, onSearch]
  );

  const handleClear = useCallback(() => {
    onChange("");
    onSearch("");
  }, [onChange, onSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!searchRef.current) return;
      if (!searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div ref={searchRef} className="relative w-full min-w-0">
      <div className="pointer-events-none absolute left-4 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center text-zinc-400">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>

      <input
        className="h-[52px] w-full rounded-full border border-zinc-700 bg-zinc-800 text-base text-zinc-100 transition-all placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
        style={{ paddingLeft: "3.5rem", paddingRight: "3rem" }}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />

      {value && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          onClick={handleClear}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {showSuggestions && (filteredTags.length > 0 || filteredTitles.length > 0) && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/95 py-2 backdrop-blur-md shadow-[0_14px_36px_rgba(0,0,0,0.45)]"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filteredTags.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">标签</div>
              {filteredTags.map((tag) => (
                <button
                  key={`tag-${tag}`}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                  type="button"
                  onClick={() => handleTagClick(tag)}
                >
                  <span className="text-blue-500">#</span> {tag}
                </button>
              ))}
            </>
          )}
          {filteredTitles.length > 0 && (
            <>
              <div className="mt-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">文章</div>
              {filteredTitles.map((title) => (
                <button
                  key={`title-${title}`}
                  className="w-full truncate px-4 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                  type="button"
                  onClick={() => handleTitleClick(title)}
                >
                  {title}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

