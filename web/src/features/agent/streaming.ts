export type NdjsonParseResult<T> = {
  events: T[];
  buffer: string;
};

export function parseNdjsonChunk<T>(buffer: string, chunk: string): NdjsonParseResult<T> {
  const lines = `${buffer}${chunk}`.split("\n");
  const nextBuffer = lines.pop() || "";
  const events: T[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      events.push(JSON.parse(trimmed) as T);
    } catch {
      // A single malformed NDJSON line should not kill the whole stream.
    }
  }

  return {
    events,
    buffer: nextBuffer,
  };
}

export function parseNdjsonRemainder<T>(buffer: string): T[] {
  const trimmed = buffer.trim();
  if (!trimmed) return [];

  try {
    return [JSON.parse(trimmed) as T];
  } catch {
    return [];
  }
}

export async function readResponseError(response: Response, fallback: string) {
  try {
    const text = await response.clone().text();
    if (!text.trim()) return fallback;
    try {
      const parsed = JSON.parse(text) as { message?: unknown; error?: unknown };
      const message = typeof parsed.message === "string" ? parsed.message : parsed.error;
      return typeof message === "string" && message.trim() ? message : text.trim();
    } catch {
      return text.trim();
    }
  } catch {
    return fallback;
  }
}

export async function readNdjsonStream<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: T) => void | Promise<void>
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    const decoded = decoder.decode(value || new Uint8Array(), { stream: !done });
    const result = parseNdjsonChunk<T>(buffer, decoded);
    buffer = result.buffer;

    for (const event of result.events) {
      await onEvent(event);
    }

    if (done) break;
  }

  for (const event of parseNdjsonRemainder<T>(buffer)) {
    await onEvent(event);
  }
}
