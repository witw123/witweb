"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface ActiveArtifact {
  title: string;
  content: string;
  language?: string;
}

interface AgentWorkbenchProps {
  artifact: ActiveArtifact | null;
  onClose: () => void;
}

// Helper to determine default view mode from artifact language
function getDefaultViewMode(language?: string): "preview" | "code" {
  if (language === "markdown" || language === "html" || language === "react") {
    return "preview";
  }
  return "code";
}

export function AgentWorkbench({ artifact, onClose }: AgentWorkbenchProps) {
  // Track user's explicit preference (null = use default)
  const [preferredViewMode, setPreferredViewMode] = useState<"preview" | "code" | null>(null);

  // Derive viewMode during render: user preference takes precedence, otherwise default
  const viewMode = preferredViewMode ?? getDefaultViewMode(artifact?.language);

  if (!artifact) return null;

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0d14] border-l border-white/5 shadow-2xl z-40 transition-all duration-300 md:w-[600px] lg:w-[720px] xl:w-[840px] flex-shrink-0 animate-in slide-in-from-right-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0f172a]/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 -ml-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-zinc-200">{artifact.title}</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{artifact.language || "text"}</span>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
          <button
            onClick={() => setPreferredViewMode("preview")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === "preview" ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            预览
          </button>
          <button
            onClick={() => setPreferredViewMode("code")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === "code" ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            代码
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#0a0d14]">
        {viewMode === "preview" ? (
          <div className="prose prose-invert prose-zinc max-w-none prose-pre:bg-[#0f172a] prose-pre:border prose-pre:border-white/5 prose-a:text-blue-400">
            <ReactMarkdown>{artifact.content}</ReactMarkdown>
          </div>
        ) : (
          <pre className="text-sm font-mono text-zinc-300 whitespace-pre-wrap word-break-all bg-[#0d131f] p-4 rounded-xl border border-white/5">
            <code>{artifact.content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
