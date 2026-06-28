import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TagInput } from "@/features/blog/components/TagInput";

describe("TagInput", () => {
  it("adds multiple tags with comma and Enter, then emits a comma-separated value", () => {
    const handleChange = vi.fn();
    const { container, rerender } = render(
      <TagInput value="" onChange={handleChange} placeholder="添加标签" />,
    );

    const input = screen.getByPlaceholderText("添加标签");
    fireEvent.change(input, { target: { value: "AI, 随笔" } });
    fireEvent.keyDown(input, { key: "," });

    expect(handleChange).toHaveBeenLastCalledWith("AI,随笔");

    rerender(<TagInput value="AI,随笔" onChange={handleChange} placeholder="添加标签" />);
    const nextInput = container.querySelector<HTMLInputElement>("input")!;
    fireEvent.change(nextInput, { target: { value: "教程" } });
    fireEvent.keyDown(nextInput, { key: "Enter" });

    expect(handleChange).toHaveBeenLastCalledWith("AI,随笔,教程");
  });

  it("removes an existing tag", () => {
    const handleChange = vi.fn();
    render(<TagInput value="AI,随笔,教程" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "移除标签 随笔" }));

    expect(handleChange).toHaveBeenCalledWith("AI,教程");
  });
});
