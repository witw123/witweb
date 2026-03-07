import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { usePostCache } from "@/features/blog/hooks/usePostCache";

const { mockGet, mockPost, mockUseCategories } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockUseCategories: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  get: mockGet,
  post: mockPost,
}));

vi.mock("@/features/blog/hooks/useCategories", () => ({
  useCategories: mockUseCategories,
}));

describe("usePostCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCategories.mockReturnValue({
      categories: [{ id: 1, name: "Tech", sort_order: 1 }],
    });
    mockPost.mockResolvedValue({ view_count: 12 });
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/comments")) {
        return Promise.resolve([
          {
            id: 1,
            post_id: 1,
            author: "alice",
            author_name: "Alice",
            author_avatar: "",
            content: "hello",
            created_at: "2026-03-07T00:00:00.000Z",
            like_count: 0,
            dislike_count: 0,
            parent_id: null,
          },
        ]);
      }

      return Promise.resolve({
        id: 1,
        slug: "post-1",
        title: "Post 1",
        content: "## Heading",
        tags: "react, next",
        category_id: 1,
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
        view_count: 10,
      });
    });
    sessionStorage.clear();
  });

  function createWrapper(client: QueryClient) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };
  }

  it("loads post, comments and categories from query cache", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () =>
        usePostCache({
          slug: "post-1",
          token: "token",
          isAuthenticated: false,
        }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.post?.title).toBe("Post 1");
    expect(result.current.comments).toHaveLength(1);
    expect(result.current.categories).toEqual([{ id: 1, name: "Tech", sort_order: 1 }]);
  });

  it("updates post metrics when the metrics event is dispatched", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () =>
        usePostCache({
          slug: "post-1",
          token: "token",
          isAuthenticated: false,
        }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => expect(result.current.post?.like_count).toBe(1));

    window.dispatchEvent(
      new CustomEvent("post-metrics-updated", {
        detail: {
          slug: "post-1",
          like_count: 9,
          favorite_count: 7,
          comment_count: 3,
          favorited_by_me: true,
        },
      })
    );

    await waitFor(() => {
      expect(result.current.post?.like_count).toBe(9);
      expect(result.current.post?.favorite_count).toBe(7);
      expect(result.current.post?.comment_count).toBe(3);
      expect(result.current.post?.favorited_by_me).toBe(true);
    });
  });
});
