/**
 * 图片上传 API
 *
 * 处理图片文件上传请求
 *
 * @route /api/v1/upload/image
 * @method POST - 上传图片
 */
import { handleUploadPost } from "@/app/api/upload/shared";
import { withErrorHandler } from "@/middleware/error-handler";

export const POST = withErrorHandler(async (req) => handleUploadPost(req));
