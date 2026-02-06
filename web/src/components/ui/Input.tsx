/**
 * Input 输入框组件
 * 
 * 支持标签、错误提示、辅助文本、前缀/后缀图标的基础输入框组件
 * 
 * @example
 * // 基础用法
 * <Input placeholder="请输入" />
 * 
 * // 带标签
 * <Input label="用户名" placeholder="请输入用户名" />
 * 
 * // 带错误提示
 * <Input label="邮箱" error="邮箱格式不正确" />
 * 
 * // 带辅助文本
 * <Input label="密码" helperText="至少8位字符" />
 * 
 * // 带图标
 * <Input leftIcon={<SearchIcon />} placeholder="搜索..." />
 * <Input rightIcon={<EyeIcon />} type="password" />
 */

'use client';

import React, { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 标签文本 */
  label?: string;
  /** 错误提示文本 */
  error?: string;
  /** 辅助提示文本 */
  helperText?: string;
  /** 左侧图标 */
  leftIcon?: ReactNode;
  /** 右侧图标 */
  rightIcon?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 输入框容器类名 */
  wrapperClassName?: string;
  /** 标签类名 */
  labelClassName?: string;
}

/**
 * 输入框组件
 * 
 * @param props - InputProps
 * @returns ReactElement
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className,
      wrapperClassName,
      labelClassName,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    const baseInputStyles = 'block w-full rounded-lg border bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500';
    
    const stateStyles = error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-900'
      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200 dark:border-gray-600 dark:focus:border-blue-500 dark:focus:ring-blue-900';
    
    const iconPaddingStyles = {
      left: leftIcon ? 'pl-10' : '',
      right: rightIcon ? 'pr-10' : '',
    };

    return (
      <div className={cn('w-full', wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5',
              labelClassName
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              baseInputStyles,
              stateStyles,
              iconPaddingStyles.left,
              iconPaddingStyles.right,
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            id={`${inputId}-helper`}
            className="mt-1.5 text-sm text-gray-500 dark:text-gray-400"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
