"use client";

/**
 * 消息中心页面组件
 *
 * 提供完整的消息功能界面，包括：
 * - 私聊会话列表和聊天界面
 * - 通知列表（回复、@、点赞、系统消息）
 * - 消息发送和自动滚动
 *
 * @component
 * @example
 * <MessagesPageContent />
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { useSearchParams } from "next/navigation";
import { getThumbnailUrl, shouldBypassImageOptimization } from "@/utils/url";
import { useConversations, useMessages, useNotifications, useSendMessage } from "../hooks";
import type { TabType } from "../types";

/**
 * 消息头像组件
 *
 * 负责渲染用户头像，支持头像优化和回退显示
 * 使用缩略图以优化加载性能
 *
 * @param src - 头像图片 URL
 * @param alt - 头像替代文本
 */
function MessageAvatar({ src, alt }: { src: string; alt: string }) {
  const avatarSrc = getThumbnailUrl(src, 64);
  const avatarUnoptimized = shouldBypassImageOptimization(avatarSrc);

  return (
    <Image
      src={avatarSrc}
      alt={alt}
      width={40}
      height={40}
      className="w-full h-full object-cover"
      unoptimized={avatarUnoptimized}
    />
  );
}

/**
 * 消息中心页面主组件
 *
 * 整合会话管理、消息展示、通知浏览等功能
 * 根据 activeSidebarTab 切换聊天/通知视图
 */
export default function MessagesPageContent() {
  // 认证状态
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  // URL 查询参数，用于从外部跳转时指定聊天对象
  const searchParams = useSearchParams();
  const targetUsername = searchParams.get("username");
  // 消息输入框内容
  const [inputText, setInputText] = useState("");
  // 当前选中的侧边栏标签页
  const [activeSidebarTab, setActiveSidebarTab] = useState<TabType>("chat");

  // 会话相关状态和操作
  const {
    conversations,
    displayConversations,
    setPendingConv,
    selectedConvId,
    setSelectedConvId,
    loading: convLoading,
    refreshConversations,
  } = useConversations(isAuthenticated, targetUsername);
  const { messages, refreshMessages } = useMessages(isAuthenticated, selectedConvId);
  const {
    notifications,
    loading: notifLoading,
    fetchNotifications,
    markRead,
  } = useNotifications(isAuthenticated);
  const { sendError, setSendError, sendMessage, sending } =
    useSendMessage(isAuthenticated);

  // DOM 引用，用于滚动到聊天底部
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  // 记录上一次选中状态，用于判断是否首次加载或新增消息
  const lastSelectedConvId = useRef<number | null>(null);
  const lastMessagesCount = useRef<number>(0);

  /**
   * 发送消息处理函数
   *
   * 调用 sendMessage hook 发送消息，成功后清空输入框并刷新会话/消息列表
   */
  const handleSend = async () => {
    const result = await sendMessage({
      selectedConvId,
      content: inputText,
      conversations: displayConversations,
    });
    if (!result) return;

      setInputText("");

      if (result.conversation_id) {
        setPendingConv(null);
        setSelectedConvId(result.conversation_id);
        void refreshMessages();
      } else {
        void refreshMessages();
      }
      void refreshConversations();
  };

  // 切换会话时清除之前的发送错误提示
  useEffect(() => {
    if (selectedConvId !== null) {
      setSendError("");
    }
  }, [selectedConvId, setSendError]);

  /**
   * 消息列表滚动控制
   *
   * 监听消息变化，自动滚动到合适位置：
   * - 首次加载会话：滚动到底部
   * - 收到新消息且是本人发送或在底部时：平滑滚动到底部
   * 否则保持当前滚动位置
   */
  useEffect(() => {
    // 无变化则跳过
    if (messages.length === lastMessagesCount.current && selectedConvId === lastSelectedConvId.current) return;

    const isFirstLoad = selectedConvId !== lastSelectedConvId.current;
    const isNewMessage = messages.length > lastMessagesCount.current;
    const lastMsgIsMine = messages.length > 0 && messages[messages.length - 1].sender === user?.username;

    const scrollEl = chatHistoryRef.current;
    const isNearBottom = scrollEl ? (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 100) : true;

    if (isFirstLoad) {
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    } else if (isNewMessage && (lastMsgIsMine || isNearBottom)) {
      if (scrollEl) {
        scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
      }
    }

    lastMessagesCount.current = messages.length;
    lastSelectedConvId.current = selectedConvId;
  }, [messages, selectedConvId, user]);

  /**
   * 通知标签页切换处理
   *
   * 当切换到非聊天标签时，加载对应类型的通知并标记为已读
   */
  useEffect(() => {
    if (activeSidebarTab !== "chat") {
      void fetchNotifications(activeSidebarTab);
      void markRead();
    }
  }, [activeSidebarTab, fetchNotifications, markRead]);

  // 当前选中的会话对象
  const selectedConv = displayConversations.find(c => c.id === selectedConvId);

  return (
    <div className="messages-page-wrapper">
      <div className="messages-sidebar">
        <div className="sidebar-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          消息中心
        </div>
        <div className="sidebar-nav">
          <div
            className={`sidebar-item ${activeSidebarTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveSidebarTab("chat")}
          >
            <span>我的消息</span>
            {conversations.reduce((acc, c) => acc + c.unread_count, 0) > 0 && (
              <span className="sidebar-badge">新</span>
            )}
          </div>
          <div
            className={`sidebar-item ${activeSidebarTab === "replies" ? "active" : ""}`}
            onClick={() => setActiveSidebarTab("replies")}
          >回复我的</div>
          <div
            className={`sidebar-item ${activeSidebarTab === "at" ? "active" : ""}`}
            onClick={() => setActiveSidebarTab("at")}
          >@ 我的</div>
          <div
            className={`sidebar-item ${activeSidebarTab === "likes" ? "active" : ""}`}
            onClick={() => setActiveSidebarTab("likes")}
          >收到的赞</div>
          <div
            className={`sidebar-item ${activeSidebarTab === "system" ? "active" : ""}`}
            onClick={() => setActiveSidebarTab("system")}
          >系统通知</div>
        </div>
      </div>

      <div className="messages-main-view">
        {activeSidebarTab === "chat" ? (
          <>
            <div className="chat-list-pane">
              <div className="chat-list-header">最新消息</div>
              <div className="chat-items-container">
                {displayConversations.length === 0 && !convLoading && (
                  <div className="p-4 text-center text-sm text-zinc-500">暂无消息</div>
                )}
                {displayConversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`chat-item-card ${selectedConvId === conv.id ? "active" : ""}`}
                    onClick={() => setSelectedConvId(conv.id)}
                  >
                    <div className="chat-avatar-box">
                      {conv.other_user.avatar_url ? (
                        <MessageAvatar
                          src={conv.other_user.avatar_url}
                          alt={conv.other_user.nickname || conv.other_user.username}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400">
                          {conv.other_user.nickname[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="chat-info-box">
                      <div className="chat-top-row">
                        <span className="chat-name-text">{conv.other_user.nickname}</span>
                        <span className="chat-time-text">{new Date(conv.last_time).toLocaleDateString()}</span>
                      </div>
                      <div className="chat-msg-preview">{conv.last_message}</div>
                    </div>
                    {conv.unread_count > 0 && selectedConvId !== conv.id && (
                      <div className="sidebar-badge self-center">{conv.unread_count}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="chat-view-pane">
              {authLoading ? (
                <div className="empty-chat-state">加载中...</div>
              ) : selectedConv ? (
                <>
                  <div className="chat-view-header">
                    {selectedConv.other_user.nickname}
                  </div>
                  <div className="chat-history-scroll" ref={chatHistoryRef}>
                    {(messages || []).map(msg => {
                      const isMine = msg.sender === user?.username;
                      return (
                        <div key={msg.id} className={`msg-row ${isMine ? "sent" : "received"}`}>
                          <div className="chat-avatar-box">
                            {isMine ? (
                              user?.avatar_url ? (
                                <MessageAvatar
                                  src={user.avatar_url}
                                  alt={user?.username || "me"}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400 font-bold">{user?.username?.[0]?.toUpperCase()}</div>
                              )
                            ) : (
                              selectedConv.other_user.avatar_url ? (
                                <MessageAvatar
                                  src={selectedConv.other_user.avatar_url}
                                  alt={selectedConv.other_user.nickname || selectedConv.other_user.username}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400 font-bold">{selectedConv.other_user.username[0].toUpperCase()}</div>
                              )
                            )}
                          </div>
                          <div className="msg-content-wrapper">
                            <div className="msg-header-row">
                              {!isMine && <span className="msg-sender-name">{selectedConv.other_user.nickname}</span>}
                              <span className="msg-time-text">{new Date(msg.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div className="msg-content-bubble">
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="chat-input-placeholder">
                    {sendError && <div className="mb-2 text-xs text-red-400">{sendError}</div>}
                    <textarea
                      className="chat-input-textarea"
                      placeholder="发个消息聊聊吧（Enter 发送）"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <div className="chat-footer-actions">
                      <button
                        className="chat-send-action"
                        onClick={handleSend}
                        disabled={!inputText.trim() || sending}
                      >
                        {sending ? "发送中..." : "发送"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-chat-state">
                  选择一个联系人开始聊天
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="notifications-view-pane">
            <div className="notif-header">
              {activeSidebarTab === "replies" && "回复我的"}
              {activeSidebarTab === "likes" && "收到的赞"}
              {activeSidebarTab === "at" && "@ 我的"}
              {activeSidebarTab === "system" && "系统通知"}
            </div>
            <div className="notif-list">
              {notifLoading ? (
                <div className="p-10 text-center text-zinc-500">加载中...</div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center text-zinc-500">暂无内容</div>
              ) : (
                notifications.map((notif, idx) => (
                  <div key={idx} className="notif-item">
                    <div className="notif-avatar">
                      {notif.sender_avatar ? (
                        <MessageAvatar
                          src={notif.sender_avatar}
                          alt={notif.sender_nickname}
                        />
                      ) : (
                        <div className="avatar-fallback">{notif.sender_nickname[0].toUpperCase()}</div>
                      )}
                    </div>
                    <div className="notif-content">
                      <div className="notif-title">
                        <span className="sender-name">{notif.sender_nickname}</span>
                        {activeSidebarTab === "likes" && " 赞了 "}
                        {activeSidebarTab === "replies" && " 评论了 "}
                        {activeSidebarTab === "at" && " 评论了 "}
                        {activeSidebarTab === "system" && " 向您发送了 "}

                        {activeSidebarTab !== "system" ? (
                          <Link href={`/post/${notif.post_slug}`} className="post-link">
                            {notif.post_title}
                          </Link>
                        ) : (
                          <span className="post-link">{notif.post_title}</span>
                        )}

                        {activeSidebarTab === "replies" && " 中回复了你"}
                        {activeSidebarTab === "at" && " 中提到了你"}
                      </div>
                      {notif.content && <div className="notif-text">{notif.content}</div>}
                      <div className="notif-time">{new Date(notif.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
