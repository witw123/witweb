export interface PaginationParams {
  page: number;
  size: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export type SortDirection = "ASC" | "DESC";

export interface SortOptions {
  column: string;
  direction: SortDirection;
}
