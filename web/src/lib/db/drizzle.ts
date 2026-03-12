/**
 * Drizzle ORM 数据库客户端
 *
 * 提供类型安全的数据库操作接口，单例模式确保全局共享连接
 */

import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { getPostgresPool } from "@/lib/db-postgres";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * 获取 Drizzle 数据库实例
 *
 * 单例模式，首次调用时创建实例，后续返回同一实例
 *
 * @returns 配置好的 Drizzle 数据库客户端
 */
export function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = drizzle(getPostgresPool(), {
    schema,
  });

  return dbInstance;
}

/** 数据库客户端类型别名 */
export type DbClient = ReturnType<typeof getDb>;
/** 数据库表结构定义 */
export { schema };
