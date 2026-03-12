"use client";

/**
 * TurnstileWidget Cloudflare Turnstile 验证组件
 *
 * 集成 Cloudflare Turnstile 人机验证服务，
 * 用于防止机器人和自动化攻击。
 *
 * @component
 * @example
 * <TurnstileWidget
 *   siteKey="your_site_key"
 *   onTokenChange={(token) => console.log(token)}
 * />
 */

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

/**
 * TurnstileWidget 组件属性
 */
type TurnstileWidgetProps = {
  siteKey: string;
  onTokenChange: (token: string) => void;
};

const SCRIPT_ID = "cf-turnstile-script";

/**
 * TurnstileWidget 组件 - Cloudflare Turnstile 验证
 */
export default function TurnstileWidget({ siteKey, onTokenChange }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onTokenChange(token),
        "expired-callback": () => onTokenChange(""),
        "error-callback": () => onTokenChange(""),
      });
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.turnstile) renderWidget();
      else existing.addEventListener("load", renderWidget, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderWidget, { once: true });
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", renderWidget);
    };
  }, [siteKey, onTokenChange]);

  return <div ref={containerRef} />;
}
