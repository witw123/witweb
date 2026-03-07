import { beforeEach, describe, expect, it } from "vitest";
import { clearErrorLogs, getErrorLogs, logError } from "@/lib/logger";

describe("logger", () => {
  beforeEach(() => {
    clearErrorLogs();
  });

  it("stores normalized error records", () => {
    const record = logError({
      source: "test.logger",
      error: new Error("boom"),
      context: { route: "/api/test" },
    });

    expect(record.source).toBe("test.logger");
    expect(record.message).toBe("boom");
    expect(record.context).toEqual({ route: "/api/test" });
    expect(getErrorLogs()).toHaveLength(1);
  });

  it("keeps only the latest 50 records", () => {
    for (let index = 0; index < 55; index += 1) {
      logError({
        source: "test.buffer",
        error: new Error(`error-${index}`),
      });
    }

    const records = getErrorLogs();
    expect(records).toHaveLength(50);
    expect(records[0]?.message).toBe("error-5");
    expect(records[49]?.message).toBe("error-54");
  });
});
