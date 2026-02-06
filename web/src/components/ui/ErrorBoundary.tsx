/**
 * ErrorBoundary 错误边界组件
 * 
 * 捕获子组件渲染错误，显示友好的错误提示界面
 * 
 * @example
 * // 基础用法
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * 
 * // 自定义错误界面
 * <ErrorBoundary
 *   fallback={({ error, resetError }) => (
 *     <div>
 *       <p>出错了: {error.message}</p>
 *       <button onClick={resetError}>重试</button>
 *     </div>
 *   )}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * 
 * // 错误上报
 * <ErrorBoundary onError={(error, errorInfo) => {
 *   console.error('错误边界捕获:', error, errorInfo);
 * }}>
 *   <MyComponent />
 * </ErrorBoundary>
 */

'use client';

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ErrorBoundaryProps {
  /** 子组件 */
  children: ReactNode;
  /** 自定义错误渲染函数 */
  fallback?: (props: { error: Error; resetError: () => void }) => ReactNode;
  /** 错误发生时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 自定义类名 */
  className?: string;
}

export interface ErrorBoundaryState {
  /** 是否发生错误 */
  hasError: boolean;
  /** 错误对象 */
  error: Error | null;
}

/**
 * 默认错误界面
 */
function DefaultFallback({
  error,
  resetError,
  className,
}: {
  error: Error;
  resetError: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[300px] p-8',
        'bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800',
        className
      )}
    >
      <div className="w-16 h-16 mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-red-600 dark:text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      
      <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
        页面出现错误
      </h3>
      
      <p className="text-sm text-red-600 dark:text-red-300 text-center mb-4 max-w-md">
        抱歉，页面渲染过程中发生了错误。您可以尝试刷新页面或返回上一页。
      </p>
      
      {process.env.NODE_ENV === 'development' && error && (
        <div className="w-full max-w-md mb-4 p-4 bg-red-100 dark:bg-red-900/30 rounded-lg overflow-auto">
          <p className="text-xs font-mono text-red-800 dark:text-red-200">
            <strong>Error:</strong> {error.message}
          </p>
          {error.stack && (
            <pre className="mt-2 text-xs text-red-700 dark:text-red-300 overflow-auto whitespace-pre-wrap">
              {error.stack}
            </pre>
          )}
        </div>
      )}
      
      <div className="flex gap-3">
        <button
          onClick={resetError}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          重试
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors"
        >
          刷新页面
        </button>
      </div>
    </div>
  );
}

/**
 * 错误边界组件
 * 
 * 用于捕获 React 组件渲染过程中的错误
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    
    // 开发环境下输出到控制台
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.resetError,
        });
      }

      return (
        <DefaultFallback
          error={this.state.error}
          resetError={this.resetError}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * 高阶组件：为组件添加错误边界
 * 
 * @param Component - 要包装的组件
 * @param errorBoundaryProps - 错误边界属性
 * @returns 带有错误边界的组件
 * 
 * @example
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   onError: (error) => console.error(error),
 * });
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
