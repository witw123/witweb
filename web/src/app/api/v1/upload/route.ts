/**
 * 文件上传 API
 *
 * 处理通用文件上传请求
 *
 * @route /api/v1/upload
 * @method POST - 上传文件
 */
import { handleUploadPost } from "@/app/api/upload/shared";
import { withErrorHandler } from "@/middleware/error-handler";

export const POST = withErrorHandler(async (req) => handleUploadPost(req));
