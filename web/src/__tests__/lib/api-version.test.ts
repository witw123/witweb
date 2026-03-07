import { beforeEach, describe, expect, it } from "vitest";
import {
  annotateDeprecatedResponse,
  clearDeprecatedApiUsage,
  getDeprecatedApiUsage,
  getVersionedApiPath,
  recordDeprecatedApiUsage,
} from "@/lib/api-version";

describe("api-version", () => {
  beforeEach(() => {
    clearDeprecatedApiUsage();
  });

  it("builds versioned api paths", () => {
    expect(getVersionedApiPath("/blog")).toBe("/api/v1/blog");
    expect(getVersionedApiPath("messages")).toBe("/api/v1/messages");
  });

  it("records deprecated api usage counts", () => {
    recordDeprecatedApiUsage("/api/v1/messages", "/api/messages");
    recordDeprecatedApiUsage("/api/v1/messages", "/api/messages");

    expect(getDeprecatedApiUsage()).toEqual([
      expect.objectContaining({
        deprecatedPath: "/api/messages",
        replacementPath: "/api/v1/messages",
        count: 2,
      }),
    ]);
  });

  it("annotates deprecated responses with sunset headers and usage path", () => {
    const response = annotateDeprecatedResponse(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
      "/api/v1/blog",
      "/api/blog",
    );

    expect(response.headers.get("Deprecation")).toBe("true");
    expect(response.headers.get("Sunset")).toBe("2026-12-31");
    expect(response.headers.get("Link")).toBe("</api/v1/blog>; rel=\"successor-version\"");
    expect(response.headers.get("X-Deprecated-Route")).toBe("/api/blog");
    expect(getDeprecatedApiUsage()[0]).toEqual(
      expect.objectContaining({
        deprecatedPath: "/api/blog",
        replacementPath: "/api/v1/blog",
        count: 1,
      }),
    );
  });
});
