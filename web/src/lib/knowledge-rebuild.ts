import "server-only";

import { indexKnowledgeDocument } from "@/lib/knowledge";
import { agentPlatformRepository } from "@/lib/repositories";

export async function rebuildKnowledgeEmbeddings(
  username: string,
  input?: {
    limit?: number;
    offset?: number;
    sourceTypes?: string[];
  }
) {
  const documents = await agentPlatformRepository.listKnowledgeDocuments(username, {
    limit: input?.limit,
    offset: input?.offset,
    sourceTypes: input?.sourceTypes,
  });

  const rebuilt: Array<{
    document_id: string;
    source_type: string;
    embedding_model: string;
    chunk_count: number;
    status: string;
  }> = [];

  for (const document of documents) {
    const metadata = (() => {
      try {
        return JSON.parse(document.metadata_json || "{}") as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    const result = await indexKnowledgeDocument(username, {
      documentId: document.id,
      sourceType: document.source_type,
      title: document.title,
      body: document.body,
      metadata,
    });

    rebuilt.push({
      document_id: result.document_id,
      source_type: document.source_type,
      embedding_model: result.embedding_model,
      chunk_count: result.chunk_count,
      status: result.status,
    });
  }

  return {
    username,
    rebuilt_count: rebuilt.length,
    embedding_models: Array.from(new Set(rebuilt.map((item) => item.embedding_model))),
    documents: rebuilt,
  };
}
