"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getVersionedApiPath } from "@/lib/api-version";
import { logError } from "@/lib/logger";
import { queryKeys } from "@/lib/query-keys";

type PublishPostInput = {
  title: string;
  content: string;
  tags: string;
  categoryId: string;
  excerpt?: string;
  coverImageUrl?: string;
  slug?: string; // If provided, update existing post
};

type PublishPostResult = {
  ok: boolean;
  message: string;
  slug?: string;
};

export function usePublishPost() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: PublishPostInput): Promise<PublishPostResult> => {
      const isUpdate = Boolean(input.slug);

      const url = isUpdate
        ? getVersionedApiPath(`/blog/${input.slug}`)
        : getVersionedApiPath("/blog");

      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: input.title,
          content: input.content,
          tags: input.tags,
          category_id: input.categoryId ? Number(input.categoryId) : null,
          excerpt: input.excerpt || null,
          cover_image_url: input.coverImageUrl || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        throw {
          message: payload?.error?.message || (isUpdate ? "更新失败。" : "发布失败。"),
          status: res.status,
        };
      }

      return {
        ok: true,
        message: isUpdate ? "已更新。" : "已发布。",
        slug: payload.data?.slug,
      };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tags(12) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
        queryClient.invalidateQueries({ queryKey: ["posts"] }),
      ]);
    },
    onError: (error, input) => {
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "操作失败。";

      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number(error.status)
          : undefined;

      logError({
        source: "blog.publish",
        error,
        context: {
          status,
          titleLength: input.title.trim().length,
          contentLength: input.content.trim().length,
          categoryId: input.categoryId || null,
          isUpdate: Boolean(input.slug),
        },
        message,
      });
    },
  });

  return {
    publishPost: mutation.mutateAsync,
    publishing: mutation.isPending,
  };
}
