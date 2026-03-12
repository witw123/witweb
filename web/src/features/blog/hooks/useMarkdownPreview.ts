/**
 * Markdown 预览 Hook
 *
 * 把编辑中的 Markdown 转成可安全注入页面的 HTML 预览。
 * 渲染和清洗都收敛在这里，避免页面组件直接操作 `marked` 和 DOMPurify。
 */

import { useCallback, useMemo } from "react";
import { marked } from "marked";
import createDOMPurify from "dompurify";

/** Markdown 预览配置。 */
export interface UseMarkdownPreviewOptions {
  content: string;
}

export function useMarkdownPreview({ content }: UseMarkdownPreviewOptions) {
  const purifier = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createDOMPurify(window);
  }, []);

  const renderer = useMemo(() => {
    const r = new marked.Renderer();

    // 预览中的图片默认启用懒加载，尽量减少长文写作时的预览开销。
    r.image = (href: string | null, title: string | null, text: string) => {
      const src = href || "";
      const alt = text || "";
      const titleAttr = title ? ` title="${title}"` : "";
      return `<img src="${src}" alt="${alt}"${titleAttr} loading="lazy" class="rounded-lg max-w-full h-auto" />`;
    };

    // 标题自动生成锚点，方便预览态直接跳转和检查层级结构。
    r.heading = (text: string, level: number) => {
      const slug = text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
      return `<h${level} id="${slug}" class="heading-anchor"><a href="#${slug}" class="anchor-link">#</a>${text}</h${level}>`;
    };

    return r;
  }, []);

  const sanitizeHtml = useCallback(
    (html: string): string => {
      if (!purifier) return html;
      return purifier.sanitize(html, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["loading", "class", "id"],
      });
    },
    [purifier]
  );

  const html = useMemo(() => {
    if (!content.trim()) return "";

    try {
      const raw = marked.parse(content, {
        renderer,
        gfm: true,
        breaks: true,
      });
      return sanitizeHtml(raw);
    } catch (error) {
      console.error("Markdown parse error:", error);
      return "";
    }
  }, [content, renderer, sanitizeHtml]);

  return { html };
}

export default useMarkdownPreview;
