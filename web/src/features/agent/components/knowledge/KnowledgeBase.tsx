"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, del } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { useAuth } from "@/app/providers";
import { SubPageHeader } from "../SubPageHeader";

type KnowledgeDoc = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  created_at: string;
  metadata_json: string;
};

export function KnowledgeBase() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const kbQuery = useQuery({
    queryKey: ["knowledge-documents"],
    queryFn: async () => {
      const result = await get<{ items: KnowledgeDoc[] }>(
        `${getVersionedApiPath("/knowledge")}?page=1&size=50`
      );
      return Array.isArray(result.items) ? result.items : [];
    },
    enabled: isAuthenticated,
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: string) => {
      await del(getVersionedApiPath(`/knowledge/${id}`));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
    },
  });

  if (!isAuthenticated) {
    return <div className="studio-empty">请先登录后查看私有知识库。</div>;
  }

  const docs = kbQuery.data || [];

  return (
    <div className="space-y-6">
      <SubPageHeader
        title="私有知识库"
        description="管理供 AI 代理调用和检索的文档语料。"
        action={
          <button className="studio-btn studio-btn-primary" onClick={() => void kbQuery.refetch()}>
            {kbQuery.isFetching ? "刷新中..." : "刷新列表"}
          </button>
        }
      />

      {kbQuery.isLoading ? (
        <div className="text-center py-20 text-zinc-500">正在获取知识库文档...</div>
      ) : docs.length === 0 ? (
        <div className="studio-empty bg-white/5 border border-white/5 rounded-xl">
          <div className="mb-4">
            <svg className="w-12 h-12 text-zinc-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </div>
          <p className="text-zinc-400">知识库为空</p>
          <p className="text-zinc-500 text-sm mt-2">在外部对话中同步历史内容即可存入知识库。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc) => (
            <div key={doc.id} className="bg-[#1e293b] border border-white/10 rounded-xl p-5 hover:border-blue-500/30 transition-colors flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${doc.status === "indexed" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                  {doc.status === "indexed" ? "已索引" : doc.status}
                </span>

                <button
                  onClick={() => deleteDocMutation.mutate(doc.id)}
                  disabled={deleteDocMutation.isPending && deleteDocMutation.variables === doc.id}
                  className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors"
                  title="删除文档"
                >
                  {deleteDocMutation.isPending && deleteDocMutation.variables === doc.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  )}
                </button>
              </div>

              <h4 className="font-medium text-zinc-100 line-clamp-2 mb-2 flex-1" title={doc.title}>
                {doc.title}
              </h4>

              <div className="flex gap-4 text-[11px] text-zinc-500 mt-4 pt-4 border-t border-white/5">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  {doc.source_type}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
