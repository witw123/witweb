"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { marked } from "marked";
import createDOMPurify from "dompurify";
import { useAuth } from "@/app/providers";
import { put } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { getThumbnailUrl, shouldBypassImageOptimization } from "@/utils/url";

/* ── Types ── */
type AboutLink = { label: string; url: string };
type RecentPost = { title: string; slug: string; created_at: string };

type AboutPayload = {
  title: string;
  subtitle: string;
  content: string;
  links: AboutLink[];
  skills: string[];
  recentPosts?: RecentPost[];
  updated_at: string;
  updated_by: string;
};

type PublicProfileLite = {
  username: string;
  nickname?: string;
  avatar_url?: string;
};

const DEFAULT_CONTENT = `## 自言

- 你好，我是 witw，长期专注于工程实践、AI 应用落地和内容创作系统化。
- 我会持续分享项目复盘、架构思考、工具链方法与成长记录。

## 简述

- 关注高可用系统设计、数据建模与性能优化。
- 关注自动化工作流与端到端交付效率。

## 学习

- 坐得住，能学习，重视长期主义。
- 夯实基础，阅读源码，持续复盘。`;

/* ── Icon helpers ── */
function getLinkIcon(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("mailto:")) return "📧";
  if (lower.includes("github.com") || lower.includes("github")) return "🐙";
  if (lower.includes("twitter.com") || lower.includes("x.com")) return "🐦";
  if (lower.includes("bilibili")) return "📺";
  if (lower.includes("weibo")) return "🌐";
  if (lower.includes("zhihu")) return "💬";
  if (lower.includes("juejin")) return "📝";
  if (lower.includes("linkedin")) return "💼";
  if (lower.includes("discord")) return "🎮";
  if (lower.includes("telegram") || lower.includes("t.me")) return "✈️";
  if (lower.includes("youtube")) return "▶️";
  return "🔗";
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return dateStr;
  }
}

/* ── Fade-in on scroll hook ── */
function useFadeIn<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const cb = useCallback((node: T | null) => {
    ref.current = node;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add("about-fade-visible");
          observer.unobserve(node);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return cb;
}

/* ── Component ── */
export default function AboutPage() {
  const { user, isAuthenticated } = useAuth();
  const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [adminProfile, setAdminProfile] = useState<PublicProfileLite | null>(null);
  const [about, setAbout] = useState<AboutPayload>({
    title: "关于我",
    subtitle: "技术、产品与持续创作",
    content: DEFAULT_CONTENT,
    links: [],
    skills: [],
    recentPosts: [],
    updated_at: "",
    updated_by: "",
  });
  const [editLinks, setEditLinks] = useState<AboutLink[]>([]);
  const [editSkills, setEditSkills] = useState("");

  const fadeHero = useFadeIn<HTMLElement>();
  const fadeLinks = useFadeIn<HTMLUListElement>();
  const fadeContent = useFadeIn<HTMLElement>();
  const fadeSkills = useFadeIn<HTMLElement>();
  const fadeRecent = useFadeIn<HTMLElement>();

  const isSuperAdmin = isAuthenticated && (user?.role === "super_admin" || user?.username === adminUsername);
  const displayName = adminProfile?.nickname || adminProfile?.username || about.updated_by || adminUsername;
  const profileUsername = adminProfile?.username || adminUsername;
  const adminAvatarSrc = adminProfile?.avatar_url ? getThumbnailUrl(adminProfile.avatar_url, 128) : "";
  const adminAvatarUnoptimized = shouldBypassImageOptimization(adminAvatarSrc);

  const renderedHtml = useMemo(() => {
    const parsed = marked.parse(about.content || DEFAULT_CONTENT, { gfm: true, breaks: true });
    const raw = typeof parsed === "string" ? parsed : "";
    if (typeof window === "undefined") return raw;
    const purifier = createDOMPurify(window);
    return purifier.sanitize(raw, { USE_PROFILES: { html: true } });
  }, [about.content]);

  const updatedLabel = useMemo(() => {
    if (!about.updated_at) return "2026/3/1";
    return new Date(about.updated_at).toLocaleDateString("zh-CN");
  }, [about.updated_at]);

  useEffect(() => {
    fetch(getVersionedApiPath("/about"))
      .then((res) => res.json())
      .then((payload) => {
        if (!payload?.success || !payload?.data) {
          setStatus("关于我内容加载失败，请稍后重试。");
          return;
        }
        const data = payload.data as AboutPayload;
        setAbout({
          title: data.title || "关于我",
          subtitle: data.subtitle || "技术、产品与持续创作",
          content: data.content || DEFAULT_CONTENT,
          links: Array.isArray(data.links) ? data.links : [],
          skills: Array.isArray(data.skills) ? data.skills : [],
          recentPosts: Array.isArray(data.recentPosts) ? data.recentPosts : [],
          updated_at: data.updated_at || "",
          updated_by: data.updated_by || "",
        });
      })
      .catch(() => setStatus("关于我内容加载失败，请稍后重试。"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(getVersionedApiPath(`/users/${encodeURIComponent(adminUsername)}/profile`))
      .then((res) => res.json())
      .then((payload) => {
        if (!payload?.success || !payload?.data) return;
        const data = payload.data as PublicProfileLite;
        setAdminProfile({
          username: data.username || adminUsername,
          nickname: data.nickname || "",
          avatar_url: data.avatar_url || "",
        });
      })
      .catch(() => {
        // Ignore profile fetch errors and fall back to local defaults.
      });
  }, [adminUsername]);

  function enterEdit() {
    setEditLinks(about.links.length > 0 ? about.links.map((l) => ({ ...l })) : []);
    setEditSkills(about.skills.join("、"));
    setEditing(true);
  }

  function addLink() {
    setEditLinks((prev) => [...prev, { label: "", url: "" }]);
  }
  function removeLink(index: number) {
    setEditLinks((prev) => prev.filter((_, i) => i !== index));
  }
  function updateLink(index: number, field: "label" | "url", value: string) {
    setEditLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  async function handleSave() {
    if (!isAuthenticated) {
      setStatus("请先登录后再操作。");
      return;
    }
    if (!about.title.trim() || !about.content.trim()) {
      setStatus("标题和内容不能为空。");
      return;
    }

    const validLinks = editLinks.filter((l) => l.label.trim() && l.url.trim());
    const validSkills = editSkills
      .split(/[、,，;；\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    setStatus("");

    try {
      const data = await put<AboutPayload>(getVersionedApiPath("/about"), {
          title: about.title,
          subtitle: about.subtitle,
          content: about.content,
          links: validLinks,
          skills: validSkills,
      });
      setAbout((prev) => ({
        ...prev,
        title: data.title,
        subtitle: data.subtitle || "",
        content: data.content,
        links: Array.isArray(data.links) ? data.links : [],
        skills: Array.isArray(data.skills) ? data.skills : [],
        updated_at: data.updated_at,
        updated_by: data.updated_by || "",
      }));
      setEditing(false);
      setStatus("关于我已更新。");
    } catch {
      setStatus("保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="about-page">
        <div className="about-container">
          <div className="about-skeleton">
            <div className="about-skeleton__bar about-skeleton__bar--lg" />
            <div className="about-skeleton__bar about-skeleton__bar--md" />
            <div className="about-skeleton__bar about-skeleton__bar--sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="about-page">
      <div className="about-container">
        {/* ── Hero ── */}
        <header className="about-hero about-fade" ref={fadeHero}>
          <Link href={`/user/${profileUsername}`} className="about-hero__avatar">
            {adminProfile?.avatar_url ? (
              <Image
                src={adminAvatarSrc}
                alt={displayName}
                fill
                className="about-hero__avatar-img"
                unoptimized={adminAvatarUnoptimized}
              />
            ) : (
              <span className="about-hero__avatar-fallback">
                {displayName[0]?.toUpperCase()}
              </span>
            )}
          </Link>

          <h1 className="about-hero__title">{about.title}</h1>
          <p className="about-hero__subtitle">{about.subtitle || "技术、产品与持续创作"}</p>

          <div className="about-hero__meta">
            <time>更新于 {updatedLabel}</time>
            {isSuperAdmin && (
              <button
                type="button"
                className="about-hero__edit-btn"
                onClick={() => (editing ? setEditing(false) : enterEdit())}
              >
                {editing ? "退出编辑" : "编辑"}
              </button>
            )}
          </div>
        </header>

        {/* ── Social Links ── */}
        {!editing && about.links.length > 0 && (
          <ul className="about-links about-fade" ref={fadeLinks}>
            {about.links.map((link, i) => (
              <li key={`${link.url}-${i}`} className="about-links__item">
                <span className="about-links__icon">{getLinkIcon(link.url)}</span>
                <span className="about-links__label">{link.label}：</span>
                <a
                  href={link.url.startsWith("mailto:") || link.url.startsWith("http") ? link.url : `https://${link.url}`}
                  className="about-links__url"
                  target={link.url.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                >
                  {link.url.replace(/^https?:\/\//, "").replace(/^mailto:/, "")}
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* ── Divider ── */}
        <div className="about-divider" />

        {/* ── Editor or Content ── */}
        {editing ? (
          <section className="about-editor">
            <h2 className="about-editor__heading">编辑内容</h2>
            <p className="about-editor__hint">支持 Markdown，保存后前台立即更新。</p>

            <div className="about-editor__fields">
              <label className="about-editor__label">
                <span>标题</span>
                <input
                  className="about-editor__input"
                  value={about.title}
                  onChange={(e) => setAbout((prev) => ({ ...prev, title: e.target.value }))}
                />
              </label>
              <label className="about-editor__label">
                <span>副标题</span>
                <input
                  className="about-editor__input"
                  value={about.subtitle}
                  onChange={(e) => setAbout((prev) => ({ ...prev, subtitle: e.target.value }))}
                />
              </label>
              <label className="about-editor__label">
                <span>正文（Markdown）</span>
                <textarea
                  className="about-editor__textarea"
                  rows={14}
                  value={about.content}
                  onChange={(e) => setAbout((prev) => ({ ...prev, content: e.target.value }))}
                />
              </label>
            </div>

            {/* ── Skills Editor ── */}
            <div className="about-editor__links-section">
              <div className="about-editor__links-header">
                <h3>技能标签</h3>
              </div>
              <p className="about-editor__hint">用顿号、逗号或换行分隔，如：Next.js、React、TypeScript</p>
              <textarea
                className="about-editor__input"
                rows={2}
                value={editSkills}
                onChange={(e) => setEditSkills(e.target.value)}
                placeholder="Next.js、React、TypeScript、PostgreSQL"
                style={{ marginTop: 8 }}
              />
            </div>

            {/* ── Link Editor ── */}
            <div className="about-editor__links-section">
              <div className="about-editor__links-header">
                <h3>联系方式 / 社交链接</h3>
                <button type="button" className="about-editor__add-btn" onClick={addLink}>
                  + 添加
                </button>
              </div>
              {editLinks.length === 0 && (
                <p className="about-editor__hint">暂无链接，点击“+ 添加”新增一条。</p>
              )}
              <div className="about-editor__links-list">
                {editLinks.map((link, index) => (
                  <div key={index} className="about-editor__link-row">
                    <input
                      className="about-editor__input about-editor__input--sm"
                      placeholder="标签，如：我的邮箱"
                      value={link.label}
                      onChange={(e) => updateLink(index, "label", e.target.value)}
                    />
                    <input
                      className="about-editor__input about-editor__input--grow"
                      placeholder="链接，如：mailto:xx@xx.com"
                      value={link.url}
                      onChange={(e) => updateLink(index, "url", e.target.value)}
                    />
                    <button
                      type="button"
                      className="about-editor__remove-btn"
                      onClick={() => removeLink(index)}
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="about-editor__actions">
              <button className="btn-primary" type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setEditing(false)} disabled={saving}>
                取消
              </button>
            </div>
          </section>
        ) : (
          <>
            <article ref={fadeContent}
              className="about-content about-fade"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />

            {/* ── Skills ── */}
            {about.skills.length > 0 && (
              <section className="about-skills about-fade" ref={fadeSkills}>
                <h3 className="about-skills__title">技术栈</h3>
                <div className="about-skills__list">
                  {about.skills.map((skill, i) => (
                    <span key={`${skill}-${i}`} className="about-skills__pill">{skill}</span>
                  ))}
                </div>
              </section>
            )}

            {/* ── Recent Posts ── */}
            {about.recentPosts && about.recentPosts.length > 0 && (
              <section className="about-recent about-fade" ref={fadeRecent}>
                <h3 className="about-recent__title">最近文章</h3>
                <ul className="about-recent__list">
                  {about.recentPosts.map((post) => (
                    <li key={post.slug} className="about-recent__item">
                      <Link href={`/post/${post.slug}`} className="about-recent__link">
                        {post.title}
                      </Link>
                      <time className="about-recent__date">{formatDate(post.created_at)}</time>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* ── Status ── */}
        {status && <p className="about-status">{status}</p>}
      </div>
    </div>
  );
}
