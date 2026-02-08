"use client";

export function AgentGallery() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-zinc-800/50 p-6">
        <svg className="h-10 w-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-white">作品库</h3>
      <p className="mt-2 text-sm text-zinc-500">这里将展示所有通过 AI 代理生成的文章和内容。</p>
      <div className="mt-6 rounded-lg bg-zinc-900/50 px-4 py-2 text-xs text-zinc-600">
        功能开发中...
      </div>
    </div>
  );
}
