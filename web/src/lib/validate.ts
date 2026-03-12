/**
 * 数据验证工具
 *
 * 基于 Zod 封装请求体验证、查询参数验证和路由参数验证。
 * 这些函数统一把验证失败转换为 API 层可直接返回的业务错误，避免每个路由
 * 自己解析 `ZodError` 并重复拼装字段错误结构。
 */

import { z, ZodError, type ZodType } from "zod";
import { ApiError } from "./api-error";

/** 验证成功结果。 */
export interface ValidationResult<T> {
  success: true;
  data: T;
}

/** 验证失败结果。 */
export interface ValidationError {
  success: false;
  errors: ValidationFieldError[];
}

/** 单个字段的验证错误。 */
export interface ValidationFieldError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * 格式化 Zod 错误为字段错误数组
 *
 * 适合返回给前端逐字段展示，保留错误出现的顺序。
 *
 * @param {ZodError} error - Zod 验证错误
 * @returns {ValidationFieldError[]} 字段错误数组
 */
export function formatZodErrors(error: ZodError): ValidationFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    value: undefined,
  }));
}

/**
 * 格式化 Zod 错误为对象
 *
 * 同一路径只保留第一条错误，适合 API 响应里的扁平字段错误映射。
 *
 * @param {ZodError} error - Zod 验证错误
 * @returns {Record<string, string>} 字段错误对象
 */
export function formatZodErrorsAsObject(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  error.issues.forEach((issue) => {
    const field = issue.path.join(".") || "root";
    if (!result[field]) {
      result[field] = issue.message;
    }
  });
  return result;
}

/**
 * 验证任意数据
 *
 * 适合不依赖 HTTP 请求上下文的纯数据校验场景。
 *
 * @template T - 期望的数据类型
 * @param {ZodType<T>} schema - Zod 验证 Schema
 * @param {unknown} data - 待验证的数据
 * @returns {ValidationResult<T>|ValidationError} 验证结果
 */
export function validate<T>(schema: ZodType<T>, data: unknown): ValidationResult<T> | ValidationError {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * 验证数据并在失败时抛出业务异常
 *
 * @template T - 期望的数据类型
 * @param {ZodType<T>} schema - Zod 验证 Schema
 * @param {unknown} data - 待验证的数据
 * @param {string} [errorMessage] - 自定义错误消息
 * @returns {T} 验证通过后的数据
 */
export function validateOrThrow<T>(schema: ZodType<T>, data: unknown, errorMessage?: string): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  throw ApiError.validation(
    errorMessage || "Request validation failed.",
    formatZodErrorsAsObject(result.error)
  );
}

/** 请求验证选项。 */
export interface RequestValidationOptions {
  message?: string;
  strip?: boolean;
}

/**
 * 校验请求体 JSON
 *
 * 这里先通过 `req.clone()` 读取 body，避免上层已经消费过请求流时影响后续处理。
 *
 * @template T - 期望的数据类型
 * @param {Request} req - 原始请求对象
 * @param {ZodType<T>} schema - 请求体 Schema
 * @param {RequestValidationOptions} [options={}] - 校验选项
 * @returns {Promise<T>} 校验通过后的请求体
 */
export async function validateBody<T>(
  req: Request,
  schema: ZodType<T>,
  options: RequestValidationOptions = {}
): Promise<T> {
  let body: unknown;
  try {
    body = await req.clone().json();
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON.");
  }

  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }

  throw ApiError.validation(
    options.message || "Request body validation failed.",
    formatZodErrorsAsObject(result.error)
  );
}

/**
 * 校验查询参数
 *
 * 重复键会被收集成数组，兼容多值查询参数场景。
 *
 * @template T - 期望的数据类型
 * @param {Request} req - 原始请求对象
 * @param {ZodType<T>} schema - 查询参数 Schema
 * @param {RequestValidationOptions} [options={}] - 校验选项
 * @returns {Promise<T>} 校验通过后的查询参数
 */
export async function validateQuery<T>(
  req: Request,
  schema: ZodType<T>,
  options: RequestValidationOptions = {}
): Promise<T> {
  const url = new URL(req.url);
  const params: Record<string, unknown> = {};

  url.searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  });

  const result = schema.safeParse(params);
  if (result.success) {
    return result.data;
  }

  throw ApiError.validation(
    options.message || "Query validation failed.",
    formatZodErrorsAsObject(result.error)
  );
}

/**
 * 校验动态路由参数
 *
 * @template T - 期望的数据类型
 * @param {Record<string, string | string[] | undefined>} params - 路由参数
 * @param {ZodType<T>} schema - 参数 Schema
 * @param {RequestValidationOptions} [options={}] - 校验选项
 * @returns {T} 校验通过后的参数
 */
export function validateParams<T>(
  params: Record<string, string | string[] | undefined>,
  schema: ZodType<T>,
  options: RequestValidationOptions = {}
): T {
  const result = schema.safeParse(params);
  if (result.success) {
    return result.data;
  }

  throw ApiError.validation(
    options.message || "Route params validation failed.",
    formatZodErrorsAsObject(result.error)
  );
}

/**
 * 创建分页参数 Schema
 *
 * @param {number} [defaultPage=1] - 默认页码
 * @param {number} [defaultSize=10] - 默认每页数量
 * @returns {z.ZodObject<any>} 分页 Schema
 */
export function createPaginationSchema(defaultPage = 1, defaultSize = 10) {
  return z.object({
    page: z.coerce.number().int().min(1).default(defaultPage),
    size: z.coerce.number().int().min(1).max(100).default(defaultSize),
  });
}

/**
 * 创建数字 ID 参数 Schema
 *
 * @param {string} [fieldName="id"] - 参数名
 * @returns {z.ZodObject<any>} 数字 ID Schema
 */
export function createIdParamSchema(fieldName = "id") {
  return z.object({
    [fieldName]: z.coerce.number().int().positive(),
  });
}

/**
 * 创建字符串 ID 参数 Schema
 *
 * @param {string} [fieldName="id"] - 参数名
 * @returns {z.ZodObject<any>} 字符串 ID Schema
 */
export function createStringIdParamSchema(fieldName = "id") {
  return z.object({
    [fieldName]: z.string().min(1),
  });
}

/**
 * 创建带分页的搜索参数 Schema
 *
 * @returns {z.ZodObject<any>} 搜索 Schema
 */
export function createSearchSchema() {
  return z.object({
    q: z.string().optional().default(""),
    ...createPaginationSchema().shape,
  });
}

export { z, ZodError, type ZodType };
