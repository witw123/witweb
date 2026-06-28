// @vitest-environment node
import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/uploads/[...path]/route";

const createdFiles: string[] = [];

function writeUploadFixture(name: string, bytes: Buffer): string {
  const uploadsDir = path.resolve(process.cwd(), "..", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const target = path.join(uploadsDir, name);
  fs.writeFileSync(target, bytes);
  createdFiles.push(target);
  return name;
}

describe("public uploads route", () => {
  afterEach(() => {
    for (const file of createdFiles.splice(0)) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  it("serves uploaded png files with an image content type", async () => {
    const fileName = writeUploadFixture(
      `vitest-public-upload-${Date.now()}.png`,
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      ]),
    );

    const response = await GET(new Request(`http://localhost/uploads/${fileName}`), {
      params: Promise.resolve({ path: [fileName] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it("serves files from UPLOAD_DIR when configured", async () => {
    const previousUploadDir = process.env.UPLOAD_DIR;
    const uploadsDir = path.resolve(process.cwd(), "..", "uploads");
    process.env.UPLOAD_DIR = uploadsDir;

    try {
      const fileName = writeUploadFixture(
        `vitest-public-upload-env-${Date.now()}.webp`,
        Buffer.from("webp"),
      );

      const response = await GET(new Request(`http://localhost/uploads/${fileName}`), {
        params: Promise.resolve({ path: [fileName] }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/webp");
    } finally {
      if (previousUploadDir === undefined) {
        delete process.env.UPLOAD_DIR;
      } else {
        process.env.UPLOAD_DIR = previousUploadDir;
      }
    }
  });
});
