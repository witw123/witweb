// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { mockHandleUploadPost } = vi.hoisted(() => ({
  mockHandleUploadPost: vi.fn(),
}));

vi.mock("@/app/api/upload/shared", () => ({
  handleUploadPost: mockHandleUploadPost,
}));

import { POST as deprecatedUploadPost } from "@/app/api/upload/route";
import { POST as versionedUploadPost } from "@/app/api/v1/upload/image/route";

describe("Upload API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleUploadPost.mockResolvedValue(
      NextResponse.json({ success: true, data: { url: "/uploads/test.png" } }, { status: 201 })
    );
  });

  it("deprecated upload route returns deprecation headers", async () => {
    const response = await deprecatedUploadPost(
      new Request("http://localhost/api/upload", { method: "POST" }) as never,
      undefined as never
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Deprecation")).toBe("true");
    expect(response.headers.get("Sunset")).toBe("2026-12-31");
    expect(response.headers.get("Link")).toContain("/api/v1/upload/image");
    expect(response.headers.get("X-Deprecated-Route")).toBe("/api/upload");
  });

  it("versioned upload image route does not return deprecation headers", async () => {
    const response = await versionedUploadPost(
      new Request("http://localhost/api/v1/upload/image", { method: "POST" }) as never,
      undefined as never
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Deprecation")).toBeNull();
    expect(response.headers.get("Sunset")).toBeNull();
    expect(response.headers.get("Link")).toBeNull();
    expect(response.headers.get("X-Deprecated-Route")).toBeNull();
  });
});
