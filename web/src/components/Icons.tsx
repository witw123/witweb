/**
 * Icons 图标组件库
 *
 * 提供常用的 SVG 图标组件，支持自定义样式。
 * 包括心心、消息、点赞、点踩、书签等图标。
 *
 * @module Icons
 * @example
 * import { HeartIcon, MessageCircleIcon } from '@/components/Icons';
 *
 * <HeartIcon filled={true} className="text-red-500" />
 */

export type IconProps = {
  filled?: boolean;
  className?: string;
};

/**
 * HeartIcon 心心图标
 * @param filled - 是否填充颜色
 * @param className - 自定义 CSS 类名
 */
export const HeartIcon = ({ filled = false, className = "" }: IconProps) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

/**
 * MessageCircleIcon 消息/评论图标
 * @param className - 自定义 CSS 类名
 */
export const MessageCircleIcon = ({ className = "" }: IconProps) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
  </svg>
);

/**
 * ThumbsUpIcon 点赞图标
 * @param filled - 是否填充颜色
 * @param className - 自定义 CSS 类名
 */
export const ThumbsUpIcon = ({ filled = false, className = "" }: IconProps) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
  </svg>
);

/**
 * ThumbsDownIcon 点踩/反对图标
 * @param filled - 是否填充颜色
 * @param className - 自定义 CSS 类名
 */
export const ThumbsDownIcon = ({ filled = false, className = "" }: IconProps) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
  </svg>
);

/**
 * BookmarkIcon 书签/收藏图标
 * @param filled - 是否填充颜色
 * @param className - 自定义 CSS 类名
 */
export const BookmarkIcon = ({ filled = false, className = "" }: IconProps) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
  </svg>
);
