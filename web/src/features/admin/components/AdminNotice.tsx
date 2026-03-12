/**
 * AdminNotice - 管理后台通知提示组件
 *
 * 显示成功、错误或信息类型的通知提示。
 * 根据 tone 属性应用不同的样式。
 *
 * @component
 * @param {object} props - 组件属性
 * @param {string} props.message - 通知消息内容
 * @param {"success" | "error" | "info"} [props.tone="info"] - 通知类型
 * @example
 * <AdminNotice message="操作成功" tone="success" />
 */
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
