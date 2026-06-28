import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import ProfilePage from "@/features/user/components/ProfilePage";

const {
  mockUseAuth,
  mockUsePostActions,
  mockResizeImageToDataUrl,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUsePostActions: vi.fn(),
  mockResizeImageToDataUrl: vi.fn(),
}));

vi.mock("@/app/providers", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/features/blog/hooks", () => ({
  usePostActions: mockUsePostActions,
}));

vi.mock("@/features/blog/components/post-list/PostCard", () => ({
  PostCard: () => <div data-testid="post-card" />,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@/utils/image", () => ({
  resizeImageToDataUrl: mockResizeImageToDataUrl,
  compressImageFile: vi.fn(async (file: File) => file),
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        username: "alice",
        role: "user",
        nickname: "Alice",
        avatar_url: "/uploads/old-avatar.png",
        cover_url: "",
        bio: "",
        created_at: "2026-03-07T00:00:00.000Z",
      },
      updateProfile: vi.fn(),
      isAuthenticated: true,
    });
    mockUsePostActions.mockReturnValue({
      like: vi.fn(),
      dislike: vi.fn(),
      favorite: vi.fn(),
    });
    mockResizeImageToDataUrl.mockResolvedValue("data:image/png;base64,new-avatar");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          profile: {
            username: "alice",
            role: "user",
            nickname: "Alice",
            avatar_url: "data:image/png;base64,new-avatar",
            cover_url: "",
            bio: "",
            created_at: "2026-03-07T00:00:00.000Z",
            following_count: 0,
            follower_count: 0,
            post_count: 0,
            activity_count: 0,
          },
          items: [],
          total: 0,
        },
      }),
    } as Response);
  });

  it("saves the newly selected avatar data URL instead of the previous avatar", async () => {
    const { container } = render(<ProfilePage />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept="image/*"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, {
      target: {
        files: [new File(["avatar"], "avatar.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/profile",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("data:image/png;base64,new-avatar"),
        }),
      );
    });
  });
});
