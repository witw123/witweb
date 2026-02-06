import "server-only";
import type DatabaseType from "better-sqlite3";
import { dbManager, type DbKind } from "./db-manager";

/**
 * 
 */

interface TransactionOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  isolationLevel?: "DEFERRED" | "IMMEDIATE" | "EXCLUSIVE";
}

interface TransactionContext {
  db: DatabaseType;
  kind: DbKind;
  attempt: number;
}

type TransactionFn<T> = (ctx: TransactionContext) => T;

const DEFAULT_OPTIONS: Required<TransactionOptions> = {
  maxRetries: 3,
  retryDelay: 100,
  timeout: 30000,
  isolationLevel: "IMMEDIATE",
};

const RETRYABLE_ERRORS = [
  "SQLITE_BUSY",
  "SQLITE_LOCKED",
  "database is locked",
  "busy",
];

/**
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return RETRYABLE_ERRORS.some(code => 
    message.includes(code.toLowerCase())
  );
}

/**
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 
 * @example
 * ```typescript
 * const result = await runInTransaction("blog", (ctx) => {
 *   const { db } = ctx;
 *   const stmt = db.prepare("INSERT INTO posts (title) VALUES (?)");
 *   return stmt.run("My Post");
 * });
 * ```
 */
export async function runInTransaction<T>(
  kind: DbKind,
  fn: TransactionFn<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const db = dbManager.getConnection(kind);
  
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await executeWithTimeout(db, kind, fn, attempt, opts);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(lastError) || attempt >= opts.maxRetries) {
        throw lastError;
      }

      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[DB Transaction] Retry ${attempt}/${opts.maxRetries} for ${kind}:`,
          lastError.message
        );
      }

      const delay = opts.retryDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError || new Error("Transaction failed after max retries");
}

/**
 */
function executeWithTimeout<T>(
  db: DatabaseType,
  kind: DbKind,
  fn: TransactionFn<T>,
  attempt: number,
  options: Required<TransactionOptions>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Transaction timeout after ${options.timeout}ms`));
    }, options.timeout);

    try {
      db.exec(`BEGIN ${options.isolationLevel}`);

      const ctx: TransactionContext = {
        db,
        kind,
        attempt,
      };

      const result = fn(ctx);
      
      db.exec("COMMIT");
      clearTimeout(timeoutId);
      resolve(result);
    } catch (error) {
      clearTimeout(timeoutId);
      
      try {
        db.exec("ROLLBACK");
      } catch (rollbackError) {
        console.error("[DB Transaction] Rollback failed:", rollbackError);
      }

      reject(error);
    }
  });
}

/**
 * 
 * @example
 * ```typescript
 * const result = runInTransactionSync("blog", (ctx) => {
 *   const { db } = ctx;
 *   return db.prepare("SELECT * FROM posts").all();
 * });
 * ```
 */
export function runInTransactionSync<T>(
  kind: DbKind,
  fn: TransactionFn<T>,
  options: Omit<TransactionOptions, "timeout"> = {}
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const db = dbManager.getConnection(kind);

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return executeTransactionSync(db, kind, fn, attempt, opts);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(lastError) || attempt >= opts.maxRetries) {
        throw lastError;
      }

      const start = Date.now();
      while (Date.now() - start < opts.retryDelay * Math.pow(2, attempt - 1)) {
      }
    }
  }

  throw lastError || new Error("Transaction failed after max retries");
}

/**
 */
function executeTransactionSync<T>(
  db: DatabaseType,
  kind: DbKind,
  fn: TransactionFn<T>,
  attempt: number,
  options: Required<Omit<TransactionOptions, "timeout">>
): T {
  db.exec(`BEGIN ${options.isolationLevel}`);

  try {
    const ctx: TransactionContext = {
      db,
      kind,
      attempt,
    };

    const result = fn(ctx);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch (rollbackError) {
      console.error("[DB Transaction] Rollback failed:", rollbackError);
    }
    throw error;
  }
}

/**
 * 
 * @example
 * ```typescript
 * const results = await batchTransaction("blog", [
 *   (ctx) => ctx.db.prepare("INSERT ...").run(),
 *   (ctx) => ctx.db.prepare("UPDATE ...").run(),
 * ]);
 * ```
 */
export async function batchTransaction<T>(
  kind: DbKind,
  operations: TransactionFn<T>[],
  options: TransactionOptions = {}
): Promise<T[]> {
  return runInTransaction(
    kind,
    (ctx) => operations.map(op => op(ctx)),
    options
  );
}

/**
 * 
 * @example
 * ```typescript
 * const result = await crossDbTransaction(
 *   [
 *     { kind: "users", fn: (ctx) => { ... } },
 *     { kind: "blog", fn: (ctx) => { ... } },
 *   ],
 *   { allOrNothing: true }
 * );
 * ```
 */
interface CrossDbOperation<T> {
  kind: DbKind;
  fn: TransactionFn<T>;
}

interface CrossDbOptions {
  allOrNothing?: boolean;
  timeout?: number;
}

export async function crossDbTransaction<T>(
  operations: CrossDbOperation<T>[],
  options: CrossDbOptions = {}
): Promise<Array<{ kind: DbKind; success: boolean; result?: T; error?: Error }>> {
  const results: Array<{ kind: DbKind; success: boolean; result?: T; error?: Error }> = [];
  const executed: Array<{ kind: DbKind; rollback?: () => void }> = [];

  for (const op of operations) {
    try {
      const result = await runInTransaction(op.kind, op.fn, {
        timeout: options.timeout,
      });
      
      results.push({
        kind: op.kind,
        success: true,
        result,
      });
      
      executed.push({ kind: op.kind });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      results.push({
        kind: op.kind,
        success: false,
        error: err,
      });

      if (options.allOrNothing) {
        console.error(`[DB Transaction] Cross-db transaction failed at ${op.kind}:`, err);
        break;
      }
    }
  }

  return results;
}

/**
 */
export function createTransactionWrapper(
  kind: DbKind,
  defaultOptions: TransactionOptions = {}
) {
  return {
    run: <T>(fn: TransactionFn<T>, options?: TransactionOptions) =>
      runInTransaction(kind, fn, { ...defaultOptions, ...options }),
    
    runSync: <T>(fn: TransactionFn<T>, options?: Omit<TransactionOptions, "timeout">) =>
      runInTransactionSync(kind, fn, { ...defaultOptions, ...options }),
    
    batch: <T>(operations: TransactionFn<T>[], options?: TransactionOptions) =>
      batchTransaction(kind, operations, { ...defaultOptions, ...options }),
  };
}

export const usersDbTransaction = createTransactionWrapper("users");
export const blogDbTransaction = createTransactionWrapper("blog");
export const studioDbTransaction = createTransactionWrapper("studio");
export const messagesDbTransaction = createTransactionWrapper("messages");

export type { TransactionOptions, TransactionContext, CrossDbOperation, CrossDbOptions };
