"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { logError } from "@/lib/logger";
import { queryKeys } from "@/lib/query-keys";

type SubmitCommentInput = {
  isAuthenticated: boolean;
  slug: string;
  content: string;
  replyTo:
    | {
        id?: number;
        root_id?: number;
        author?: string;
        author_name?: string;
      }
    | null;
};

type SubmitCommentResult = {
  ok: boolean;
  message: string;
};

export function useSubmitComment() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: SubmitCommentInput): Promise<SubmitCommentResult> => {
      if (!input.isAuthenticated) {
        return { ok: false, message: "请先登录后再操作。" };
      }

      const trimmed = input.content.trim();

      try {
        await post(getVersionedApiPath(`/blog/${input.slug}/comments`), {
          content: input.replyTo
            ? trimmed.startsWith("@")
              ? trimmed
              : `@${input.replyTo.author_name || input.replyTo.author} ${trimmed}`
            : trimmed,
          parent_id: input.replyTo?.root_id || input.replyTo?.id || null,
        });
      } catch (error) {
        const status =
          error && typeof error === "object" && "status" in error
            ? Number(error.status)
            : undefined;
        const message =
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "评论失败。";
        throw { message, status };
      }

      return { ok: true, message: "评论已发布。" };
    },
    onSuccess: async (_result, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.postComments(input.slug) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.postDetail(input.slug) }),
      ]);
    },
    onError: (error, input) => {
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "评论失败。";
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number(error.status)
          : undefined;

      logError({
        source: "blog.post.comment",
        error,
        message,
        context: {
          slug: input.slug,
          status,
          hasReplyTarget: Boolean(input.replyTo),
          contentLength: input.content.trim().length,
        },
      });
    },
  });

  return {
    submitComment: mutation.mutateAsync,
    submitting: mutation.isPending,
  };
}
