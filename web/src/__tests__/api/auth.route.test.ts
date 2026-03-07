// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { mockHandleLoginPost, mockHandleRegisterPost, mockHandleLogoutPost } = vi.hoisted(() => ({
  mockHandleLoginPost: vi.fn(),
  mockHandleRegisterPost: vi.fn(),
  mockHandleLogoutPost: vi.fn(),
}));

vi.mock("@/app/api/login/shared", () => ({
  handleLoginPost: mockHandleLoginPost,
}));

vi.mock("@/app/api/register/shared", () => ({
  handleRegisterPost: mockHandleRegisterPost,
}));

vi.mock("@/app/api/logout/shared", () => ({
  handleLogoutPost: mockHandleLogoutPost,
}));

import { POST as deprecatedLoginPost } from "@/app/api/login/route";
import { POST as versionedLoginPost } from "@/app/api/v1/auth/login/route";
import { POST as deprecatedRegisterPost } from "@/app/api/register/route";
import { POST as versionedRegisterPost } from "@/app/api/v1/auth/register/route";
import { POST as deprecatedLogoutPost } from "@/app/api/logout/route";
import { POST as versionedLogoutPost } from "@/app/api/v1/auth/logout/route";

describe("Auth API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleLoginPost.mockResolvedValue(
      NextResponse.json({ success: true, data: { token: "token", profile: { username: "demo" } } })
    );
    mockHandleRegisterPost.mockResolvedValue(
      NextResponse.json({ success: true, data: { token: "token", profile: { username: "demo" } } }, { status: 201 })
    );
    mockHandleLogoutPost.mockResolvedValue(NextResponse.json({ success: true, data: { ok: true } }));
  });

  it("deprecated login route returns deprecation headers", async () => {
    const response = await deprecatedLoginPost(
      new Request("http://localhost/api/login", { method: "POST" }) as never,
      undefined as never
    );

    expect(response.headers.get("Deprecation")).toBe("true");
    expect(response.headers.get("Link")).toContain("/api/v1/auth/login");
  });

  it("versioned login route does not return deprecation headers", async () => {
    const response = await versionedLoginPost(
      new Request("http://localhost/api/v1/auth/login", { method: "POST" }) as never,
      undefined as never
    );

    expect(response.headers.get("Deprecation")).toBeNull();
    expect(response.headers.get("Link")).toBeNull();
  });

  it("deprecated register route returns deprecation headers", async () => {
    const response = await deprecatedRegisterPost(
      new Request("http://localhost/api/register", { method: "POST" }) as never,
      undefined as never
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Deprecation")).toBe("true");
    expect(response.headers.get("Link")).toContain("/api/v1/auth/register");
  });

  it("versioned register route does not return deprecation headers", async () => {
    const response = await versionedRegisterPost(
      new Request("http://localhost/api/v1/auth/register", { method: "POST" }) as never,
      undefined as never
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Deprecation")).toBeNull();
  });

  it("deprecated logout route returns deprecation headers", async () => {
    const response = await deprecatedLogoutPost();

    expect(response.headers.get("Deprecation")).toBe("true");
    expect(response.headers.get("Link")).toContain("/api/v1/auth/logout");
  });

  it("versioned logout route does not return deprecation headers", async () => {
    const response = await versionedLogoutPost();

    expect(response.headers.get("Deprecation")).toBeNull();
    expect(response.headers.get("Link")).toBeNull();
  });
});
