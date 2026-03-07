import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockListSourceUrlsByUser,
  mockListSourcesByUser,
  mockListItemsByUser,
  mockListSavedTopicsByUser,
  mockListNotificationsByUser,
  mockListAlertRulesByUser,
  mockListAlertLogsByUser,
  mockInsertSource,
} = vi.hoisted(() => ({
  mockListSourceUrlsByUser: vi.fn(),
  mockListSourcesByUser: vi.fn(),
  mockListItemsByUser: vi.fn(),
  mockListSavedTopicsByUser: vi.fn(),
  mockListNotificationsByUser: vi.fn(),
  mockListAlertRulesByUser: vi.fn(),
  mockListAlertLogsByUser: vi.fn(),
  mockInsertSource: vi.fn(),
}));

vi.mock("@/lib/repositories", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories")>("@/lib/repositories");
  return {
    ...actual,
    drizzleTopicRadarRepository: {
      listSourceUrlsByUser: mockListSourceUrlsByUser,
      listSourcesByUser: mockListSourcesByUser,
      listItemsByUser: mockListItemsByUser,
      listSavedTopicsByUser: mockListSavedTopicsByUser,
      listNotificationsByUser: mockListNotificationsByUser,
      listAlertRulesByUser: mockListAlertRulesByUser,
      listAlertLogsByUser: mockListAlertLogsByUser,
    },
    topicRadarRepository: {
      ...actual.topicRadarRepository,
      insertSource: mockInsertSource,
    },
  };
});

import {
  listRadarAlertLogs,
  listRadarAlertRules,
  listRadarItems,
  listRadarNotifications,
  listRadarSavedTopics,
  listRadarSources,
} from "@/lib/topic-radar";

describe("topic-radar read chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSourceUrlsByUser.mockResolvedValue([]);
    mockListSourcesByUser.mockResolvedValue([]);
    mockListItemsByUser.mockResolvedValue([]);
    mockListSavedTopicsByUser.mockResolvedValue([]);
    mockListNotificationsByUser.mockResolvedValue([]);
    mockListAlertRulesByUser.mockResolvedValue([]);
    mockListAlertLogsByUser.mockResolvedValue([]);
    mockInsertSource.mockResolvedValue(1);
  });

  it("listRadarSources reads source list from drizzle repository", async () => {
    mockListSourcesByUser.mockResolvedValue([
      { id: 1, name: "HN", url: "https://hnrss.org/frontpage", type: "rss" },
    ]);

    const result = await listRadarSources("alice");

    expect(mockListSourceUrlsByUser).toHaveBeenCalledWith("alice");
    expect(mockListSourcesByUser).toHaveBeenCalledWith("alice");
    expect(result[0].name).toBe("HN");
  });

  it("listRadarItems reads items from drizzle repository", async () => {
    mockListItemsByUser.mockResolvedValue([
      { id: 1, source_id: 2, title: "AI", url: "https://x.test", summary: "", score: 90 },
    ]);

    const result = await listRadarItems("alice", { limit: 20, q: "AI", sourceId: 2 });

    expect(mockListItemsByUser).toHaveBeenCalledWith("alice", {
      limit: 20,
      q: "AI",
      sourceId: 2,
    });
    expect(result[0].title).toBe("AI");
  });

  it("listRadarSavedTopics reads topics from drizzle repository and parses tags", async () => {
    mockListSavedTopicsByUser.mockResolvedValue([
      {
        id: 1,
        created_by: "alice",
        kind: "item",
        title: "Topic",
        summary: "",
        content: "",
        source_name: "HN",
        source_url: "https://hnrss.org/frontpage",
        score: 80,
        tags_json: "[\"ai\",\"video\"]",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ]);

    const result = await listRadarSavedTopics("alice", { limit: 10, kind: "item" });

    expect(mockListSavedTopicsByUser).toHaveBeenCalledWith("alice", {
      limit: 10,
      q: undefined,
      kind: "item",
    });
    expect(result[0].tags).toEqual(["ai", "video"]);
  });

  it("listRadarNotifications reads notifications from drizzle repository", async () => {
    mockListNotificationsByUser.mockResolvedValue([
      { id: 1, name: "Slack", type: "webhook", webhook_url: "https://x.test" },
    ]);

    const result = await listRadarNotifications("alice");

    expect(mockListNotificationsByUser).toHaveBeenCalledWith("alice");
    expect(result[0].name).toBe("Slack");
  });

  it("listRadarAlertRules reads rules from drizzle repository", async () => {
    mockListAlertRulesByUser.mockResolvedValue([
      { id: 1, name: "High score", rule_type: "min_score", channel_name: "Slack" },
    ]);

    const result = await listRadarAlertRules("alice");

    expect(mockListAlertRulesByUser).toHaveBeenCalledWith("alice");
    expect(result[0].channel_name).toBe("Slack");
  });

  it("listRadarAlertLogs reads logs from drizzle repository", async () => {
    mockListAlertLogsByUser.mockResolvedValue([
      { id: 1, status: "success", rule_name: "High score", channel_name: "Slack", item_title: "AI" },
    ]);

    const result = await listRadarAlertLogs("alice", { limit: 20, status: "success" });

    expect(mockListAlertLogsByUser).toHaveBeenCalledWith("alice", {
      limit: 20,
      status: "success",
    });
    expect(result[0].rule_name).toBe("High score");
  });
});
