/**
 * Container 容器组件
 * 
 * 响应式容器组件，支持不同尺寸和居中对齐
 * 
 * @example
 * // 基础用法
 * <Container>
 *   <div>内容</div>
 * </Container>
 * 
 * // 不同尺寸
 * <Container size="sm" />  // max-w-640px
 * <Container size="md" />  // max-w-768px
 * <Container size="lg" />  // max-w-1024px
 * <Container size="xl" />  // max-w-1280px
 * <Container size="2xl" /> // max-w-1536px
 * <Container size="full" /> // 100%
 * 
 * // 居中对齐
 * <Container center />
 * 
 * // 自定义内边距
 * <Container padding="none" />
 * <Container padding="sm" />
 */

'use client';

import React, { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
export type ContainerPadding = 'none' | 'sm' | 'md' | 'lg';

export interface ContainerProps {
  /** 子元素 */
  children: ReactNode;
  /** 容器尺寸 */
  size?: ContainerSize;
  /** 是否居中 */
  center?: boolean;
  /** 内边距大小 */
  padding?: ContainerPadding;
  /** 自定义类名 */
  className?: string;
  /** 是否作为流体容器（始终100%宽度但有最大宽度限制） */
  fluid?: boolean;
}

const sizeStyles: Record<ContainerSize, string> = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
};

const paddingStyles: Record<ContainerPadding, string> = {
  none: 'px-0',
  sm: 'px-4 sm:px-6',
  md: 'px-4 sm:px-6 lg:px-8',
  lg: 'px-4 sm:px-8 lg:px-12',
};

/**
 * 容器组件
 * 
 * @param props - ContainerProps
 * @returns ReactElement
 */
const Container = forwardRef<HTMLDivElement, ContainerProps>(
  (
    {
      children,
      size = 'xl',
      center = true,
      padding = 'md',
      className,
      fluid = false,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'w-full',
          !fluid && sizeStyles[size],
          paddingStyles[padding],
          center && 'mx-auto',
          className
        )}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';

export default Container;
