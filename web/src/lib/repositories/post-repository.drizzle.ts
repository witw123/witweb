import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { getDb } from "@/lib/db/drizzle";
import { categories, dislikes, favorites, likes, posts } from "@/lib/db/schema";
import type { PostDetail, PostListItem } from "@/types";
import { normalizePagination } from "./post-repository.shared";
import type { LikesToUserItem, ListPostsParams, PostActivityItem, SitemapPostItem } from "./post-repository.types";
import type { PaginatedResult } from "./types";

/**
 * 安全转换为数字
 *
 * 处理数据库返回的可能为 null 或 undefined 的数值
 *
 * @param {unknown} value - 可能为数字或空的值
 * @returns {number} 数字值，默认为 0
 */
function asNumber(value: unknown): number {
  return Number(value || 0);
}

/**
 * 文章数据库查询结果基础类型
 */
type PostRowBase = {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  author: string;
  tags: string | null;
  status: string;
  category_id: number | null;
  view_count: number;
  category_name: string | null;
  category_slug: string | null;
  like_count: number;
  dislike_count: number;
  comment_count: number;
  favorite_count: number;
};

/**
 * 将数据库行映射为文章详情对象
 *
 * @param {PostRowBase & {liked_by_me: boolean; favorited_by_me: boolean}} row - 数据库行
 * @returns {PostDetail} 文章详情对象
 */
function mapDetailRow(
  row: PostRowBase & { liked_by_me: boolean; favorited_by_me: boolean },
): PostDetail {
  return {
    ...row,
    status: row.status as PostDetail["status"],
    like_count: asNumber(row.like_count),
    dislike_count: asNumber(row.dislike_count),
    comment_count: asNumber(row.comment_count),
    favorite_count: asNumber(row.favorite_count),
    liked_by_me: Boolean(row.liked_by_me),
    favorited_by_me: Boolean(row.favorited_by_me),
    view_count: asNumber(row.view_count),
    author_name: row.author,
    author_avatar: "",
  };
}

/**
 * 将数据库行映射为文章列表项
 *
 * @param {Omit<PostRowBase, "updated_at"|"id"|"status"> & {favorited_by_me: boolean}} row - 数据库行
 * @returns {PostListItem} 文章列表项对象
 */
function mapListRow(
  row: Omit<PostRowBase, "updated_at" | "id" | "status"> & { favorited_by_me: boolean },
): PostListItem {
  return {
    ...row,
    like_count: asNumber(row.like_count),
    dislike_count: asNumber(row.dislike_count),
    comment_count: asNumber(row.comment_count),
    favorite_count: asNumber(row.favorite_count),
    favorited_by_me: Boolean(row.favorited_by_me),
    view_count: asNumber(row.view_count),
    author_name: row.author,
    author_avatar: "",
  };
}

/**
 * 文章数据仓库（Drizzle 实现）
 *
 * 负责文章（posts）的数据库操作，包括增删改查、点赞、收藏等
 */
export class DrizzlePostRepository {
  async listRecentPublished(limit = 5): Promise<Array<{
    title: string;
    slug: string;
    created_at: string;
    published_at: string;
  }>> {
    const db = getDb();
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 5, 1), 20);

    const rows = await db
      .select({
        title: posts.title,
        slug: posts.slug,
        created_at: posts.createdAt,
        published_at: posts.updatedAt,
      })
      .from(posts)
      .where(eq(posts.status, "published"))
      .orderBy(desc(posts.updatedAt), desc(posts.createdAt), desc(posts.id))
      .limit(safeLimit);

    return rows.map((row) => ({
      title: row.title,
      slug: row.slug,
      created_at: row.created_at,
      published_at: row.published_at || row.created_at,
    }));
  }

  /**
   * 创建文章
   *
   * @param {object} data - 文章数据
   * @returns {Promise<number>} 新创建的文章 ID
   */
  async create(data: {
    title: string;
    slug: string;
    content: string;
    excerpt?: string | null;
    cover_image_url?: string | null;
    author: string;
    tags?: string | null;
    status?: string;
    category_id?: number | null;
  }): Promise<number> {
    const db = getDb();
    const rows = await db
      .insert(posts)
      .values({
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.excerpt ?? null,
        coverImageUrl: data.cover_image_url ?? null,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
        author: data.author,
        tags: data.tags || "",
        status: data.status || "published",
        categoryId: data.category_id ?? null,
        viewCount: 0,
      })
      .returning({ id: posts.id });

    return asNumber(rows[0]?.id);
  }

  /**
   * 根据 slug 更新文章
   *
   * @param {string} slug - 文章 slug
   * @param {object} data - 更新数据
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateBySlug(
    slug: string,
    data: {
      title?: string;
      content?: string;
      excerpt?: string | null;
      cover_image_url?: string | null;
      tags?: string;
      status?: string;
      category_id?: number | null;
    },
  ): Promise<boolean> {
    const db = getDb();
    const updateData: {
      title?: string;
      content?: string;
      excerpt?: string | null;
      coverImageUrl?: string | null;
      tags?: string;
      status?: string;
      categoryId?: number | null;
      updatedAt: ReturnType<typeof sql>;
    } = { updatedAt: sql`now()` };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.cover_image_url !== undefined) updateData.coverImageUrl = data.cover_image_url;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.category_id !== undefined) updateData.categoryId = data.category_id;

    const rows = await db
      .update(posts)
      .set(updateData)
      .where(eq(posts.slug, slug))
      .returning({ id: posts.id });

    return rows.length > 0;
  }

  /**
   * 增加文章浏览量
   *
   * @param {string} slug - 文章 slug
   * @returns {Promise<number>} 更新后的浏览量
   */
  async incrementViewCount(slug: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .update(posts)
      .set({ viewCount: sql`coalesce(${posts.viewCount}, 0) + 1` })
      .where(eq(posts.slug, slug))
      .returning({ view_count: posts.viewCount });

    return asNumber(rows[0]?.view_count);
  }

  /**
   * 切换点赞/踩状态
   *
   * @param {string} slug - 文章 slug
   * @param {string} username - 用户名
   * @param {1|-1} value - 1 表示点赞，-1 表示踩
   * @returns {{lik disliked?: boolean}} 新的点赞ed?: boolean;/踩状态
   */
  async toggleLike(slug: string, username: string, value: 1 | -1): Promise<{ liked?: boolean; disliked?: boolean }> {
    const db = getDb();

    return db.transaction(async (tx) => {
      const postRows = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.slug, slug))
        .limit(1);
      const post = postRows[0];

      if (!post) {
        throw new ApiError(ErrorCode.POST_NOT_FOUND, "文章不存在");
      }

      if (value === 1) {
        const existing = await tx
          .select({ id: likes.id })
          .from(likes)
          .where(and(eq(likes.postId, post.id), eq(likes.username, username)))
          .limit(1);

        if (existing[0]) {
          await tx.delete(likes).where(eq(likes.id, existing[0].id));
          return { liked: false };
        }

        await tx
          .insert(likes)
          .values({
            postId: post.id,
            username,
            createdAt: sql`now()`,
          })
          .onConflictDoNothing();

        return { liked: true };
      }

      const existing = await tx
        .select({ id: dislikes.id })
        .from(dislikes)
        .where(and(eq(dislikes.postId, post.id), eq(dislikes.username, username)))
        .limit(1);

      if (existing[0]) {
        await tx.delete(dislikes).where(eq(dislikes.id, existing[0].id));
        return { disliked: false };
      }

      await tx
        .insert(dislikes)
        .values({
          postId: post.id,
          username,
          createdAt: sql`now()`,
        })
        .onConflictDoNothing();

      return { disliked: true };
    });
  }

  async toggleFavorite(slug: string, username: string): Promise<boolean> {
    const db = getDb();

    return db.transaction(async (tx) => {
      const postRows = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.slug, slug))
        .limit(1);
      const post = postRows[0];

      if (!post) {
        throw new ApiError(ErrorCode.POST_NOT_FOUND, "文章不存在");
      }

      const existing = await tx
        .select({ id: favorites.id })
        .from(favorites)
        .where(and(eq(favorites.postId, post.id), eq(favorites.username, username)))
        .limit(1);

      if (existing[0]) {
        await tx.delete(favorites).where(eq(favorites.id, existing[0].id));
        return false;
      }

      await tx
        .insert(favorites)
        .values({
          postId: post.id,
          username,
          createdAt: sql`now()`,
        })
        .onConflictDoNothing();

      return true;
    });
  }

  async findBySlug(slug: string) {
    const db = getDb();
    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        content: posts.content,
        excerpt: posts.excerpt,
        cover_image_url: posts.coverImageUrl,
        created_at: posts.createdAt,
        updated_at: posts.updatedAt,
        author: posts.author,
        tags: posts.tags,
        status: posts.status,
        category_id: posts.categoryId,
        view_count: posts.viewCount,
      })
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1);

    if (!rows[0]) return null;
    return {
      ...rows[0],
      status: rows[0].status as "published" | "draft" | "deleted",
      view_count: asNumber(rows[0].view_count),
    };
  }

  async getPostDetail(slug: string, username?: string): Promise<PostDetail | null> {
    const db = getDb();
    const viewer = username || "";

    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        content: posts.content,
        excerpt: posts.excerpt,
        cover_image_url: posts.coverImageUrl,
        created_at: posts.createdAt,
        updated_at: posts.updatedAt,
        author: posts.author,
        tags: posts.tags,
        status: posts.status,
        category_id: posts.categoryId,
        view_count: posts.viewCount,
        category_name: categories.name,
        category_slug: categories.slug,
        like_count: sql<number>`(
          SELECT COUNT(*)::int FROM likes l WHERE l.post_id = ${posts.id}
        )`,
        dislike_count: sql<number>`(
          SELECT COUNT(*)::int FROM dislikes d WHERE d.post_id = ${posts.id}
        )`,
        comment_count: sql<number>`(
          SELECT COUNT(*)::int FROM comments cmt WHERE cmt.post_id = ${posts.id}
        )`,
        favorite_count: sql<number>`(
          SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = ${posts.id}
        )`,
        liked_by_me: viewer
          ? sql<boolean>`EXISTS(SELECT 1 FROM likes l2 WHERE l2.post_id = ${posts.id} AND l2.username = ${viewer})`
          : sql<boolean>`false`,
        favorited_by_me: viewer
          ? sql<boolean>`EXISTS(SELECT 1 FROM favorites f2 WHERE f2.post_id = ${posts.id} AND f2.username = ${viewer})`
          : sql<boolean>`false`,
      })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.categoryId))
      .where(eq(posts.slug, slug))
      .limit(1);

    if (!rows[0]) return null;
    return mapDetailRow(rows[0]);
  }

  async list(params: ListPostsParams): Promise<PaginatedResult<PostListItem>> {
    const db = getDb();
    const { page = 1, size = 10, query, author, authorAliases, tag, category, username } = params;
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);
    const filters = [sql`${posts.status} != 'deleted'`];

    if (query?.trim()) {
      filters.push(ilike(posts.title, `%${query.trim()}%`));
    }

    const aliases = Array.from(new Set((authorAliases || []).map((item) => item.trim()).filter(Boolean)));
    if (aliases.length > 0) {
      filters.push(inArray(posts.author, aliases));
    } else if (author?.trim()) {
      filters.push(eq(posts.author, author.trim()));
    }

    if (tag?.trim()) {
      filters.push(ilike(posts.tags, `%${tag.trim()}%`));
    }

    if (category?.trim()) {
      filters.push(eq(categories.slug, category.trim()));
    }

    const whereClause = filters.length === 1 ? filters[0] : and(...filters);
    const viewer = username || "";

    const [totalRow] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.categoryId))
      .where(whereClause);

    const rows = await db
      .select({
        title: posts.title,
        slug: posts.slug,
        content: posts.content,
        excerpt: posts.excerpt,
        cover_image_url: posts.coverImageUrl,
        created_at: posts.createdAt,
        author: posts.author,
        tags: posts.tags,
        category_id: posts.categoryId,
        view_count: posts.viewCount,
        category_name: categories.name,
        category_slug: categories.slug,
        like_count: sql<number>`(
          SELECT COUNT(*)::int FROM likes l WHERE l.post_id = ${posts.id}
        )`,
        dislike_count: sql<number>`(
          SELECT COUNT(*)::int FROM dislikes d WHERE d.post_id = ${posts.id}
        )`,
        comment_count: sql<number>`(
          SELECT COUNT(*)::int FROM comments cmt WHERE cmt.post_id = ${posts.id}
        )`,
        favorite_count: sql<number>`(
          SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = ${posts.id}
        )`,
        favorited_by_me: viewer
          ? sql<boolean>`EXISTS(SELECT 1 FROM favorites f2 WHERE f2.post_id = ${posts.id} AND f2.username = ${viewer})`
          : sql<boolean>`false`,
      })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.categoryId))
      .where(whereClause)
      .orderBy(desc(posts.id))
      .limit(validSize)
      .offset(offset);

    return {
      items: rows.map((row) => mapListRow(row)),
      total: asNumber(totalRow?.cnt),
      page: validPage,
      size: validSize,
    };
  }

  async listFavorites(username: string, page = 1, size = 10): Promise<PaginatedResult<PostListItem>> {
    const db = getDb();
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);

    const [totalRow] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(favorites)
      .where(eq(favorites.username, username));

    const rows = await db
      .select({
        title: posts.title,
        slug: posts.slug,
        content: posts.content,
        excerpt: posts.excerpt,
        cover_image_url: posts.coverImageUrl,
        created_at: posts.createdAt,
        author: posts.author,
        tags: posts.tags,
        category_id: posts.categoryId,
        view_count: posts.viewCount,
        category_name: sql<string | null>`NULL`,
        category_slug: sql<string | null>`NULL`,
        like_count: sql<number>`(
          SELECT COUNT(*)::int FROM likes l WHERE l.post_id = ${posts.id}
        )`,
        dislike_count: sql<number>`(
          SELECT COUNT(*)::int FROM dislikes d WHERE d.post_id = ${posts.id}
        )`,
        comment_count: sql<number>`(
          SELECT COUNT(*)::int FROM comments cmt WHERE cmt.post_id = ${posts.id}
        )`,
        favorite_count: sql<number>`(
          SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = ${posts.id}
        )`,
        favorited_by_me: sql<boolean>`true`,
      })
      .from(favorites)
      .innerJoin(posts, eq(posts.id, favorites.postId))
      .where(eq(favorites.username, username))
      .orderBy(desc(favorites.createdAt))
      .limit(validSize)
      .offset(offset);

    return {
      items: rows.map((row) => mapListRow(row)),
      total: asNumber(totalRow?.cnt),
      page: validPage,
      size: validSize,
    };
  }

  async listSitemapPosts(): Promise<SitemapPostItem[]> {
    const db = getDb();
    return db
      .select({
        slug: posts.slug,
        updated_at: posts.updatedAt,
        created_at: posts.createdAt,
      })
      .from(posts)
      .where(
        and(
          sql`${posts.slug} is not null`,
          sql`trim(${posts.slug}) <> ''`,
          sql`(${posts.status} is null OR ${posts.status} <> 'deleted')`,
        ),
      )
      .orderBy(desc(posts.id));
  }

  async getActivities(username: string, page = 1, size = 10): Promise<PaginatedResult<PostActivityItem>> {
    const db = getDb();
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);

    const totalResult = await db.execute(sql<{ total: number }>`
      SELECT COALESCE(SUM(cnt), 0)::int AS total FROM (
        SELECT COUNT(*) AS cnt FROM posts WHERE author = ${username}
        UNION ALL
        SELECT COUNT(*) AS cnt FROM likes WHERE username = ${username}
        UNION ALL
        SELECT COUNT(*) AS cnt FROM comments WHERE author = ${username}
      ) t
    `);

    const itemsResult = await db.execute(sql<PostActivityItem>`
      SELECT
        'post' AS type,
        title,
        slug,
        created_at,
        substring(trim(replace(replace(content, chr(10), ' '), chr(13), ' ')) from 1 for 140) AS content,
        NULL AS target_user
      FROM posts
      WHERE author = ${username}
      UNION ALL
      SELECT
        'like' AS type,
        p.title,
        p.slug,
        l.created_at,
        substring(trim(replace(replace(p.content, chr(10), ' '), chr(13), ' ')) from 1 for 140) AS content,
        p.author AS target_user
      FROM likes l
      JOIN posts p ON l.post_id = p.id
      WHERE l.username = ${username}
      UNION ALL
      SELECT
        'comment' AS type,
        p.title,
        p.slug,
        c.created_at,
        c.content,
        p.author AS target_user
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE c.author = ${username}
      ORDER BY created_at DESC
      LIMIT ${validSize}
      OFFSET ${offset}
    `);

    return {
      items: itemsResult.rows.map((row) => ({
        type: String(row.type || "") as PostActivityItem["type"],
        title: String(row.title || ""),
        slug: String(row.slug || ""),
        created_at: String(row.created_at || ""),
        content: row.content ? String(row.content) : undefined,
        target_user: row.target_user ? String(row.target_user) : undefined,
      })),
      total: asNumber(totalResult.rows[0]?.total),
      page: validPage,
      size: validSize,
    };
  }

  async getActivityCount(username: string): Promise<number> {
    const db = getDb();
    const result = await db.execute(sql<{ total: number }>`
      SELECT COALESCE(SUM(cnt), 0)::int AS total FROM (
        SELECT COUNT(*) AS cnt FROM posts WHERE author = ${username}
        UNION ALL
        SELECT COUNT(*) AS cnt FROM likes WHERE username = ${username}
        UNION ALL
        SELECT COUNT(*) AS cnt FROM comments WHERE author = ${username}
      ) t
    `);

    return asNumber(result.rows[0]?.total);
  }

  async getLikesToUser(username: string, page = 1, size = 10): Promise<LikesToUserItem[]> {
    const db = getDb();
    const { size: validSize, offset } = normalizePagination(page, size);

    const result = await db.execute(sql<LikesToUserItem>`
      SELECT
        l.username AS sender,
        l.created_at,
        p.title AS post_title,
        p.slug AS post_slug
      FROM likes l
      JOIN posts p ON l.post_id = p.id
      WHERE p.author = ${username} AND l.username != ${username}
      ORDER BY l.created_at DESC
      LIMIT ${validSize}
      OFFSET ${offset}
    `);

    return result.rows.map((row) => ({
      sender: String(row.sender || ""),
      created_at: String(row.created_at || ""),
      post_title: String(row.post_title || ""),
      post_slug: String(row.post_slug || ""),
    }));
  }

  async getNewLikesCount(username: string, since: string): Promise<number> {
    const db = getDb();
    const result = await db.execute(sql<{ cnt: number }>`
      SELECT COUNT(*)::int AS cnt
      FROM likes l
      JOIN posts p ON l.post_id = p.id
      WHERE p.author = ${username}
        AND l.username != ${username}
        AND l.created_at > ${since}
    `);

    return asNumber(result.rows[0]?.cnt);
  }

  async getUserLikesReceived(username: string): Promise<number> {
    const db = getDb();
    const result = await db.execute(sql<{ cnt: number }>`
      SELECT COUNT(*)::int AS cnt
      FROM likes l
      JOIN posts p ON l.post_id = p.id
      WHERE p.author = ${username}
    `);

    return asNumber(result.rows[0]?.cnt);
  }

  async getPostCountByAuthor(author: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.author, author), sql`${posts.status} != 'deleted'`));

    return asNumber(row?.cnt);
  }
}

export const drizzlePostRepository = new DrizzlePostRepository();
