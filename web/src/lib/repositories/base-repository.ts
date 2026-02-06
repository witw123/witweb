/**
 */

import type Database from "better-sqlite3";
import { ApiError, ErrorCode } from "@/lib/api-error";

/**
 */
export type DbKind = "users" | "blog" | "studio" | "messages";

/**
 */
export interface QueryOptions {
  db?: Database;
}

/**
 */
export interface PaginationParams {
  page: number;
  size: number;
}

/**
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/**
 */
export type SortDirection = "ASC" | "DESC";

/**
 */
export interface SortOptions {
  column: string;
  direction: SortDirection;
}

/**
 */
export abstract class BaseRepository<T, K = number> {
  /**
   */
  protected abstract getDb(options?: QueryOptions): Database;

  /**
   */
  protected abstract readonly tableName: string;

  /**
   */
  protected readonly primaryKey: string = "id";

  /**
   */
  protected query<R>(sql: string, params?: unknown[], options?: QueryOptions): R[] {
    try {
      const db = this.getDb(options);
      const stmt = db.prepare(sql);
      return params ? (stmt.all(...params) as R[]) : (stmt.all() as R[]);
    } catch (error) {
      throw this.handleError(error, "query");
    }
  }

  /**
   */
  protected queryOne<R>(sql: string, params?: unknown[], options?: QueryOptions): R | null {
    try {
      const db = this.getDb(options);
      const stmt = db.prepare(sql);
      const result = params ? stmt.get(...params) : stmt.get();
      return (result as R) || null;
    } catch (error) {
      throw this.handleError(error, "queryOne");
    }
  }

  /**
   */
  protected run(sql: string, params?: unknown[], options?: QueryOptions): { changes: number; lastInsertRowid: number | bigint } {
    try {
      const db = this.getDb(options);
      const stmt = db.prepare(sql);
      const result = params ? stmt.run(...params) : stmt.run();
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    } catch (error) {
      throw this.handleError(error, "run");
    }
  }

  /**
   */
  findById(id: K, options?: QueryOptions): T | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    return this.queryOne<T>(sql, [id], options);
  }

  /**
   */
  findAll(options?: QueryOptions): T[] {
    const sql = `SELECT * FROM ${this.tableName}`;
    return this.query<T>(sql, [], options);
  }

  /**
   */
  findMany(whereClause: string, params: unknown[], options?: QueryOptions): T[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause}`;
    return this.query<T>(sql, params, options);
  }

  /**
   */
  findOne(whereClause: string, params: unknown[], options?: QueryOptions): T | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
    return this.queryOne<T>(sql, params, options);
  }

  /**
   */
  count(whereClause?: string, params?: unknown[], options?: QueryOptions): number {
    const sql = whereClause
      ? `SELECT COUNT(*) AS cnt FROM ${this.tableName} WHERE ${whereClause}`
      : `SELECT COUNT(*) AS cnt FROM ${this.tableName}`;
    const result = this.queryOne<{ cnt: number }>(sql, params, options);
    return result?.cnt || 0;
  }

  /**
   */
  exists(whereClause: string, params: unknown[], options?: QueryOptions): boolean {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
    const result = this.queryOne<Record<string, unknown>>(sql, params, options);
    return !!result;
  }

  /**
   */
  delete(id: K, options?: QueryOptions): boolean {
    const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    const result = this.run(sql, [id], options);
    return result.changes > 0;
  }

  /**
   */
  deleteMany(whereClause: string, params: unknown[], options?: QueryOptions): number {
    const sql = `DELETE FROM ${this.tableName} WHERE ${whereClause}`;
    const result = this.run(sql, params, options);
    return result.changes;
  }

  /**
   */
  transaction<R>(callback: (db: Database) => R): R {
    const db = this.getDb();
    return db.transaction(() => callback(db))();
  }

  /**
   */
  paginate(
    page: number,
    size: number,
    whereClause?: string,
    params?: unknown[],
    sortOptions?: SortOptions,
    options?: QueryOptions
  ): PaginatedResult<T> {
    const validPage = Math.max(1, page);
    const validSize = Math.max(1, Math.min(50, size));
    const offset = (validPage - 1) * validSize;

    const total = this.count(whereClause, params, options);

    let sql = `SELECT * FROM ${this.tableName}`;
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    if (sortOptions) {
      sql += ` ORDER BY ${sortOptions.column} ${sortOptions.direction}`;
    }
    sql += ` LIMIT ? OFFSET ?`;

    const items = this.query<T>(sql, [...(params || []), validSize, offset], options);

    return {
      items,
      total,
      page: validPage,
      size: validSize,
    };
  }

  /**
   */
  protected handleError(error: unknown, operation: string): Error {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof Error) {
      if (error.message.includes("UNIQUE constraint failed")) {
        return new ApiError(ErrorCode.DUPLICATE_ENTRY, `数据已存在: ${error.message}`);
      }
      if (error.message.includes("FOREIGN KEY constraint failed")) {
        return new ApiError(ErrorCode.BAD_REQUEST, `关联数据不存在: ${error.message}`);
      }
      if (error.message.includes("NOT NULL constraint failed")) {
        return new ApiError(ErrorCode.VALIDATION_ERROR, `Missing required field: ${error.message}`);
      }

      return new ApiError(ErrorCode.DATABASE_ERROR, `Database operation failed (${operation}): ${error.message}`);
    }

    return new ApiError(ErrorCode.INTERNAL_ERROR, `未知错误 (${operation})`);
  }

  /**
   */
  protected buildInPlaceholders(count: number): string {
    return Array.from({ length: count }, () => "?").join(", ");
  }

  /**
   */
  protected normalizePagination(page = 1, size = 10): { page: number; size: number; offset: number } {
    const validPage = Math.max(1, page);
    const validSize = Math.max(1, Math.min(50, size));
    const offset = (validPage - 1) * validSize;
    return { page: validPage, size: validSize, offset };
  }
}
