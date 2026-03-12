/**
 * 获取角色列表
 *
 * 获取当前用户创建的所有数字人角色
 *
 * @route /api/v1/video/characters
 * @method GET - 获取角色列表
 * @returns {Promise<Object>} 角色列表 { characters: Character[] }
 */
import { getAuthUser } from "@/lib/http";
import { videoTaskRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const characters = await videoTaskRepository.listCharacters(user);
  return successResponse({ characters });
});
