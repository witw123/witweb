import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/drizzle";
import { commentVotes, comments, posts } from "@/lib/db/schema";
import type { Comment } from "@/types";

export interface DrizzleCreateCommentData {
  post_id: number;
  author: string;
  content: string;
  parent_id?: number | null;
  ip_address?: string;
}

export class DrizzleCommentRepository {
  async findById(id: number): Promise<Comment | null> {
    const db = getDb();
    const rows = await db
      .select({
        id: comments.id,
        post_id: comments.postId,
        author: comments.author,
        content: comments.content,
        created_at: comments.createdAt,
        parent_id: comments.parentId,
        ip_address: comments.ipAddress,
      })
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);

    return rows[0] || null;
  }

  async findByPostSlug(slug: string): Promise<Comment[]> {
    const db = getDb();
    const rows = await db
      .select({
        id: comments.id,
        post_id: comments.postId,
        author: comments.author,
        content: comments.content,
        created_at: comments.createdAt,
        parent_id: comments.parentId,
        ip_address: comments.ipAddress,
        like_count: sql<number>`(
          SELECT COUNT(*)::int
          FROM comment_votes v
          WHERE v.comment_id = ${comments.id} AND v.value = 1
        )`,
        dislike_count: sql<number>`(
          SELECT COUNT(*)::int
          FROM comment_votes v
          WHERE v.comment_id = ${comments.id} AND v.value = -1
        )`,
      })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .where(eq(posts.slug, slug))
      .orderBy(desc(comments.id));

    return rows.map((row) => ({
      ...row,
      like_count: Number(row.like_count || 0),
      dislike_count: Number(row.dislike_count || 0),
    }));
  }

  async create(data: DrizzleCreateCommentData): Promise<number> {
    const db = getDb();
    const rows = await db
      .insert(comments)
      .values({
        postId: data.post_id,
        author: data.author,
        content: data.content,
        createdAt: sql`now()`,
        parentId: data.parent_id || null,
        ipAddress: data.ip_address || null,
      })
      .returning({ id: comments.id });

    return Number(rows[0]?.id || 0);
  }

  async updateContent(id: number, content: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .update(comments)
      .set({ content })
      .where(eq(comments.id, id))
      .returning({ id: comments.id });

    return rows.length > 0;
  }

  async delete(id: number): Promise<boolean> {
    const db = getDb();
    const rows = await db
      .delete(comments)
      .where(eq(comments.id, id))
      .returning({ id: comments.id });

    return rows.length > 0;
  }

  async vote(commentId: number, username: string, value: 1 | -1): Promise<boolean> {
    const db = getDb();
    const existing = await db
      .select({ id: commentVotes.id })
      .from(commentVotes)
      .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.username, username)))
      .limit(1);

    if (existing[0]) {
      const rows = await db
        .update(commentVotes)
        .set({
          value,
          createdAt: sql`now()`,
        })
        .where(eq(commentVotes.id, existing[0].id))
        .returning({ id: commentVotes.id });

      return rows.length > 0;
    }

    const rows = await db
      .insert(commentVotes)
      .values({
        commentId,
        username,
        value,
        createdAt: sql`now()`,
      })
      .returning({ id: commentVotes.id });

    return rows.length > 0;
  }
}

export const drizzleCommentRepository = new DrizzleCommentRepository();
