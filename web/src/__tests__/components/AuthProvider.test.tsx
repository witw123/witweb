import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth, type UserProfile } from "@/app/providers";

function AuthConsumer() {
  const { user, login, logout, loading, isAuthenticated } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? "loading" : "ready"}</div>
      <div data-testid="auth">{isAuthenticated ? "yes" : "no"}</div>
      <div data-testid="username">{user?.username || "anonymous"}</div>
      <button
        type="button"
        onClick={() =>
          login({
            username: "demo-user",
            nickname: "Demo",
          } satisfies UserProfile)
        }
      >
        login
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bootstraps auth state from cookie-based profile session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          profile: {
            username: "cookie-user",
            nickname: "Cookie",
          },
        },
      }),
    } as Response);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      expect(screen.getByTestId("auth")).toHaveTextContent("yes");
      expect(screen.getByTestId("username")).toHaveTextContent("cookie-user");
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/profile", {
      credentials: "same-origin",
    });
    expect(global.localStorage.getItem).not.toHaveBeenCalled();
    expect(global.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("updates auth state on login without writing localStorage token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
      expect(screen.getByTestId("auth")).toHaveTextContent("no");
    });

    fireEvent.click(screen.getByRole("button", { name: "login" }));

    expect(screen.getByTestId("auth")).toHaveTextContent("yes");
    expect(screen.getByTestId("username")).toHaveTextContent("demo-user");
    expect(global.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("clears auth state and calls logout endpoint", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            profile: {
              username: "cookie-user",
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth")).toHaveTextContent("yes");
    });

    fireEvent.click(screen.getByRole("button", { name: "logout" }));

    expect(screen.getByTestId("auth")).toHaveTextContent("no");
    expect(screen.getByTestId("username")).toHaveTextContent("anonymous");

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    });
    expect(global.localStorage.removeItem).not.toHaveBeenCalled();
  });
});
