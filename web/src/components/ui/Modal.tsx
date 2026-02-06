/**
 * Modal 模态框组件
 * 
 * 支持关闭按钮、点击外部关闭、动画效果的模态框组件
 * 
 * @example
 * // 基础用法
 * <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
 *   <Modal.Header>标题</Modal.Header>
 *   <Modal.Body>内容</Modal.Body>
 *   <Modal.Footer>底部</Modal.Footer>
 * </Modal>
 * 
 * // 不同尺寸
 * <Modal size="sm" ... />
 * <Modal size="md" ... />
 * <Modal size="lg" ... />
 * <Modal size="xl" ... />
 * <Modal size="full" ... />
 * 
 * // 不可关闭
 * <Modal closeOnOverlayClick={false} showCloseButton={false} ... />
 */

'use client';

import React, { useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 模态框尺寸 */
  size?: ModalSize;
  /** 是否显示关闭按钮 */
  showCloseButton?: boolean;
  /** 是否允许点击遮罩层关闭 */
  closeOnOverlayClick?: boolean;
  /** 是否允许按 ESC 键关闭 */
  closeOnEsc?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 遮罩层类名 */
  overlayClassName?: string;
  /** 内容类名 */
  contentClassName?: string;
  /** 子元素 */
  children: ReactNode;
}

export interface ModalHeaderProps {
  /** 标题 */
  children: ReactNode;
  /** 自定义类名 */
  className?: string;
}

export interface ModalBodyProps {
  /** 内容 */
  children: ReactNode;
  /** 自定义类名 */
  className?: string;
}

export interface ModalFooterProps {
  /** 底部内容 */
  children: ReactNode;
  /** 自定义类名 */
  className?: string;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
};

/**
 * 模态框头部组件
 */
function ModalHeader({ children, className }: ModalHeaderProps) {
  return (
    <div className={cn('px-6 py-4 border-b border-gray-200 dark:border-gray-700', className)}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{children}</h3>
    </div>
  );
}

/**
 * 模态框内容组件
 */
function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  );
}

/**
 * 模态框底部组件
 */
function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn('px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3', className)}>
      {children}
    </div>
  );
}

/**
 * 模态框组件
 * 
 * @param props - ModalProps
 * @returns ReactElement | null
 */
function Modal({
  isOpen,
  onClose,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  className,
  overlayClassName,
  contentClassName,
  children,
}: ModalProps) {
  // ESC 键关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEsc) {
      onClose();
    }
  }, [closeOnEsc, onClose]);
  
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);
  
  // 防止内容点击冒泡
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  
  if (!isOpen) return null;
  
  const modalContent = (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'animate-in fade-in duration-200',
        overlayClassName
      )}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* 内容区 */}
      <div
        className={cn(
          'relative w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl',
          'transform transition-all animate-in zoom-in-95 duration-200',
          sizeStyles[size],
          className
        )}
        onClick={handleContentClick}
      >
        {/* 关闭按钮 */}
        {showCloseButton && (
          <button
            type="button"
            className="absolute right-4 top-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
            onClick={onClose}
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        <div className={contentClassName}>
          {children}
        </div>
      </div>
    </div>
  );
  
  // 使用 Portal 渲染到 body
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  
  return null;
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
