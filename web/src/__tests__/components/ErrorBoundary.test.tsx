import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { logErrorBoundary } from "@/lib/logger";

vi.mock("@/lib/logger", () => ({
  logErrorBoundary: vi.fn(),
}));

function ThrowingComponent() {
  throw new Error("render failed");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders fallback UI and logs render errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(logErrorBoundary).toHaveBeenCalledTimes(1);
  });
});
