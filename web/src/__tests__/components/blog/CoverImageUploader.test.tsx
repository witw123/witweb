import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CoverImageUploader } from "@/features/blog/components/CoverImageUploader";

const {
  mockCompressImageFile,
  mockResizeImageFile,
  mockUploadImageRequest,
} = vi.hoisted(() => ({
  mockCompressImageFile: vi.fn(),
  mockResizeImageFile: vi.fn(),
  mockUploadImageRequest: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@/utils/image", () => ({
  compressImageFile: mockCompressImageFile,
  resizeImageFile: mockResizeImageFile,
}));

vi.mock("@/lib/upload-image-client", () => ({
  uploadImageRequest: mockUploadImageRequest,
}));

describe("CoverImageUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compresses cover images below the production proxy limit before upload", async () => {
    const sourceFile = new File(["large image"], "cover.png", { type: "image/png" });
    const compressedFile = new File(["compressed"], "cover.jpg", { type: "image/jpeg" });
    mockCompressImageFile.mockResolvedValue(compressedFile);
    mockResizeImageFile.mockResolvedValue(sourceFile);
    mockUploadImageRequest.mockResolvedValue("/uploads/cover.jpg");
    const handleChange = vi.fn();

    const { container } = render(<CoverImageUploader value="" onChange={handleChange} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, { target: { files: [sourceFile] } });

    await waitFor(() => {
      expect(mockCompressImageFile).toHaveBeenCalledWith(sourceFile, {
        maxSize: 1200,
        maxBytes: 900 * 1024,
      });
    });
    expect(mockUploadImageRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        formData: expect.any(FormData),
        source: "blog.cover-image",
      }),
    );
    expect(handleChange).toHaveBeenCalledWith("/uploads/cover.jpg");
  });
});
