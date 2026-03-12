import "server-only";

import { dispatchContentEvent } from "@/lib/integrations/n8n";
import { indexKnowledgeDocument } from "@/lib/knowledge";

type SyncablePost = {
  id?: number;
  slug: string;
  title: string;
  content: string;
  excerpt?: string | null;
  tags?: string | null;
  status: string;
  category_id?: number | null;
  cover_image_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

function normalizeTagList(tags: string | null | undefined) {
  return String(tags || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDocumentId(username: string, slug: string) {
  return `blog_${username}_${slug}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

export async function syncPostKnowledge(username: string, post: SyncablePost) {
  return await indexKnowledgeDocument(username, {
    documentId: buildDocumentId(username, post.slug),
    sourceType: "blog_post",
    title: post.title,
    body: post.content,
    metadata: {
      post_id: post.id || null,
      slug: post.slug,
      excerpt: post.excerpt || "",
      tags: normalizeTagList(post.tags),
      status: post.status,
      category_id: post.category_id || null,
      cover_image_url: post.cover_image_url || "",
      reference_label: post.title,
    },
  });
}

export async function syncPostContentLifecycle(
  username: string,
  post: SyncablePost,
  options?: {
    goalId?: string | null;
    dispatchEvent?: boolean;
  }
) {
  const knowledge = await syncPostKnowledge(username, post);

  let delivery: Awaited<ReturnType<typeof dispatchContentEvent>> | null = null;
  if (options?.dispatchEvent) {
    const eventType = post.status === "draft" ? "content.draft.created" : "content.post.published";
    delivery = await dispatchContentEvent(username, {
      eventType,
      goalId: options.goalId || null,
      payload: {
        post: {
          id: post.id || null,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt || "",
          tags: normalizeTagList(post.tags),
          status: post.status,
          updated_at: post.updated_at || null,
        },
      },
    }).catch(() => null);
  }

  return {
    knowledge,
    delivery,
  };
}
