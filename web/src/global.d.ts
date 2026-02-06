// 全局类型声明

// better-sqlite3 类型声明
declare module "better-sqlite3" {
  interface DatabaseOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (sql: string) => void;
  }

  interface Statement {
    run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    iterate(...params: unknown[]): IterableIterator<unknown>;
    raw(naked?: boolean): this;
    bind(...params: unknown[]): this;
    columns(): Array<{ name: string; column: string | null; table: string | null; database: string | null; type: string | null }>;
    safeIntegers(enabled?: boolean): this;
  }

  interface Transaction<T extends (...args: unknown[]) => unknown> {
    (...args: Parameters<T>): ReturnType<T>;
    default(...args: Parameters<T>): ReturnType<T>;
    deferred(...args: Parameters<T>): ReturnType<T>;
    immediate(...args: Parameters<T>): ReturnType<T>;
    exclusive(...args: Parameters<T>): ReturnType<T>;
  }

  interface Database {
    name: string;
    memory: boolean;
    readonly: boolean;
    open: boolean;
    inTransaction: boolean;
    
    prepare(sql: string): Statement;
    exec(sql: string): this;
    pragma(pragma: string, options?: { simple?: boolean }): unknown;
    checkpoint(databaseName?: string): this;
    function(name: string, fn: (...args: unknown[]) => unknown): this;
    aggregate<T>(name: string, options: {
      start: () => T;
      step: (total: T, next: unknown) => T;
      result?: (total: T) => unknown;
    }): this;
    loadExtension(path: string): this;
    close(): void;
    defaultSafeIntegers(enabled?: boolean): this;
    backup(destination: string | Database, options?: { attached?: string; progress?: (info: { totalPages: number; remainingPages: number }) => number | void }): Promise<{ totalPages: number; remainingPages: number }>;
    table(name: string, options: { columns: string[]; rows: () => Generator<unknown[], void, unknown> }): this;
    unsafeMode(enabled?: boolean): this;
    transaction<T extends (...args: unknown[]) => unknown>(fn: T): Transaction<T>;
    serialize(options?: { attached?: string; table?: string }): Buffer;
  }

  interface DatabaseConstructor {
    new (filename: string | Buffer, options?: DatabaseOptions): Database;
    (filename: string | Buffer, options?: DatabaseOptions): Database;
    prototype: Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}
