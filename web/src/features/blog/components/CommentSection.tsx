/**
 * CommentSection - 文章评论区域组件
 *
 * 负责评论输入、树形展示、分页、回复和管理员编辑删除。
 * 评论数据本身由外层缓存 Hook 提供，这里主要处理页面交互和层级结构转换。
 */
"use client";

import { useMemo, useState } from "react";
import { MessageCircleIcon, ThumbsDownIcon, ThumbsUpIcon } from "@/components/Icons";
import UserHoverCard from "@/features/blog/components/UserHoverCard";
import { getThumbnailUrl } from "@/utils/url";
import { useAuth } from "@/app/providers";
import type { CommentListItem } from "@/types";
import { useCommentActions, useSubmitComment } from "../hooks";

type CommentNode = CommentListItem & {
  children: CommentNode[];
  reply_to?: string;
  reply_to_id?: number;
  root_id?: number;
};

type CommentSectionProps = {
  slug: string;
  comments: CommentListItem[];
  commentListStatus: "loading" | "error" | "ready";
  isAdmin: boolean;
  refreshPost: () => Promise<void>;
  refreshComments: () => Promise<void>;
};

/**
 * 构建评论树形结构
 *
 * 顶层评论做分页，回复挂到各自主楼下，避免回复内容被拆到不同分页里。
 *
 * @param {CommentListItem[]} list - 扁平评论列表
 * @returns {CommentNode[]} 树形评论数组
 */
function buildCommentTree(list: CommentListItem[]) {
  const nodes = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  list.forEach((item) => {
    nodes.set(item.id, { ...item, children: [] });
  });

  nodes.forEach((node) => {
    if (node.parent_id && nodes.has(node.parent_id)) {
      const parent = nodes.get(node.parent_id);
      if (!parent) return;
      node.reply_to = parent.author_name || parent.author || "用户";
      node.reply_to_id = parent.id;
      node.root_id = parent.root_id || parent.id;
      parent.children.push(node);
      return;
    }
    node.root_id = node.id;
    roots.push(node);
  });

  const sortByDate = (a: CommentNode, b: CommentNode) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const sortTree = (items: CommentNode[]) => {
    items.sort(sortByDate);
    items.forEach((child) => sortTree(child.children));
  };

  sortTree(roots);
  return roots;
}

export function CommentSection({
  slug,
  comments,
  commentListStatus,
  isAdmin,
  refreshPost,
  refreshComments,
}: CommentSectionProps) {
  const { isAuthenticated } = useAuth();
  const { submitComment, submitting } = useSubmitComment();
  const { likeComment, dislikeComment, updateComment, deleteComment } =
    useCommentActions();
  const [commentText, setCommentText] = useState("");
  const [commentStatus, setCommentStatus] = useState("");
  const [replyTo, setReplyTo] = useState<CommentNode | null>(null);
  const [commentPage, setCommentPage] = useState(1);
  const [expandedReplies, setExpandedReplies] = useState<Record<number, boolean>>({});
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const commentsPerPage = 5;

  const commentRoots = useMemo(() => buildCommentTree(comments), [comments]);
  const totalCommentPages = Math.max(1, Math.ceil(commentRoots.length / commentsPerPage));
  const pagedRoots = commentRoots.slice(
    (commentPage - 1) * commentsPerPage,
    commentPage * commentsPerPage
  );

  // 成功后同步刷新评论列表和文章详情，让评论数与树结构一起更新。
  async function handleCommentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setCommentStatus("");
    if (!isAuthenticated) {
      setCommentStatus("请先登录后再操作。");
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentStatus("请输入评论内容。");
      return;
    }

    try {
      const result = await submitComment({
        isAuthenticated,
        slug,
        content: trimmed,
        replyTo,
      });
      if (!result.ok) {
        setCommentStatus(result.message);
        return;
      }

      setCommentText("");
      setReplyTo(null);
      setCommentStatus(result.message);
      setCommentPage(1);
      await refreshComments();
      await refreshPost();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("blog-updated", { detail: { slug } }));
      }
    } catch {
      setCommentStatus("评论失败。");
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!confirm("确定要删除这条评论吗？")) return;
    const result = await deleteComment({ isAuthenticated, commentId });
    if (!result.ok) {
      alert(result.message);
      return;
    }

    setEditingCommentId(null);
    setEditingCommentContent("");
    await refreshComments();
    await refreshPost();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("blog-updated", { detail: { slug } }));
    }
  }

  async function handleUpdateComment(commentId: number) {
    if (!editingCommentContent.trim()) return;
    const result = await updateComment({
      isAuthenticated,
      commentId,
      content: editingCommentContent,
    });
    if (!result.ok) {
      alert(result.message);
      return;
    }

    setEditingCommentId(null);
    setEditingCommentContent("");
    await refreshComments();
    await refreshPost();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("blog-updated", { detail: { slug } }));
    }
  }

  // 点击回复时预填 @ 前缀，减少用户重复输入回复对象。
  function handleReplyClick(comment: CommentNode) {
    const name = comment.author_name || comment.author || "用户";
    const prefix = `@${name} `;
    setReplyTo(comment);
    setCommentText((value) => (value.startsWith(prefix) ? value : prefix));
  }

  function renderComment(node: CommentNode, depth = 0): React.ReactNode {
    const isReply = depth > 0;
    const isExpanded = !!expandedReplies[node.id];
    const replySlice = isExpanded ? node.children : node.children.slice(0, 5);

    return (
      <div
        key={node.id}
        id={`comment-${node.id}`}
        className={`comment-item border-b border-subtle p-4 ${
          isReply ? "ml-8 border-l-2 border-l-subtle pl-4" : ""
        }`}
      >
        <div className="flex gap-4">
          <UserHoverCard username={node.author}>
            {node.author_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getThumbnailUrl(node.author_avatar, 64)}
                alt={node.author_name}
                loading="lazy"
                decoding="async"
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <div className="avatar-fallback h-8 w-8 text-xs">
                {node.author_name?.[0] || "U"}
              </div>
            )}
          </UserHoverCard>
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <UserHoverCard username={node.author} disableHover={true}>
                <strong className="cursor-pointer text-sm hover:text-blue-400">
                  {node.author_name || node.author}
                </strong>
              </UserHoverCard>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                Lv1
              </span>
              <span className="ml-auto text-xs text-muted">
                {new Date(node.created_at).toLocaleString()}
              </span>
            </div>
            {node.reply_to && (
              <div className="mb-2 text-xs text-muted">
                回复{" "}
                <a
                  href={`#comment-${node.reply_to_id}`}
                  className="text-accent hover:underline"
                >
                  @{node.reply_to}
                </a>
              </div>
            )}
            {editingCommentId === node.id ? (
              <div className="mb-2">
                <textarea
                  className="input mb-2 w-full p-2 text-sm"
                  rows={3}
                  value={editingCommentContent}
                  onChange={(event) => setEditingCommentContent(event.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="btn-primary btn-sm"
                    type="button"
                    onClick={() => void handleUpdateComment(node.id)}
                  >
                    保存
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    type="button"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditingCommentContent("");
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <p className="mb-3 text-sm leading-relaxed text-primary">{node.content}</p>
            )}
            <div className="flex gap-3 text-xs text-muted">
              <button
                className="cursor-pointer transition-colors hover:text-primary"
                type="button"
                onClick={async () => {
                  const result = await likeComment({ isAuthenticated, commentId: node.id });
                  if (!result.ok) {
                    setCommentStatus(result.message);
                    return;
                  }
                  await refreshComments();
                }}
              >
                <ThumbsUpIcon className="inline" /> {node.like_count ?? 0}
              </button>
              <button
                className="cursor-pointer transition-colors hover:text-primary"
                type="button"
                onClick={async () => {
                  const result = await dislikeComment({
                    isAuthenticated,
                    commentId: node.id,
                  });
                  if (!result.ok) {
                    setCommentStatus(result.message);
                    return;
                  }
                  await refreshComments();
                }}
              >
                <ThumbsDownIcon className="inline" /> {node.dislike_count ?? 0}
              </button>
              <button
                className="cursor-pointer transition-colors hover:text-primary"
                type="button"
                onClick={() => handleReplyClick(node)}
              >
                <MessageCircleIcon className="inline" /> 回复
              </button>
              {isAdmin && (
                <>
                  <button
                    className="ml-2 cursor-pointer transition-colors hover:text-primary"
                    type="button"
                    onClick={() => {
                      setEditingCommentId(node.id);
                      setEditingCommentContent(node.content);
                    }}
                  >
                    编辑
                  </button>
                  <button
                    className="cursor-pointer transition-colors hover:text-red-500"
                    type="button"
                    onClick={() => void handleDeleteComment(node.id)}
                  >
                    删除
                  </button>
                </>
              )}
            </div>

            {depth === 0 && node.children.length > 0 && (
              <div className="mt-4 space-y-4">
                {replySlice.map((child) => renderComment(child, depth + 1))}
                {node.children.length > 5 && (
                  <button
                    className="mt-2 text-xs text-accent hover:underline"
                    type="button"
                    onClick={() =>
                      setExpandedReplies((previous) => ({
                        ...previous,
                        [node.id]: !isExpanded,
                      }))
                    }
                  >
                    {isExpanded ? "收起回复" : `更多回复 (${node.children.length - 5})`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="card comments post-comments">
      <form className="form" onSubmit={handleCommentSubmit}>
        <label>
          评论
          <textarea
            rows={4}
            value={commentText}
            disabled={!isAuthenticated}
            onChange={(event) => setCommentText(event.target.value)}
            onKeyDown={(event) => {
              if (!isAuthenticated) return;
              // Enter 直接发送，Shift+Enter 保留换行，更贴近即时交流体验。
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleCommentSubmit(
                  event as unknown as React.FormEvent<HTMLFormElement>
                );
              }
            }}
            placeholder={
              replyTo
                ? `回复 @${replyTo.author_name || replyTo.author}`
                : "写下你的观点... (按 Enter 发送)"
            }
          />
        </label>
        {!isAuthenticated && <p className="mt-2 text-xs text-muted">请先登录后评论。</p>}
        {commentStatus && <p className="status">{commentStatus}</p>}
        <div className="mt-2 flex justify-end">
          <button
            className="btn-primary"
            type="submit"
            disabled={!isAuthenticated || submitting}
          >
            {submitting ? "提交中..." : "评论"}
          </button>
        </div>
      </form>

      <div className="comment-list">
        {commentListStatus === "error" && (
          <p className="text-accent">评论加载失败，请刷新重试。</p>
        )}
        {commentListStatus === "ready" && commentRoots.length === 0 && (
          <p className="muted">暂无评论。</p>
        )}
        {pagedRoots.map((comment) => renderComment(comment))}
      </div>

      {totalCommentPages > 1 && (
        <div className="pagination">
          <button
            className="button ghost"
            type="button"
            onClick={() => setCommentPage((page) => Math.max(1, page - 1))}
            disabled={commentPage === 1}
          >
            上一页
          </button>
          <span className="muted">
            第 {commentPage} / {totalCommentPages} 页
          </span>
          <button
            className="button ghost"
            type="button"
            onClick={() =>
              setCommentPage((page) => Math.min(totalCommentPages, page + 1))
            }
            disabled={commentPage === totalCommentPages}
          >
            下一页
          </button>
        </div>
      )}
    </section>
  );
}
