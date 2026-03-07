import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommentSection } from "@/features/blog/components/CommentSection";

const {
  mockUseAuth,
  mockSubmitComment,
  mockLikeComment,
  mockDislikeComment,
  mockUpdateComment,
  mockDeleteComment,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockSubmitComment: vi.fn(),
  mockLikeComment: vi.fn(),
  mockDislikeComment: vi.fn(),
  mockUpdateComment: vi.fn(),
  mockDeleteComment: vi.fn(),
}));

vi.mock("@/app/providers", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/features/blog/components/UserHoverCard", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/blog/hooks", () => ({
  useSubmitComment: () => ({
    submitComment: mockSubmitComment,
    submitting: false,
  }),
  useCommentActions: () => ({
    likeComment: mockLikeComment,
    dislikeComment: mockDislikeComment,
    updateComment: mockUpdateComment,
    deleteComment: mockDeleteComment,
  }),
}));

describe("CommentSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: "token",
      isAuthenticated: true,
    });
    mockSubmitComment.mockResolvedValue({
      ok: true,
      message: "评论已发布。",
    });
    mockLikeComment.mockResolvedValue({ ok: true, message: "ok" });
    mockDislikeComment.mockResolvedValue({ ok: true, message: "ok" });
    mockUpdateComment.mockResolvedValue({ ok: true, message: "ok" });
    mockDeleteComment.mockResolvedValue({ ok: true, message: "ok" });
  });

  it("prefixes the textarea when replying to a comment", async () => {
    render(
      <CommentSection
        slug="post-1"
        commentListStatus="ready"
        isAdmin={false}
        refreshPost={vi.fn().mockResolvedValue(undefined)}
        refreshComments={vi.fn().mockResolvedValue(undefined)}
        comments={[
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
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /回复/ }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("回复 @Alice") as HTMLTextAreaElement
      ).toHaveValue("@Alice ");
    });
  });

  it("shows admin edit and delete actions when current user is admin", () => {
    render(
      <CommentSection
        slug="post-1"
        commentListStatus="ready"
        isAdmin={true}
        refreshPost={vi.fn().mockResolvedValue(undefined)}
        refreshComments={vi.fn().mockResolvedValue(undefined)}
        comments={[
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
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
  });
});
