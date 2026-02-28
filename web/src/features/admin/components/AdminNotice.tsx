"use client";

type AdminNoticeTone = "success" | "error" | "info";

export default function AdminNotice({
  message,
  tone = "info",
}: {
  message: string;
  tone?: AdminNoticeTone;
}) {
  if (!message.trim()) return null;

  return (
    <div className={`admin-notice admin-notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </div>
  );
}
