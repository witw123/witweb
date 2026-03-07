import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BlogPostPage from "@/features/blog/components/BlogPostPage";

const {
  mockUseAuth,
  mockUseParams,
  mockUseRouter,
  mockUsePostCache,
  mockPut,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseParams: vi.fn(),
  mockUseRouter: vi.fn(),
  mockUsePostCache: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("@/app/providers", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    useParams: mockUseParams,
    useRouter: mockUseRouter,
  };
});

vi.mock("@/features/blog/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/features/blog/hooks")>(
    "@/features/blog/hooks"
  );
  return {
    ...actual,
    usePostCache: mockUsePostCache,
  };
});

vi.mock("@/features/blog/components/UserHoverCard", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/blog/components/CommentSection", () => ({
  CommentSection: () => <div data-testid="comment-section" />,
}));

vi.mock("@/features/blog/components/BlogPostContent", () => ({
  BlogPostContent: ({
    onToggleEdit,
  }: {
    onToggleEdit: () => void;
  }) => (
    <button type="button" onClick={onToggleEdit}>
      编辑
    </button>
  ),
}));

vi.mock("dompurify", () => ({
  default: () => ({
    sanitize: (html: string) => html,
  }),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>(
    "@/lib/api-client"
  );
  return {
    ...actual,
    put: mockPut,
    post: vi.fn(),
  };
});

describe("BlogPostPage", () => {
  function createPostCacheResult(overrides: Record<string, unknown> = {}) {
    return {
      post: {
        id: 1,
        slug: "post-1",
        title: "Post 1",
        content: "Hello world",
        tags: "react, next",
        category_id: 2,
        category_name: "Tech",
        author: "alice",
        author_name: "Alice",
        author_avatar: "",
        created_at: "2026-03-07T00:00:00.000Z",
        like_count: 1,
        dislike_count: 0,
        favorite_count: 2,
        comment_count: 1,
        favorited_by_me: false,
        view_count: 8,
      },
      setPost: vi.fn(),
      comments: [],
      setComments: vi.fn(),
      categories: [
        { id: 2, name: "Tech", sort_order: 1 },
        { id: 3, name: "Life", sort_order: 2 },
      ],
      status: "ready",
      commentListStatus: "ready",
      refreshPost: vi.fn().mockResolvedValue(undefined),
      refreshComments: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ slug: "post-1" });
    mockUseRouter.mockReturnValue({ push: vi.fn() });
    mockUseAuth.mockReturnValue({
      user: { username: "alice", role: "user" },
      token: "token",
      isAuthenticated: true,
    });
    mockPut.mockResolvedValue({});
    mockUsePostCache.mockReturnValue(createPostCacheResult());
  });

  it("prefills edit form with current post data after entering edit mode", async () => {
    render(<BlogPostPage />);

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Post 1")).toBeInTheDocument();
      expect(screen.getByDisplayValue("react, next")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Hello world")).toBeInTheDocument();
    });
  });

  it("saves edited post through the versioned blog endpoint", async () => {
    const refreshPost = vi.fn().mockResolvedValue(undefined);
    mockUsePostCache.mockReturnValue(createPostCacheResult({ refreshPost }));

    render(<BlogPostPage />);

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByDisplayValue("Post 1"), {
      target: { value: "Updated title" },
    });
    fireEvent.change(screen.getByDisplayValue("Hello world"), {
      target: { value: "Updated content" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        "/api/v1/blog/post-1",
        expect.objectContaining({
          title: "Updated title",
          content: "Updated content",
          tags: "react, next",
          category_id: 2,
        })
      );
    });
    expect(refreshPost).toHaveBeenCalled();
  });
});
