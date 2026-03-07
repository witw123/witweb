import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { TaskList } from "@/components/studio/modules/video/TaskList";

const { mockUseAuth, mockUseQuery, mockUseVideoOutputs } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseQuery: vi.fn(),
  mockUseVideoOutputs: vi.fn(),
}));

vi.mock("@/app/providers", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: mockUseQuery,
  };
});

vi.mock("@/components/studio/modules/video/hooks/useVideoOutputs", () => ({
  useVideoOutputs: mockUseVideoOutputs,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("Video TaskList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ token: "token" });
    mockUseQuery.mockReturnValue({
      isLoading: false,
      isFetching: false,
      dataUpdatedAt: Date.now(),
      refetch: vi.fn(),
      data: [
        {
          id: "task-1",
          status: "succeeded",
          progress: 100,
          prompt: "First task",
          created_at: "2026-03-07T00:00:00.000Z",
        },
        {
          id: "task-2",
          status: "succeeded",
          progress: 100,
          prompt: "Second task",
          created_at: "2026-03-07T01:00:00.000Z",
        },
      ],
    });
  });

  it("only disables the clicked finalize button while a task is finalizing", async () => {
    const pending = deferred<{ file: string }>();
    const finalizeOutput = vi.fn(() => pending.promise);
    mockUseVideoOutputs.mockReturnValue({ finalizeOutput });

    render(<TaskList />);

    const firstCard = screen.getByText("First task").closest(".studio-card");
    const secondCard = screen.getByText("Second task").closest(".studio-card");

    expect(firstCard).toBeTruthy();
    expect(secondCard).toBeTruthy();

    const firstButton = within(firstCard as HTMLElement).getByRole("button", { name: /落盘|钀界洏/i });
    const secondButton = within(secondCard as HTMLElement).getByRole("button", { name: /落盘|钀界洏/i });

    await act(async () => {
      fireEvent.click(firstButton);
    });

    expect(finalizeOutput).toHaveBeenCalledWith({ id: "task-1", prompt: "First task" });
    expect(firstButton).toBeDisabled();
    expect(secondButton).not.toBeDisabled();

    await act(async () => {
      pending.resolve({ file: "/downloads/a.mp4" });
      await pending.promise;
    });
  });
});
