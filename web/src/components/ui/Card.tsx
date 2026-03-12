'use client';

/**
 * Card 卡片组件
 *
 * 提供通用内容容器以及组合式 Header / Body / Footer 子组件。
 * 适合后台面板、信息块和可点击列表项等场景。
 */

import React, { forwardRef, type MouseEventHandler, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type CardVariant = 'default' | 'outlined' | 'ghost';

export interface CardProps {
  variant?: CardVariant;
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  hoverable?: boolean;
  shadow?: boolean;
  noPadding?: boolean;
}

export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
  outlined: 'bg-transparent border-2 border-gray-200 dark:border-gray-700',
  ghost: 'bg-gray-50 dark:bg-gray-900/50 border-none',
};

/** 卡片头部，支持右侧操作区。 */
function CardHeader({ children, className, action }: CardHeaderProps) {
  return (
    <div className={cn('px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between', className)}>
      <div className="flex-1">{children}</div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  );
}

/** 卡片主体内容区。 */
function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>;
}

/** 卡片底部操作区。 */
function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn('px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl', className)}>
      {children}
    </div>
  );
}

type CardComponent = React.ForwardRefExoticComponent<
  CardProps & React.RefAttributes<HTMLDivElement>
> & {
  Header: typeof CardHeader;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      children,
      className,
      onClick,
      hoverable = false,
      shadow = true,
      noPadding = false,
    },
    ref
  ) => {
    const isClickable = !!onClick;

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl overflow-hidden transition-all duration-200',
          variantStyles[variant],
          shadow && 'shadow-sm',
          hoverable && 'hover:shadow-md hover:-translate-y-0.5',
          isClickable && 'cursor-pointer',
          noPadding && '[&>*]:px-0',
          className
        )}
        onClick={onClick}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
      >
        {children}
      </div>
    );
  }
) as CardComponent;

Card.displayName = 'Card';
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
