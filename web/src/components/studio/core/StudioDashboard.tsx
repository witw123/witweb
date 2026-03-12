"use client";

/**
 * StudioDashboard 创作工作台仪表盘组件
 *
 * 显示工作台的主要功能入口卡片：
 * - 视频生成
 * - 选题雷达
 *
 * @component
 * @example
 * <StudioDashboard setActiveTab={setTab} />
 */

import { Dispatch, SetStateAction } from "react";

/**
 * StudioDashboard 组件属性
 */
interface DashboardProps {
  setActiveTab: Dispatch<SetStateAction<string>>;
}

/**
 * StudioDashboard 工作台仪表盘
 */
export function StudioDashboard({ setActiveTab }: DashboardProps) {
  return (
    <div className="relative grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      <div className="pointer-events-none absolute right-0 top-0 -z-10 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />

      <button
        onClick={() => setActiveTab("video-create")}
        className="group w-full rounded-[2rem] border border-zinc-800 bg-[#0b0d12] p-8 text-left transition-all duration-300 hover:border-zinc-700 hover:bg-[#10131a] md:p-10"
      >
        <div className="flex flex-col gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] border border-zinc-800 bg-[#11131a] text-zinc-100 transition group-hover:border-zinc-600">
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
            <h3 className="text-[34px] leading-none font-bold tracking-tight text-white">视频生成</h3>
            <p className="mt-2 text-sm text-zinc-400">
              一站式视频创作流程，支持生成、任务追踪、角色训练和结果管理。
            </p>
          </div>
        </div>
      </button>


      <button
        onClick={() => setActiveTab("radar")}
        className="group w-full rounded-[2rem] border border-zinc-800 bg-[#0b0d12] p-8 text-left transition-all duration-300 hover:border-zinc-700 hover:bg-[#10131a] md:p-10"
      >
        <div className="flex flex-col gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] border border-zinc-800 bg-[#11131a] text-zinc-100 transition group-hover:border-zinc-600">
            <svg className="h-11 w-11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M12 4v4m0 8v4m8-8h-4M8 12H4m13.657-5.657l-2.828 2.828M9.17 14.83l-2.827 2.827m0-11.314L9.17 9.17m5.657 5.657l2.828 2.828" />
              <circle cx="12" cy="12" r="3.2" strokeWidth="1.6" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-[34px] leading-none font-bold tracking-tight text-white">选题雷达</h3>
            <p className="mt-2 text-sm text-zinc-400">
              聚合多个站点热点，支持手动新增来源，快速发现高热选题。
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}
