import "server-only";

import { indexKnowledgeDocument } from "@/lib/knowledge";
import { aboutRepository, postRepository } from "@/lib/repositories";
import { syncPostKnowledge } from "@/lib/content-sync";

export async function backfillCreatorKnowledge(
  username: string,
  input?: {
    includePosts?: boolean;
    includeAbout?: boolean;
    limit?: number;
  }
) {
  const includePosts = input?.includePosts !== false;
  const includeAbout = input?.includeAbout !== false;
  const limit = Math.max(1, Math.min(500, input?.limit || 100));

  let postsIndexed = 0;
  let aboutIndexed = 0;
  const documents: string[] = [];

  if (includePosts) {
    const posts = await postRepository.listKnowledgeSourcePosts(username, limit, 0);
    for (const post of posts) {
      const result = await syncPostKnowledge(username, post);
      postsIndexed += 1;
      documents.push(result.document_id);
    }
  }

  if (includeAbout) {
    const about = await aboutRepository.get();
    if (about.content.trim()) {
      const result = await indexKnowledgeDocument(username, {
        documentId: `about_${username}`,
        sourceType: "about_page",
        title: about.title,
        body: [about.subtitle, about.content, about.skills.join(", ")].filter(Boolean).join("\n\n"),
        metadata: {
          subtitle: about.subtitle,
          links: about.links,
          skills: about.skills,
          updated_at: about.updated_at,
          updated_by: about.updated_by,
          reference_label: about.title,
        },
      });
      aboutIndexed = 1;
      documents.push(result.document_id);
    }
  }

  return {
    username,
    posts_indexed: postsIndexed,
    about_indexed: aboutIndexed,
    total_documents: documents.length,
    document_ids: documents,
  };
}
