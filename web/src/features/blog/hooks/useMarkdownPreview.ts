import { useCallback, useMemo } from "react";
import { marked } from "marked";
import createDOMPurify from "dompurify";

export interface UseMarkdownPreviewOptions {
  content: string;
}

export function useMarkdownPreview({ content }: UseMarkdownPreviewOptions) {
  // Create DOMPurify instance (only in browser)
  const purifier = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createDOMPurify(window);
  }, []);

  // Configure marked options
  const renderer = useMemo(() => {
    const r = new marked.Renderer();

    // Custom image rendering for lazy loading
    r.image = (href: string | null, title: string | null, text: string) => {
      const src = href || "";
      const alt = text || "";
      const titleAttr = title ? ` title="${title}"` : "";
      return `<img src="${src}" alt="${alt}"${titleAttr} loading="lazy" class="rounded-lg max-w-full h-auto" />`;
    };

    // Custom heading rendering for anchor links
    r.heading = (text: string, level: number) => {
      const slug = text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
      return `<h${level} id="${slug}" class="heading-anchor"><a href="#${slug}" class="anchor-link">#</a>${text}</h${level}>`;
    };

    return r;
  }, []);

  // Sanitize HTML
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

  // Parse markdown to HTML
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
