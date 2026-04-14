"use client";

import { useEffect, useRef, useState } from "react";
import { AGENT_INPUT_TEXT } from "@/features/agent/constants";
import { AGENT_ATTACHMENT_ACCEPT, AGENT_ATTACHMENT_LIMIT, buildAgentAttachmentFallbackMessage } from "@/lib/agent-attachment-utils";
import { useConversationStream, useAttachmentUpload } from "@/features/agent/hooks";

interface ChatInputProps {
  conversationId?: string | null;
  onConversationReady: (id: string) => void;
  goal: string;
  taskType: string;
  onGoalChange: (value: string) => void;
  onTaskTypeChange: (value: string) => void;
  disabled?: boolean;
}

const taskTypeOptions = [
  { value: "hot_topic_article", label: "撰写热点文" },
  { value: "continue_article", label: "续写文章" },
  { value: "article_to_video", label: "图文转视频脚本" },
  { value: "publish_draft", label: "发布草稿" },
] as const;

export function ChatInput({
  conversationId,
  onConversationReady,
  goal,
  taskType,
  onGoalChange,
  onTaskTypeChange,
  disabled,
}: ChatInputProps) {
  const [errorMsg, setErrorMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    attachments,
    uploadedAttachments,
    isUploading,
    uploadFiles,
    removeAttachment,
    clearAttachments,
  } = useAttachmentUpload({
    onError: setErrorMsg,
  });

  const optimisticDisplayContent = goal.trim() || buildAgentAttachmentFallbackMessage(uploadedAttachments);
  const canSubmit = Boolean(optimisticDisplayContent) && !isUploading && !disabled;

  const { submit, isPending, stop } = useConversationStream({
    conversationId,
    onConversationReady,
    showAdvanced,
    taskType,
    callbacks: {
      onReset: () => {
        onGoalChange("");
        clearAttachments();
        setErrorMsg("");
      },
      onError: (error) => setErrorMsg(error),
    },
  });

  const handleSubmit = () => {
    if (!canSubmit || isPending) return;
    submit({
      content: goal.trim(),
      taskType: showAdvanced ? taskType : undefined,
      attachments: uploadedAttachments,
    });
  };

  const handleStop = () => {
    stop();
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [goal]);

  useEffect(() => {
    if (!goal.trim()) return;
    textareaRef.current?.focus();
    const length = textareaRef.current?.value.length ?? 0;
    textareaRef.current?.setSelectionRange(length, length);
  }, [goal]);

  return (
    <div className="agent-input-container">
      <div className="agent-input-box">
        <input
          ref={fileInputRef}
          type="file"
          accept={AGENT_ATTACHMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => {
            void uploadFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />

        {attachments.length > 0 ? (
          <div className="agent-attachment-list">
            {attachments.map((attachment) => (
              <div key={attachment.id} className={`agent-attachment-chip is-${attachment.local_status}`}>
                <div className="agent-attachment-chip__body">
                  <span className="agent-attachment-chip__name">{attachment.name}</span>
                  <span className="agent-attachment-chip__meta">
                    {attachment.local_status === "uploading"
                      ? "上传中..."
                      : attachment.local_status === "failed"
                        ? attachment.error || "上传失败"
                        : attachment.mime_type}
                  </span>
                </div>
                <button
                  type="button"
                  className="agent-attachment-chip__remove"
                  onClick={() => removeAttachment(attachment.id)}
                  disabled={isPending}
                  aria-label={`移除附件 ${attachment.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          className="agent-textarea custom-scrollbar"
          placeholder={AGENT_INPUT_TEXT.placeholder}
          value={goal}
          onChange={(event) => onGoalChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          disabled={isPending || disabled}
          rows={1}
        />

        {errorMsg ? <div className="mt-1 px-2 text-xs text-red-500">{errorMsg}</div> : null}

        <div className="agent-input-actions">
          <div className="agent-input-actions__left">
            <button
              type="button"
              className="agent-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending || disabled || attachments.length >= AGENT_ATTACHMENT_LIMIT}
            >
              添加附件
            </button>

            <button
              type="button"
              className={`agent-advanced-toggle ${showAdvanced ? "active" : ""}`}
              onClick={() => setShowAdvanced((value) => !value)}
              disabled={isPending || disabled}
            >
              {showAdvanced ? AGENT_INPUT_TEXT.advancedOpen : AGENT_INPUT_TEXT.advancedClosed}
            </button>
          </div>

          <button
            className={`agent-send-btn ${isPending ? "is-stop" : ""}`}
            onClick={isPending ? handleStop : handleSubmit}
            disabled={isPending ? false : !canSubmit}
            title={isPending ? AGENT_INPUT_TEXT.stopTitle : AGENT_INPUT_TEXT.sendTitle}
            type="button"
          >
            {isPending ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-5-5l5 5-5 5" />
              </svg>
            )}
          </button>
        </div>

        {showAdvanced ? (
          <div className="agent-advanced-panel">
            <label className="agent-advanced-field">
              <span className="agent-advanced-label">{AGENT_INPUT_TEXT.advancedLabel}</span>
              <select
                className="agent-type-selector"
                value={taskType}
                onChange={(event) => onTaskTypeChange(event.target.value)}
                disabled={isPending || disabled}
              >
                {taskTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="agent-advanced-hint">{AGENT_INPUT_TEXT.advancedHint}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
