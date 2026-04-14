"use client";

import dynamic from "next/dynamic";
import type { MarkdownCodeProps } from "@/features/agent/types";

// Loading skeleton for markdown content
function MarkdownSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-3/4" />
      <div className="h-4 bg-white/10 rounded w-1/2" />
      <div className="h-4 bg-white/10 rounded w-2/3" />
    </div>
  );
}

// Dynamic import of ReactMarkdown to reduce initial bundle
const ReactMarkdown = dynamic(() => import("react-markdown"), {
  loading: MarkdownSkeleton,
  ssr: false,
});

interface MarkdownRendererProps {
  content: string;
  components?: {
    code?: (props: MarkdownCodeProps) => React.ReactNode;
  };
}

export function MarkdownRenderer({ content, components }: MarkdownRendererProps) {
  return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
}

export { ReactMarkdown };
