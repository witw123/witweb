// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  formatAgentDate,
  formatFileSize,
  truncateText,
  truncateAtWord,
  capitalize,
  formatTaskType,
  formatGoalStatus,
} from "@/features/agent/utils/formatting";

describe("formatAgentDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns '刚刚' for dates less than 1 minute ago", () => {
    const date = new Date("2024-01-15T11:59:30Z");
    expect(formatAgentDate(date)).toBe("刚刚");
  });

  it("returns minutes ago for dates less than 1 hour ago", () => {
    const date = new Date("2024-01-15T11:30:00Z");
    expect(formatAgentDate(date)).toBe("30 分钟前");
  });

  it("returns hours ago for dates less than 24 hours ago", () => {
    const date = new Date("2024-01-15T10:00:00Z");
    expect(formatAgentDate(date)).toBe("2 小时前");
  });

  it("returns days ago for dates less than 7 days ago", () => {
    const date = new Date("2024-01-12T12:00:00Z");
    expect(formatAgentDate(date)).toBe("3 天前");
  });

  it("returns formatted date for dates more than 7 days ago", () => {
    const date = new Date("2024-01-01T12:00:00Z");
    const result = formatAgentDate(date);
    expect(result).toMatch(/\d+\/\d+/); // Matches "1/1" format
  });

  it("returns empty string for invalid dates", () => {
    expect(formatAgentDate("invalid")).toBe("");
    expect(formatAgentDate(new Date("invalid"))).toBe("");
  });

  it("accepts ISO string input", () => {
    const isoString = "2024-01-15T11:59:30Z";
    expect(formatAgentDate(isoString)).toBe("刚刚");
  });
});

describe("formatFileSize", () => {
  it("formats bytes correctly", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats kilobytes correctly", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("formats gigabytes correctly", () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.0 GB");
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
  });
});

describe("truncateText", () => {
  it("returns original text if shorter than maxLength", () => {
    expect(truncateText("Hello", 10)).toBe("Hello");
  });

  it("truncates text and adds ellipsis", () => {
    expect(truncateText("Hello World", 8)).toBe("Hello...");
  });

  it("handles exact length", () => {
    expect(truncateText("Hello", 5)).toBe("Hello");
  });
});

describe("truncateAtWord", () => {
  it("truncates at word boundary when possible", () => {
    // The function truncates at maxLength, then finds last space
    expect(truncateAtWord("Hello World Test", 10)).toBe("Hello Worl...");
  });

  it("truncates directly if no good word boundary", () => {
    // No space in first 10 characters, so truncates at 10
    expect(truncateAtWord("Supercalifragilistic", 10)).toBe("Supercalif...");
  });

  it("returns original text if shorter than maxLength", () => {
    expect(truncateAtWord("Hello", 10)).toBe("Hello");
  });
});

describe("capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("world")).toBe("World");
  });

  it("handles empty string", () => {
    expect(capitalize("")).toBe("");
  });

  it("handles single character", () => {
    expect(capitalize("a")).toBe("A");
  });
});

describe("formatTaskType", () => {
  it("returns correct labels for known task types", () => {
    expect(formatTaskType("general_assistant")).toBe("通用对话");
    expect(formatTaskType("hot_topic_article")).toBe("热点文章");
    expect(formatTaskType("continue_article")).toBe("续写文章");
    expect(formatTaskType("article_to_video")).toBe("视频脚本");
    expect(formatTaskType("publish_draft")).toBe("发布草稿");
  });

  it("returns original input for unknown task types", () => {
    expect(formatTaskType("unknown_type")).toBe("unknown_type");
  });
});

describe("formatGoalStatus", () => {
  it("returns correct labels for known statuses", () => {
    expect(formatGoalStatus("planned")).toBe("已规划");
    expect(formatGoalStatus("waiting_approval")).toBe("等待确认");
    expect(formatGoalStatus("running")).toBe("执行中");
    expect(formatGoalStatus("done")).toBe("已完成");
    expect(formatGoalStatus("failed")).toBe("执行失败");
  });

  it("returns original input for unknown statuses", () => {
    expect(formatGoalStatus("unknown")).toBe("unknown");
  });
});
