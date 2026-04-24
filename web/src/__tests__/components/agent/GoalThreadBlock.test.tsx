import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoalThreadBlock } from "@/features/agent/components/GoalThreadBlock";
import type { AgentGoalTimelineDto } from "@/features/agent/types";

function buildTimeline(): AgentGoalTimelineDto {
  return {
    goal: {
      id: "goal_1",
      goal: "写一篇文章",
      summary: "waiting",
      status: "waiting_approval",
      plan: { steps: [] },
    },
    timeline: [
      {
        id: 1,
        step_key: "compose_content",
        kind: "llm",
        title: "生成正文草稿",
        status: "done",
        started_at: "2026-04-21T00:00:00.000Z",
        finished_at: "2026-04-21T00:00:01.000Z",
        output: { title: "AI Agent" },
      },
      {
        id: 2,
        step_key: "create_post",
        kind: "tool",
        title: "保存博客草稿",
        status: "skipped_waiting_approval",
        started_at: "2026-04-21T00:00:01.000Z",
        input: { title: "AI Agent", content: "正文内容" },
      },
    ],
    approvals: [
      {
        id: 9,
        step_key: "create_post",
        action: "blog.create_post",
        risk_level: "publish_or_send",
        status: "pending",
        payload: {
          title: "AI Agent",
          excerpt: "摘要",
          tags: "AI,Agent",
          status: "draft",
          content: "正文内容".repeat(40),
        },
      },
    ],
    deliveries: [],
    events: [],
  };
}

describe("GoalThreadBlock", () => {
  it("shows approval payload preview and approve/reject actions", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <GoalThreadBlock
        goalTimeline={buildTimeline()}
        approvalError=""
        onApprove={onApprove}
        onReject={onReject}
        approvalPending={false}
        liveEvents={[
          {
            id: "event_1",
            source: "tool",
            kind: "tool_start",
            goal_id: "goal_1",
            title: "保存博客草稿",
            status: "running",
            detail: "正在保存",
            created_at: "2026-04-21T00:00:02.000Z",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText("查看任务详情"));

    expect(screen.getAllByText("AI Agent").length).toBeGreaterThan(0);
    expect(screen.getByText("摘要")).toBeInTheDocument();
    expect(screen.getByText("AI,Agent")).toBeInTheDocument();
    expect(screen.getByText("实时事件")).toBeInTheDocument();

    fireEvent.click(screen.getByText("确认"));
    fireEvent.click(screen.getByText("拒绝"));

    expect(onApprove).toHaveBeenCalledWith(9);
    expect(onReject).toHaveBeenCalledWith(9);
  });
});
