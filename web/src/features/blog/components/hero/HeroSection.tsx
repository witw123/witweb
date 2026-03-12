/**
 * HeroSection - 英雄区域组件
 *
 * 页面顶部的醒目展示区域，通常用于首页，包含：
 * - 标题
 * - 副标题
 * - 主要操作按钮
 * - 次要操作按钮（链接）
 *
 * @component
 * @param {object} props - 组件属性
 * @param {string} [props.title] - 主标题
 * @param {string} [props.subtitle] - 副标题
 * @param {{ label: string; onClick: () => void }} [props.primaryAction] - 主要操作
 * @param {{ label: string; href: string }} [props.secondaryAction] - 次要操作（链接）
 * @example
 * <HeroSection
 *   title="欢迎来到我的博客"
 *   subtitle="分享技术见解和项目经验"
 *   primaryAction={{ label: "开始阅读", onClick: scrollToPosts }}
 *   secondaryAction={{ label: "关于我", href: "/about" }}
 * />
 */
"use client";

import Link from "next/link";

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
}

export function HeroSection({
  title = "witw 的技术与创作交流平台",
  subtitle = "记录项目实践、工具构建与个人经验。",
  primaryAction = { label: "开始阅读", onClick: () => { } },
  secondaryAction = { label: "关于我", href: "/profile" },
}: HeroSectionProps) {
  return (
    <section className="hero-section relative flex flex-col items-center justify-center overflow-hidden px-4 text-center" style={{ minHeight: 'calc(100vh - var(--header-height))' }}>
      <div className="hero-grid" />

      <div className="hero-kicker relative z-10 mb-6 inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
        共享 · 共建 · 共赢
      </div>

      <h1 className="hero-title relative z-10 mx-auto mb-6 max-w-5xl text-4xl font-extrabold leading-[1.2] tracking-tight md:text-5xl lg:text-5xl">
        {title}
      </h1>

      <p className="hero-subtitle relative z-10 mx-auto mb-10 max-w-2xl text-base font-medium leading-relaxed md:text-lg">
        {subtitle}
      </p>

      <div className="hero-actions relative z-10 flex gap-4">
        <button className="btn-hero btn-hero-primary" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </button>
        <Link href={secondaryAction.href} className="btn-hero btn-hero-secondary">
          {secondaryAction.label}
        </Link>
      </div>
    </section>
  );
}
