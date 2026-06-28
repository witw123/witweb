// @vitest-environment node
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthUser } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

import { handleUploadPost } from "@/app/api/upload/shared";

describe("handleUploadPost", () => {
  const originalCwd = process.cwd();
  let tempRoot = "";

  beforeEach(() => {
    mockGetAuthUser.mockResolvedValue("witw");
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "witweb-upload-"));
    const appRoot = path.join(tempRoot, "app");
    fs.mkdirSync(path.join(appRoot, "public", "uploads"), { recursive: true });
    process.chdir(appRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("stores images in the mounted public uploads directory when it exists", async () => {
    const form = new FormData();
    form.append("file", new File(["image"], "cover.png", { type: "image/png" }));

    const response = await handleUploadPost(
      new Request("http://localhost/api/v1/upload/image", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    const filename = path.basename(body.data.url);

    expect(fs.existsSync(path.join(tempRoot, "app", "public", "uploads", filename))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "uploads", filename))).toBe(false);
  });
});
