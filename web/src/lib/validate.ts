import { z, ZodError, type ZodType } from "zod";
import { ApiError } from "./api-error";

export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  errors: ValidationFieldError[];
}

export interface ValidationFieldError {
  field: string;
  message: string;
  value?: unknown;
}

export function formatZodErrors(error: ZodError): ValidationFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    value: undefined,
  }));
}

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

export interface RequestValidationOptions {
  message?: string;
  strip?: boolean;
}

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

export function createPaginationSchema(defaultPage = 1, defaultSize = 10) {
  return z.object({
    page: z.coerce.number().int().min(1).default(defaultPage),
    size: z.coerce.number().int().min(1).max(100).default(defaultSize),
  });
}

export function createIdParamSchema(fieldName = "id") {
  return z.object({
    [fieldName]: z.coerce.number().int().positive(),
  });
}

export function createStringIdParamSchema(fieldName = "id") {
  return z.object({
    [fieldName]: z.string().min(1),
  });
}

export function createSearchSchema() {
  return z.object({
    q: z.string().optional().default(""),
    ...createPaginationSchema().shape,
  });
}

export { z, ZodError, type ZodType };
