import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { getPostgresPool } from "@/lib/db-postgres";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = drizzle(getPostgresPool(), {
    schema,
  });

  return dbInstance;
}

export type DbClient = ReturnType<typeof getDb>;
export { schema };
