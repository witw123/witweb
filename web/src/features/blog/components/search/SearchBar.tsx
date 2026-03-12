/**
 * SearchBar - 搜索栏组件
 *
 * 提供文章搜索功能，支持：
 * - 搜索输入
 * - 标签建议
 * - 文章标题建议
 * - 清空搜索
 *
 * @component
 * @param {object} props - 组件属性
 * @param {string} props.value - 当前搜索值
 * @param {(value: string) => void} props.onChange - 输入变更回调
 * @param {(value: string) => void} props.onSearch - 提交搜索回调
 * @param {PostListItem[]} props.posts - 文章列表（用于生成建议）
 * @param {string} [props.placeholder="搜索标题或标签..."] - 占位文本
 * @example
 * <SearchBar
 *   value={query}
 *   onChange={setQuery}
 *   onSearch={handleSearch}
 *   posts={posts}
 * />
 */
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
    <div ref={searchRef} className="blog-search relative w-full min-w-0">
      <div className="blog-search-icon pointer-events-none absolute left-4 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>

      <input
        className="blog-search-input h-[42px] w-full rounded-full text-base transition-all focus:outline-none"
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
          className="blog-search-clear absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors"
          onClick={handleClear}
          aria-label="清空搜索"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {showSuggestions && (filteredTags.length > 0 || filteredTitles.length > 0) && (
        <div
          className="blog-search-panel absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl py-2 backdrop-blur-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filteredTags.length > 0 && (
            <>
              <div className="blog-search-group px-4 py-2 text-xs font-semibold uppercase tracking-wider">标签</div>
              {filteredTags.map((tag) => (
                <button
                  key={`tag-${tag}`}
                  className="blog-search-item flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
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
              <div className="blog-search-group mt-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider">文章</div>
              {filteredTitles.map((title) => (
                <button
                  key={`title-${title}`}
                  className="blog-search-item w-full truncate px-4 py-2 text-left text-sm transition-colors"
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
