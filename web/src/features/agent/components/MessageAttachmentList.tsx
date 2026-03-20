import type { AgentAttachment } from "@/features/agent/types";
import { formatAgentAttachmentSize } from "@/lib/agent-attachment-utils";

interface MessageAttachmentListProps {
  attachments: AgentAttachment[];
}

export function MessageAttachmentList({ attachments }: MessageAttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="agent-message-attachments">
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="agent-message-attachment"
        >
          <div className="agent-message-attachment__title">{attachment.name}</div>
          <div className="agent-message-attachment__meta">
            {attachment.kind === "image" ? "图片" : "文档"} / {formatAgentAttachmentSize(attachment.size)}
          </div>
        </a>
      ))}
    </div>
  );
}
