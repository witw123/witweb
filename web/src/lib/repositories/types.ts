/**
 * 分页与排序通用类型定义
 *
 * 提供仓储层通用的分页和排序参数类型，用于 API 接口的数据查询
 */

/** 分页查询参数 */
export interface PaginationParams {
  page: number;
  size: number;
}

/** 分页查询结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/** 排序方向类型 */
export type SortDirection = "ASC" | "DESC";

/** 排序选项 */
export interface SortOptions {
  column: string;
  direction: SortDirection;
}
