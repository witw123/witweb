"use client";

import { useCallback, useMemo, useState } from "react";
import { marked } from "marked";
import createDOMPurify from "dompurify";
import { useParams, useRouter } from "next/navigation";
import { put, post as postRequest } from "@/lib/api-client";
import { useAuth } from "@/app/providers";
import { resizeImageFile } from "@/utils/image";
import { getVersionedApiPath } from "@/lib/api-version";
import { logError } from "@/lib/logger";
import { uploadImageRequest } from "@/lib/upload-image-client";
import { emitPostMetricsUpdated } from "../utils/postMetricsSync";
import { hasMarkdownSyntax, renderPlainTextHtml } from "../utils/contentFormat";
import { usePostCache } from "../hooks";
import { BlogPostContent } from "./BlogPostContent";
import { BlogPostEditor } from "./BlogPostEditor";
import { CommentSection } from "./CommentSection";

type PostMetricsData = {
  like_count?: number;
  dislike_count?: number;
  favorite_count?: number;
  comment_count?: number;
  favorited?: boolean;
};

type TocItem = {
  id: string;
  text: string;
  level: number;
};

function slugify(text: string) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const router = useRouter();
  const { user: profile, isAuthenticated } = useAuth();
  const {
    post,
    setPost,
    comments,
    categories,
    status,
    commentListStatus,
    refreshPost,
    refreshComments,
  } = usePostCache({
    slug,
    isAuthenticated,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCoverImageUrl, setEditCoverImageUrl] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [imageWidth, setImageWidth] = useState("");
  const purifier = useMemo(
    () => (typeof window !== "undefined" ? createDOMPurify(window) : null),
    []
  );

  const canEdit =
    !!profile?.username && !!post?.author && profile.username === post.author;
  const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw";
  const isAdmin = Boolean(
    profile?.username &&
    (profile.role === "admin" || profile.username === adminUsername)
  );

  const sanitizeHtml = useCallback(
    (html: string) => {
      if (!purifier) return html;
      return purifier.sanitize(html, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["style", "id"],
      });
    },
    [purifier]
  );

  const tagList = useMemo(
    () =>
      (post?.tags || "")
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    [post?.tags]
  );

  const readingStats = useMemo(() => {
    const text = String(post?.content || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/[#>*_\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const length = text.length;
    const minutes = Math.max(1, Math.ceil(length / 400));
    return { length, minutes };
  }, [post?.content]);

  const { html: markdownHtml, toc: tocItems } = useMemo(() => {
    const source = String(post?.content || "");
    if (!hasMarkdownSyntax(source)) {
      return {
        html: sanitizeHtml(renderPlainTextHtml(source)),
        toc: [] as TocItem[],
      };
    }

    const items: TocItem[] = [];
    const slugCounts = new Map<string, number>();
    const renderer = new marked.Renderer();

    renderer.heading = (text: string, level: number, raw: string) => {
      const base = slugify(raw || text);
      const count = slugCounts.get(base) || 0;
      const nextCount = count + 1;
      slugCounts.set(base, nextCount);
      const id = count ? `${base}-${nextCount}` : base || `section-${items.length + 1}`;
      items.push({ id, text, level });
      return `<h${level} id="${id}">${text}</h${level}>`;
    };

    renderer.image = (href: string | null, title: string | null, text: string) => {
      const safeTitle = title ? ` title="${title}"` : "";
      const alt = text || "";
      return `<img src="${href}" alt="${alt}" loading="lazy" decoding="async"${safeTitle} style="max-width: 100%; height: auto;" />`;
    };

    const html = marked.parse(source, { renderer, gfm: true, breaks: true });
    return { html: sanitizeHtml(String(html)), toc: items };
  }, [post?.content, sanitizeHtml]);

  function applyMetricsUpdate(data: PostMetricsData) {
    if (!slug) return;
    const next = {
      like_count: data.like_count ?? post?.like_count ?? 0,
      dislike_count: data.dislike_count ?? post?.dislike_count ?? 0,
      favorite_count: data.favorite_count ?? post?.favorite_count ?? 0,
      comment_count: data.comment_count ?? post?.comment_count ?? 0,
      favorited_by_me: data.favorited ?? post?.favorited_by_me ?? false,
    };
    setPost((previous) => (previous ? { ...previous, ...next } : previous));
    emitPostMetricsUpdated({ slug, ...next });
  }

  async function requestMetricAction(
    action: "like" | "dislike" | "favorite",
    onUnauthed?: () => void
  ) {
    if (!isAuthenticated || !slug) {
      onUnauthed?.();
      return;
    }

    try {
      const data = await postRequest<PostMetricsData>(
        getVersionedApiPath(`/blog/${slug}/${action}`)
      );
      applyMetricsUpdate(data);
    } catch (error) {
      logError({
        source: `blog.post.${action}`,
        error,
        context: { slug },
      });
    }
  }

  async function handleLike() {
    await requestMetricAction("like", () => router.push("/login"));
  }

  async function handleDislike() {
    await requestMetricAction("dislike", () => setEditStatus("请先登录后再操作。"));
  }

  async function handleFavorite() {
    await requestMetricAction("favorite", () => router.push("/login"));
  }

  async function handleSaveEdit() {
    setEditStatus("");
    if (!editTitle.trim() || !editContent.trim()) {
      setEditStatus("标题和内容不能为空。");
      return;
    }
    if (!isAuthenticated || !slug) {
      setEditStatus("请先登录。");
      return;
    }

    try {
      await put(getVersionedApiPath(`/blog/${slug}`), {
        title: editTitle,
        content: editContent,
        tags: editTags,
        category_id: editCategoryId ? Number(editCategoryId) : null,
        cover_image_url: editCoverImageUrl || null,
      });
      setIsEditing(false);
      await refreshPost();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("blog-updated", { detail: { slug } }));
      }
    } catch (error) {
      setEditStatus(error instanceof Error ? error.message : "保存失败。");
    }
  }

  function insertImageMarkup(url: string, widthValue: string) {
    const markup = widthValue
      ? `<img src="${url}" style="max-width: 100%; width: ${widthValue};" />`
      : `![](${url})`;
    setEditContent((previous) => `${previous}\n\n${markup}\n`);
  }

  function replaceImageSrc(oldSrc: string, newSrc: string, widthValue: string) {
    const escaped = oldSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const htmlPattern = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*>`, "g");
    const markdownPattern = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, "g");
    const replacement = widthValue
      ? `<img src="${newSrc}" style="max-width: 100%; width: ${widthValue};" />`
      : `![](${newSrc})`;
    setEditContent((previous) =>
      previous.replace(htmlPattern, replacement).replace(markdownPattern, replacement)
    );
  }

  async function uploadImage(file: File) {
    if (!isAuthenticated) {
      setEditStatus("请先登录。");
      return null;
    }

    const resized = await resizeImageFile(file, 1600);
    const formData = new FormData();
    formData.append("file", resized);

    try {
      return await uploadImageRequest({
        formData,
        source: "blog.post.upload-image",
        context: {
          slug,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        },
      });
    } catch (error) {
      setEditStatus(error instanceof Error ? error.message : "上传失败。");
      return null;
    }
  }

  async function handleImageSelect(file: File | undefined, replaceSrc: string | null = null) {
    if (!file) return;
    const widthValue = imageWidth.trim();
    setEditStatus("图片上传中...");
    const uploaded = await uploadImage(file);
    if (!uploaded) return;

    if (replaceSrc) {
      replaceImageSrc(replaceSrc, uploaded, widthValue);
    } else {
      insertImageMarkup(uploaded, widthValue);
    }

    setEditStatus("图片已插入。");
  }

  function handleStartEditing() {
    if (!post) return;
    setEditTitle(post.title || "");
    setEditContent(post.content || "");
    setEditTags(post.tags || "");
    setEditCategoryId(post.category_id ? String(post.category_id) : "");
    setEditCoverImageUrl(post.cover_image_url || "");
    setEditStatus("");
    setIsEditing(true);
  }

  function handleCancelEditing() {
    setIsEditing(false);
    setEditStatus("");
  }

  return (
    <div className="blog-post-page">
      <BlogPostContent
        post={post}
        status={status}
        canEdit={canEdit}
        isEditing={isEditing}
        tagList={tagList}
        readingStats={readingStats}
        tocItems={tocItems}
        markdownHtml={markdownHtml}
        commentsCount={comments.length}
        onToggleEdit={() => {
          if (isEditing) {
            handleCancelEditing();
            return;
          }
          handleStartEditing();
        }}
        onLike={() => void handleLike()}
        onDislike={() => void handleDislike()}
        onFavorite={() => void handleFavorite()}
      />

      {isEditing && (
        <BlogPostEditor
          categories={categories}
          editTitle={editTitle}
          editCategoryId={editCategoryId}
          editTags={editTags}
          editContent={editContent}
          editCoverImageUrl={editCoverImageUrl}
          editStatus={editStatus}
          imageWidth={imageWidth}
          onTitleChange={setEditTitle}
          onCategoryChange={setEditCategoryId}
          onTagsChange={setEditTags}
          onContentChange={setEditContent}
          onCoverImageChange={setEditCoverImageUrl}
          onImageWidthChange={setImageWidth}
          onImageSelect={(file) => void handleImageSelect(file)}
          onSave={() => void handleSaveEdit()}
          onCancel={handleCancelEditing}
        />
      )}

      {slug && (
        <CommentSection
          slug={slug}
          comments={comments}
          commentListStatus={commentListStatus}
          isAdmin={isAdmin}
          refreshPost={refreshPost}
          refreshComments={refreshComments}
        />
      )}
    </div>
  );
}
