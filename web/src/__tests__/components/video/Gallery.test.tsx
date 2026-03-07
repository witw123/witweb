import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Gallery } from "@/components/studio/modules/video/Gallery";

const { mockUseAuth, mockUseVideoOutputs } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseVideoOutputs: vi.fn(),
}));

vi.mock("@/app/providers", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/components/studio/modules/video/hooks/useVideoOutputs", () => ({
  useVideoOutputs: mockUseVideoOutputs,
}));

describe("Video Gallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ token: "token" });
    mockUseVideoOutputs.mockReturnValue({
      outputs: [
        {
          name: "local.mp4",
          size: 1024,
          mtime: 1741000000,
          url: "/downloads/local.mp4",
          task_id: "done-task",
          generated_time: 1741000000,
          duration_seconds: 18,
          prompt: "Local output",
        },
      ],
      succeededTasks: [
        {
          id: "done-task",
          prompt: "Already finalized",
          created_at: "2026-03-07T00:00:00.000Z",
        },
        {
          id: "pending-task",
          prompt: "Needs finalize",
          created_at: "2026-03-07T01:00:00.000Z",
        },
      ],
      loadingOutputs: false,
      refreshingOutputs: false,
      refreshOutputs: vi.fn(),
      deleteOutput: vi.fn(),
      deletingOutput: false,
      finalizeOutput: vi.fn(),
    });
  });

  it("shows local outputs and only unmatched succeeded tasks in pending finalize list", () => {
    render(<Gallery />);

    expect(screen.getByText("Local output")).toBeInTheDocument();
    expect(screen.getByText("Needs finalize")).toBeInTheDocument();
    expect(screen.queryByText("Already finalized")).not.toBeInTheDocument();
  });
});
