"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Category } from "@/types/blog";

interface CategoryFilterProps {
  value: string;
  onChange: (value: string) => void;
  categories: Category[];
  placeholder?: string;
}

export function CategoryFilter({
  value,
  onChange,
  categories,
  placeholder = "全部分类",
}: CategoryFilterProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const closeTimerRef = useRef<number | null>(null);

  const options = useMemo(
    () => [{ id: 0, slug: "", name: placeholder } as const, ...categories.map((item) => ({ id: item.id, slug: item.slug, name: item.name }))],
    [categories, placeholder]
  );

  const selectedIndex = useMemo(() => {
    const idx = options.findIndex((item) => item.slug === value);
    return idx >= 0 ? idx : 0;
  }, [options, value]);

  const selectedLabel = options[selectedIndex]?.name ?? placeholder;

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const openDropdown = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setMounted(true);
    setActiveIndex(selectedIndex);
    window.requestAnimationFrame(() => setOpen(true));
  }, [selectedIndex]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
    }, 160);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDropdown();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [closeDropdown]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    []
  );

  function handleSelect(next: string) {
    onChange(next);
    closeDropdown();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openDropdown();
      return;
    }

    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % options.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0) {
        handleSelect(options[activeIndex].slug);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
    }
  }

  return (
    <div ref={rootRef} className="relative isolate w-full">
      <button
        type="button"
        className={`relative h-[52px] w-full rounded-full border px-4 pr-11 text-left text-base text-zinc-100 transition-all ${
          open
            ? "z-20 border-blue-500 bg-zinc-900 ring-2 ring-blue-500/60"
            : "border-zinc-700 bg-zinc-800 hover:border-zinc-500"
        }`}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `category-option-${activeIndex}` : undefined}
      >
        <span className={`${value ? "text-zinc-100" : "text-zinc-300"} font-semibold`}>{selectedLabel}</span>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {mounted && (
        <div
          className={`absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-3xl border border-blue-500/30 bg-zinc-950/95 p-1 backdrop-blur-md shadow-[0_16px_42px_rgba(0,0,0,0.52)] transition-all duration-150 ${
            open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-[0.99] opacity-0"
          }`}
          onMouseDown={(event) => event.preventDefault()}
        >
          <ul id={listboxId} role="listbox" className="max-h-72 overflow-y-auto py-2">
            {options.map((option, index) => {
              const isSelected = value === option.slug;
              const isActive = index === activeIndex;
              return (
                <li key={`${option.id}-${option.slug}`} className="px-2">
                  <button
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    id={`category-option-${index}`}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      isSelected
                        ? "border border-blue-500/40 bg-blue-500/15 text-blue-200"
                        : isActive
                          ? "bg-zinc-800/90 text-zinc-100"
                          : "text-zinc-200 hover:bg-zinc-800/70 hover:text-zinc-100"
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleSelect(option.slug)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span>{option.name}</span>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
