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
  primaryAction = { label: "开始阅读", onClick: () => {} },
  secondaryAction = { label: "关于我", href: "/profile" },
}: HeroSectionProps) {
  return (
    <section
      className="hero-section relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-center overflow-hidden px-4 text-center"
      style={{
        background: "radial-gradient(ellipse at top, rgba(59, 130, 246, 0.15), transparent 60%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20 [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <div
        className="relative z-10 mb-6 inline-flex items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400 backdrop-blur-md"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        共享 · 共建 · 共赢
      </div>

      <h1
        className="relative z-10 mx-auto mb-6 max-w-5xl text-4xl font-extrabold leading-[1.2] tracking-tight md:text-5xl lg:text-5xl"
        style={{
          fontFamily: "var(--font-heading)",
          background: "linear-gradient(to bottom, #fff 40%, #a1a1a1 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {title}
      </h1>

      <p className="relative z-10 mx-auto mb-10 max-w-2xl text-base font-medium leading-relaxed text-zinc-400 md:text-lg">
        {subtitle}
      </p>

      <div className="relative z-10 flex gap-4">
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
