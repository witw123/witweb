/**
 * Grid 网格布局组件
 * 
 * 响应式网格布局组件，支持列数、间距、对齐等配置
 * 
 * @example
 * // 基础用法
 * <Grid>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </Grid>
 * 
 * // 指定列数
 * <Grid cols={3} />
 * <Grid cols={{ sm: 1, md: 2, lg: 3, xl: 4 }} />
 * 
 * // 间距
 * <Grid gap={4} />
 * <Grid gap={{ x: 4, y: 6 }} />
 * 
 * // 与 Col 配合使用
 * <Grid>
 *   <Col span={6}>占据6列</Col>
 *   <Col span={6}>占据6列</Col>
 * </Grid>
 * 
 * // 自动填充
 * <Grid autoFit minChildWidth="200px" />
 */

'use client';

import React, { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type GridCols = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type ResponsiveCols = {
  sm?: GridCols;
  md?: GridCols;
  lg?: GridCols;
  xl?: GridCols;
  '2xl'?: GridCols;
};

export type GapSize = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
export interface GapConfig {
  x?: GapSize;
  y?: GapSize;
}

export interface GridProps {
  /** 子元素 */
  children: ReactNode;
  /** 列数（数字或响应式配置） */
  cols?: GridCols | ResponsiveCols;
  /** 间距 */
  gap?: GapSize | GapConfig;
  /** 是否自动填充（使用 CSS Grid auto-fit） */
  autoFit?: boolean;
  /** 最小子元素宽度（autoFit 为 true 时有效） */
  minChildWidth?: string;
  /** 是否等高 */
  equalHeight?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 容器标签 */
  as?: React.ElementType;
}

export interface ColProps {
  /** 子元素 */
  children: ReactNode;
  /** 跨越的列数 */
  span?: GridCols;
  /** 响应式列数 */
  spanResponsive?: ResponsiveCols;
  /** 起始列 */
  start?: GridCols;
  /** 结束列 */
  end?: GridCols;
  /** 自定义类名 */
  className?: string;
}

/**
 * 生成响应式列数类名
 */
function generateColsClass(cols: GridCols | ResponsiveCols): string {
  if (typeof cols === 'number') {
    return `grid-cols-${cols}`;
  }
  
  const classes: string[] = [];
  if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`);
  if (cols.md) classes.push(`md:grid-cols-${cols.md}`);
  if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`);
  if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`);
  if (cols['2xl']) classes.push(`2xl:grid-cols-${cols['2xl']}`);
  
  return classes.join(' ');
}

/**
 * 生成间距类名
 */
function generateGapClass(gap: GapSize | GapConfig): string {
  if (typeof gap === 'number') {
    return `gap-${gap}`;
  }
  
  const classes: string[] = [];
  if (gap.x !== undefined) classes.push(`gap-x-${gap.x}`);
  if (gap.y !== undefined) classes.push(`gap-y-${gap.y}`);
  
  return classes.join(' ');
}

/**
 * 网格列组件
 */
const Col = forwardRef<HTMLDivElement, ColProps>(
  ({ children, span, spanResponsive, start, end, className }, ref) => {
    const spanClass = span ? `col-span-${span}` : '';
    
    const responsiveClasses = spanResponsive
      ? Object.entries(spanResponsive)
          .map(([breakpoint, cols]) => `${breakpoint}:col-span-${cols}`)
          .join(' ')
      : '';
    
    const startClass = start ? `col-start-${start}` : '';
    const endClass = end ? `col-end-${end}` : '';
    
    return (
      <div
        ref={ref}
        className={cn(spanClass, responsiveClasses, startClass, endClass, className)}
      >
        {children}
      </div>
    );
  }
);

Col.displayName = 'Col';

/**
 * 网格布局组件
 * 
 * @param props - GridProps
 * @returns ReactElement
 */
const Grid = forwardRef<HTMLDivElement, GridProps>(
  (
    {
      children,
      cols = 1,
      gap = 4,
      autoFit = false,
      minChildWidth,
      equalHeight = true,
      className,
      as: Component = "div",
    },
    ref
  ) => {
    const colsClass = autoFit
      ? 'grid-cols-1'
      : generateColsClass(cols);
    
    const gapClass = generateGapClass(gap);
    
    const autoFitStyle = autoFit && minChildWidth
      ? { gridTemplateColumns: `repeat(auto-fit, minmax(${minChildWidth}, 1fr))` }
      : undefined;
    
    return (
      <Component
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(
          'grid',
          colsClass,
          gapClass,
          equalHeight && 'items-stretch',
          className
        )}
        style={autoFitStyle}
      >
        {children}
      </Component>
    );
  }
);

Grid.displayName = 'Grid';

// 将 Col 附加到 Grid 上
(Grid as typeof Grid & { Col: typeof Col }).Col = Col;

export default Grid as typeof Grid & { Col: typeof Col };
export { Col };
