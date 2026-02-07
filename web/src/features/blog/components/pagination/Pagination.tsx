"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

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
