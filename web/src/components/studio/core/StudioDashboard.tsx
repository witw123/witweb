"use client";

import { Dispatch, SetStateAction } from "react";

interface DashboardProps {
  setActiveTab: Dispatch<SetStateAction<string>>;
}

export function StudioDashboard({ setActiveTab }: DashboardProps) {
  const tools = [
    {
      category: "核心功能",
      items: [
        {
          id: "video-create",
          title: "视频生成",
          desc: "一站式视频创作中心：包含视频合成、角色训练、任务监控与作品库管理。",
          icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ),
          color: "bg-blue-500",
          gradient: "from-blue-600 to-cyan-500"
        },
      ],
    },
  ];

  return (
    <div className="space-y-12 relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      <div className="space-y-4">
        <h1 className="text-4xl font-black text-white tracking-tight font-heading flex items-center gap-3">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">创作工作台</span>
          <span className="px-3 py-1 bg-white/10 text-[10px] text-white/80 rounded-full font-mono font-medium tracking-normal border border-white/5">v2.0</span>
        </h1>
        <p className="text-zinc-400 text-sm font-light max-w-2xl leading-relaxed">
          欢迎来到您的 AIGC 指挥中心。选择下方的功能模块开始您的创作，或管理现有的数字资产。
        </p>
      </div>

      <div className="space-y-12">
        {tools.map((section) => (
          <div key={section.category} className="space-y-6">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] font-heading flex items-center gap-4">
              <span>{section.category}</span>
              <div className="h-[1px] flex-1 bg-zinc-800" />
            </h3>

            <div className="grid grid-cols-1 gap-6">
              {section.items.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTab(tool.id)}
                  className="group relative bg-[#0a0a0a] hover:bg-[#111111] border border-zinc-800 hover:border-zinc-700/80 rounded-[2rem] p-1 text-left transition-all duration-500 shadow-lg hover:shadow-2xl overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className="relative h-full bg-[#0a0a0a] rounded-[1.8rem] p-8 flex items-center gap-8 z-10 overflow-hidden">
                    {/* Glossy Effect */}
                    <div className={`absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br ${tool.gradient} opacity-[0.03] group-hover:opacity-[0.08] blur-[80px] transition-all duration-700 rounded-full`} />

                    <div className={`p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800 text-white shadow-inner group-hover:scale-110 group-hover:bg-zinc-800 transition-all duration-500 relative shrink-0`}>
                      <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-3xl`} />
                      {tool.icon}
                    </div>

                    <div className="space-y-2 flex-1">
                      <h4 className="text-2xl font-bold text-zinc-100 group-hover:text-white transition-colors tracking-wide flex items-center justify-between">
                        {tool.title}
                        <svg className="w-6 h-6 text-zinc-600 group-hover:text-white/60 -translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </h4>
                      <p className="text-sm text-zinc-500 group-hover:text-zinc-400 leading-relaxed font-light">
                        {tool.desc}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
