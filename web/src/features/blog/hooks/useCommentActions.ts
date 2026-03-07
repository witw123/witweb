"use client";

import { del, post, put } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { logError } from "@/lib/logger";

type CommentActionInput = {
  isAuthenticated: boolean;
  commentId: number;
};

type UpdateCommentInput = CommentActionInput & {
  content: string;
};

type CommentActionResult = {
  ok: boolean;
  message: string;
};

export function useCommentActions() {
  async function likeComment(input: CommentActionInput): Promise<CommentActionResult> {
    if (!input.isAuthenticated) {
      return { ok: false, message: "请先登录后再操作。" };
    }

    try {
      await post(getVersionedApiPath(`/comments/${input.commentId}/like`));
      return { ok: true, message: "点赞成功。" };
    } catch (error) {
      logError({
        source: "blog.comment.like",
        error,
        context: { commentId: input.commentId },
      });
      return { ok: false, message: "点赞失败。" };
    }
  }

  async function dislikeComment(input: CommentActionInput): Promise<CommentActionResult> {
    if (!input.isAuthenticated) {
      return { ok: false, message: "请先登录后再操作。" };
    }

    try {
      await post(getVersionedApiPath(`/comments/${input.commentId}/dislike`));
      return { ok: true, message: "点踩成功。" };
    } catch (error) {
      logError({
        source: "blog.comment.dislike",
        error,
        context: { commentId: input.commentId },
      });
      return { ok: false, message: "点踩失败。" };
    }
  }

  async function updateComment(input: UpdateCommentInput): Promise<CommentActionResult> {
    if (!input.isAuthenticated) {
      return { ok: false, message: "请先登录后再操作。" };
    }

    try {
      await put(getVersionedApiPath(`/comments/${input.commentId}`), {
        content: input.content,
      });
      return { ok: true, message: "评论已更新。" };
    } catch (error) {
      logError({
        source: "blog.comment.update",
        error,
        context: {
          commentId: input.commentId,
          contentLength: input.content.trim().length,
        },
      });
      return { ok: false, message: "更新失败。" };
    }
  }

  async function deleteComment(input: CommentActionInput): Promise<CommentActionResult> {
    if (!input.isAuthenticated) {
      return { ok: false, message: "请先登录后再操作。" };
    }

    try {
      await del(getVersionedApiPath(`/comments/${input.commentId}`));
      return { ok: true, message: "评论已删除。" };
    } catch (error) {
      logError({
        source: "blog.comment.delete",
        error,
        context: { commentId: input.commentId },
      });
      return { ok: false, message: "删除失败。" };
    }
  }

  return {
    likeComment,
    dislikeComment,
    updateComment,
    deleteComment,
  };
}
