/**
 * 关于页面内容仓储
 *
 * 负责"关于我"页面的持久化数据操作，包括：
 * - 获取关于页面内容（支持默认内容回退）
 * - 创建或更新关于页面内容（upsert 模式）
 *
 * 使用 PostgreSQL 原生 SQL 进行数据操作
 */

import { pgQueryOne, pgRun } from "@/lib/postgres-query";

/** 关于页面链接项 */
export type AboutLink = {
  label: string;
  url: string;
};

/** 关于页面完整内容 */
export type AboutContent = {
  title: string;
  subtitle: string;
  content: string;
  links: AboutLink[];
  skills: string[];
  updated_at: string;
  updated_by: string;
};

type AboutRow = {
  title: string;
  subtitle: string;
  content: string;
  links_json: string | null;
  skills_json: string | null;
  updated_at: string;
  updated_by: string;
};

const DEFAULT_ABOUT: AboutContent = {
  title: "关于我",
  subtitle: "技术、产品与持续创作",
  content:
    "你好，我是 witw。\n\n我长期专注于工程实践、AI 应用落地和内容创作系统化。\n\n这里会分享：\n- 项目复盘与架构思考\n- AI 工具链与效率方法\n- 创作流程与个人成长",
  links: [],
  skills: [],
  updated_at: "",
  updated_by: "",
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function parseLinks(raw: string | null): AboutLink[] {
  const arr = parseJson<AboutLink[]>(raw, []);
  return arr.filter(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof item.label === "string" &&
      typeof item.url === "string"
  );
}

/**
 * 关于页面内容数据访问类
 *
 * 提供静态初始化表和内容读写方法
 */
class AboutRepository {
  private initialized = false;

  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    await pgRun(`
      CREATE TABLE IF NOT EXISTS about_content (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        subtitle TEXT NOT NULL,
        content TEXT NOT NULL,
        links_json TEXT NOT NULL DEFAULT '[]',
        skills_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL
      )
    `);
    // Add columns if they don't exist (for existing tables)
    for (const col of ["links_json", "skills_json"]) {
      await pgRun(
        `ALTER TABLE about_content ADD COLUMN IF NOT EXISTS ${col} TEXT NOT NULL DEFAULT '[]'`
      ).catch(() => { });
    }
    this.initialized = true;
  }

  async get(): Promise<AboutContent> {
    await this.ensureTable();
    const row = await pgQueryOne<AboutRow>(
      "SELECT title, subtitle, content, links_json, skills_json, updated_at, updated_by FROM about_content WHERE id = 1"
    );
    if (!row) return { ...DEFAULT_ABOUT };
    return {
      title: row.title || DEFAULT_ABOUT.title,
      subtitle: row.subtitle || DEFAULT_ABOUT.subtitle,
      content: row.content || DEFAULT_ABOUT.content,
      links: parseLinks(row.links_json),
      skills: parseJson<string[]>(row.skills_json, []).filter((s) => typeof s === "string" && s.trim()),
      updated_at: row.updated_at || "",
      updated_by: row.updated_by || "",
    };
  }

  async upsert(input: {
    title: string;
    subtitle: string;
    content: string;
    links: AboutLink[];
    skills: string[];
    updated_by: string;
  }): Promise<AboutContent> {
    await this.ensureTable();
    const updatedAt = new Date().toISOString();
    const linksJson = JSON.stringify(input.links || []);
    const skillsJson = JSON.stringify(input.skills || []);
    await pgRun(
      `INSERT INTO about_content (id, title, subtitle, content, links_json, skills_json, updated_at, updated_by)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         subtitle = excluded.subtitle,
         content = excluded.content,
         links_json = excluded.links_json,
         skills_json = excluded.skills_json,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`,
      [input.title, input.subtitle, input.content, linksJson, skillsJson, updatedAt, input.updated_by]
    );
    return {
      title: input.title,
      subtitle: input.subtitle,
      content: input.content,
      links: input.links,
      skills: input.skills,
      updated_at: updatedAt,
      updated_by: input.updated_by,
    };
  }
}

export const aboutRepository = new AboutRepository();
