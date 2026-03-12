/**
 * Pagination - 分页导航组件
 *
 * 简单的分页控件，支持上一页/下一页切换
 * 当总页数不超过 1 页时不渲染
 *
 * @component
 */
"use client";

/**
 * Pagination 组件属性
 */
interface PaginationProps {
  /** 当前页码 */
  currentPage: number;
  /** 总页数 */
  totalPages: number;
  /** 页码变化回调 */
  onPageChange: (page: number) => void;
}

/**
 * Pagination - 分页导航组件
 *
 * 渲染分页控件，包含上一页/下一页按钮和页码显示
 * 在首页禁用上一页按钮，在末页禁用下一页按钮
 *
 * @component
 * @example
 * <Pagination
 *   currentPage={3}
 *   totalPages={10}
 *   onPageChange={(page) => handlePageChange(page)}
 * />
 */
export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination blog-pagination mt-8 flex items-center justify-center gap-4">
      <button
        className="btn-ghost blog-pagination-btn"
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        上一页
      </button>
      <span className="blog-pagination-label text-sm">
        第 {currentPage} / {totalPages} 页
      </span>
      <button
        className="btn-ghost blog-pagination-btn"
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        下一页
      </button>
    </div>
  );
}
