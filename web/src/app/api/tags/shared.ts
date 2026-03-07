import { successResponse } from "@/lib/api-response";
import { postRepository } from "@/lib/repositories";

export async function buildTagsResponse(): Promise<Response> {
  const tagList = await postRepository.listTagStats();
  return successResponse({
    tags: tagList,
    total: tagList.length,
  });
}
