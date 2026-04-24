import { describe, expect, it } from "vitest";
import { parseNdjsonChunk, parseNdjsonRemainder, readResponseError } from "@/features/agent/streaming";

describe("agent NDJSON streaming helpers", () => {
  it("parses valid lines and skips malformed lines", () => {
    const result = parseNdjsonChunk<{ type: string }>(
      "",
      '{"type":"phase"}\nnot-json\n\n{"type":"done"}\n'
    );

    expect(result.events).toEqual([{ type: "phase" }, { type: "done" }]);
    expect(result.buffer).toBe("");
  });

  it("keeps partial lines in the buffer", () => {
    const first = parseNdjsonChunk<{ type: string }>("", '{"type":"pha');
    const second = parseNdjsonChunk<{ type: string }>(first.buffer, 'se"}\n');

    expect(first.events).toEqual([]);
    expect(second.events).toEqual([{ type: "phase" }]);
    expect(second.buffer).toBe("");
  });

  it("parses a valid final remainder and ignores invalid remainders", () => {
    expect(parseNdjsonRemainder<{ type: string }>('{"type":"done"}')).toEqual([{ type: "done" }]);
    expect(parseNdjsonRemainder("bad-json")).toEqual([]);
  });

  it("extracts response error messages from JSON bodies", async () => {
    const response = new Response(JSON.stringify({ message: "stream failed" }), { status: 500 });

    await expect(readResponseError(response, "fallback")).resolves.toBe("stream failed");
  });
});
