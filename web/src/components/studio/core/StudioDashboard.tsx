"use client";

import { Dispatch, SetStateAction } from "react";

interface DashboardProps {
  setActiveTab: Dispatch<SetStateAction<string>>;
}

export function StudioDashboard({ setActiveTab }: DashboardProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-0 top-0 -z-10 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />

      <button
        onClick={() => setActiveTab("video-create")}
        className="group w-full rounded-[2rem] border border-zinc-800 bg-[#0b0d12] p-8 text-left transition-all duration-300 hover:border-zinc-700 hover:bg-[#10131a] md:p-12"
      >
        <div className="flex items-center gap-6 md:gap-10">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] border border-zinc-800 bg-[#11131a] text-zinc-100 transition group-hover:border-zinc-600 md:h-28 md:w-28 md:rounded-[2rem]">
            <svg className="h-11 w-11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-2xl font-bold tracking-tight text-white md:text-4xl">视频生成</h3>
            <p className="mt-2 text-sm text-zinc-400 md:text-[34px] md:leading-tight">
              一站式视频创作中心：包含视频合成、角色训练、任务监控与作品管理。
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}
