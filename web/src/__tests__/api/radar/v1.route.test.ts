// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAuthUser,
  mockListRadarNotifications,
  mockListRadarAlertRules,
  mockListRadarAlertLogs,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockListRadarNotifications: vi.fn(),
  mockListRadarAlertRules: vi.fn(),
  mockListRadarAlertLogs: vi.fn(),
}));

vi.mock("@/lib/http", () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock("@/lib/topic-radar", () => ({
  listRadarNotifications: mockListRadarNotifications,
  listRadarAlertRules: mockListRadarAlertRules,
  listRadarAlertLogs: mockListRadarAlertLogs,
}));

import { GET as GET_NOTIFICATIONS } from "@/app/api/v1/radar/notifications/route";
import { GET as GET_ALERT_RULES } from "@/app/api/v1/radar/alert-rules/route";
import { GET as GET_ALERT_LOGS } from "@/app/api/v1/radar/alert-logs/route";

describe("Radar v1 list APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(null);
    mockListRadarNotifications.mockResolvedValue([]);
    mockListRadarAlertRules.mockResolvedValue([]);
    mockListRadarAlertLogs.mockResolvedValue([]);
  });

  it("GET /api/v1/radar/notifications returns 401 when unauthenticated", async () => {
    const response = await GET_NOTIFICATIONS(
      new Request("http://localhost/api/v1/radar/notifications") as never
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("GET /api/v1/radar/notifications returns items for owner", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockListRadarNotifications.mockResolvedValue([{ id: 1, name: "Slack" }]);

    const response = await GET_NOTIFICATIONS(
      new Request("http://localhost/api/v1/radar/notifications") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListRadarNotifications).toHaveBeenCalledWith("alice");
    expect(body.data.items).toEqual([{ id: 1, name: "Slack" }]);
  });

  it("GET /api/v1/radar/alert-rules returns items for owner", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockListRadarAlertRules.mockResolvedValue([{ id: 1, name: "High score" }]);

    const response = await GET_ALERT_RULES(
      new Request("http://localhost/api/v1/radar/alert-rules") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListRadarAlertRules).toHaveBeenCalledWith("alice");
    expect(body.data.items).toEqual([{ id: 1, name: "High score" }]);
  });

  it("GET /api/v1/radar/alert-logs returns 422 for invalid query", async () => {
    mockGetAuthUser.mockResolvedValue("alice");

    const response = await GET_ALERT_LOGS(
      new Request("http://localhost/api/v1/radar/alert-logs?limit=0") as never
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
  });

  it("GET /api/v1/radar/alert-logs returns items for owner", async () => {
    mockGetAuthUser.mockResolvedValue("alice");
    mockListRadarAlertLogs.mockResolvedValue([{ id: 1, status: "success" }]);

    const response = await GET_ALERT_LOGS(
      new Request("http://localhost/api/v1/radar/alert-logs?limit=20&status=success") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockListRadarAlertLogs).toHaveBeenCalledWith("alice", {
      limit: 20,
      status: "success",
    });
    expect(body.data.items).toEqual([{ id: 1, status: "success" }]);
  });
});
