"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { useSearchParams } from "next/navigation";
import { getThumbnailUrl } from "@/utils/url";
import LegacyLayout from "@/components/LegacyLayout";

interface Conversation {
  id: number;
  last_message: string;
  last_time: string;
  unread_count: number;
  other_user: {
    username: string;
    nickname: string;
    avatar_url: string;
  };
}

interface PrivateMessage {
  id: number;
  sender: string;
  content: string;
  created_at: string;
}

interface Notification {
  id?: number;
  sender: string;
  sender_nickname: string;
  sender_avatar: string;
  content?: string;
  created_at: string;
  post_title: string;
  post_slug: string;
}

type TabType = "chat" | "replies" | "at" | "likes" | "system";

function MessagesContent() {
  const { token, user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const targetUsername = searchParams.get("username");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [convLoading, setConvLoading] = useState(true);
  const [pendingConv, setPendingConv] = useState<Conversation | null>(null);

  const [activeSidebarTab, setActiveSidebarTab] = useState<TabType>("chat");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const fetchConversations = async (autoSelectUsername?: string) => {
    if (!token) return;
    try {
      const res = await fetch("/api/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!Array.isArray(data)) {
        setConversations([]);
        return;
      }

      if (autoSelectUsername && !pendingConv) {
        const found = data.find((c: any) => c.other_user.username === autoSelectUsername);
        if (found) {
          setSelectedConvId(found.id);
        } else {
          try {
            const profileRes = await fetch(`/api/users/${encodeURIComponent(autoSelectUsername)}/profile`);
            const profile = await profileRes.json();
            if (profile && !profile.detail && profile.username) {
              const tempConv: Conversation = {
                id: -1,
                last_message: "点击此处开始发送第一条消息吧",
                last_time: new Date().toISOString(),
                unread_count: 0,
                other_user: {
                  username: profile.username,
                  nickname: profile.nickname || profile.username,
                  avatar_url: profile.avatar_url || ""
                }
              };
              setPendingConv(tempConv);
              setSelectedConvId(-1);
            }
          } catch (err) { }
        }
      }

      setConversations(data);
    } catch (err) { }
    setConvLoading(false);
  };

  const fetchNotifications = async (type: string) => {
    if (!token) return;
    setNotifLoading(true);
    try {
      const res = await fetch(`/api/messages/notifications?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  const fetchMessages = async (id: number) => {
    if (!token) return;
    if (id === -1) {
      setMessages([]);
      return;
    }
    try {
      const res = await fetch(`/api/messages/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessages([]);
    }
  };

  const handleSend = async () => {
    if (!token || !inputText.trim() || selectedConvId === null) return;

    const conv = displayConversations.find(c => c.id === selectedConvId);
    if (!conv) return;

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          receiver: conv.other_user.username,
          content: inputText
        })
      });
      const resData = await res.json();
      setInputText("");

      if (resData.conversation_id) {
        setPendingConv(null); // Becomes a real conversation now
        setSelectedConvId(resData.conversation_id);
        fetchMessages(resData.conversation_id);
      } else {
        fetchMessages(selectedConvId);
      }
      fetchConversations();
    } catch (err) { }
  };

  useEffect(() => {
    fetchConversations(targetUsername || undefined);
    const interval = setInterval(() => fetchConversations(), 10000);
    return () => clearInterval(interval);
  }, [token, targetUsername]);

  // Merge pending conversation into the list for display
  const displayConversations = [...conversations];
  if (pendingConv && !conversations.find(c => c.other_user.username === pendingConv.other_user.username)) {
    displayConversations.unshift(pendingConv);
  }

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
      const interval = setInterval(() => fetchMessages(selectedConvId), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedConvId, token]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const lastSelectedConvId = useRef<number | null>(null);
  const lastMessagesCount = useRef<number>(0);

  // ... fetchConversations unchanged ...

  useEffect(() => {
    // Only scroll if messages changed
    if (messages.length === lastMessagesCount.current && selectedConvId === lastSelectedConvId.current) return;

    const isFirstLoad = selectedConvId !== lastSelectedConvId.current;
    const isNewMessage = messages.length > lastMessagesCount.current;
    const lastMsgIsMine = messages.length > 0 && messages[messages.length - 1].sender === user?.username;

    // Check if user is near bottom
    const scrollEl = chatHistoryRef.current;
    const isNearBottom = scrollEl ? (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 100) : true;

    if (isFirstLoad) {
      // Instant scroll on first load
      chatEndRef.current?.scrollIntoView({ behavior: "auto" });
    } else if (isNewMessage && (lastMsgIsMine || isNearBottom)) {
      // Smooth scroll if I sent it or already at bottom
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    lastMessagesCount.current = messages.length;
    lastSelectedConvId.current = selectedConvId;
  }, [messages, selectedConvId, user]);

  useEffect(() => {
    if (activeSidebarTab !== "chat") {
      fetchNotifications(activeSidebarTab);
      // Mark as read when entering any notification tab
      fetch("/api/messages/read-notifications", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => { });
    }
  }, [activeSidebarTab, token]);

  const selectedConv = displayConversations.find(c => c.id === selectedConvId);

  return (
    <div className="messages-page-wrapper">
      {/* Sidebar */}
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
              <span className="sidebar-badge">new</span>
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

      {/* Main Interface */}
      <div className="messages-main-view">
        {activeSidebarTab === "chat" ? (
          <>
            {/* Contacts List */}
            <div className="chat-list-pane">
              <div className="chat-list-header">近期消息</div>
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
                        <img src={getThumbnailUrl(conv.other_user.avatar_url, 64)} alt="" />
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

            {/* Chat View */}
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
                              user?.avatar_url ? <img src={getThumbnailUrl(user.avatar_url, 64)} alt="" /> :
                                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400 font-bold">{user?.username?.[0]?.toUpperCase()}</div>
                            ) : (
                              selectedConv.other_user.avatar_url ? <img src={getThumbnailUrl(selectedConv.other_user.avatar_url, 64)} alt="" /> :
                                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400 font-bold">{selectedConv.other_user.username[0].toUpperCase()}</div>
                            )}
                          </div>
                          <div className="msg-content-wrapper">
                            <div className="msg-header-row">
                              {!isMine && <span className="msg-sender-name">{selectedConv.other_user.nickname}</span>}
                              <span className="msg-time-text">{new Date(msg.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
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
                    <textarea
                      className="chat-input-textarea"
                      placeholder="发个消息聊聊吧~ (Enter 发送)"
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
                        disabled={!inputText.trim()}
                      >
                        发送
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
                        <img src={getThumbnailUrl(notif.sender_avatar, 64)} alt="" />
                      ) : (
                        <div className="avatar-fallback">{notif.sender_nickname[0].toUpperCase()}</div>
                      )}
                    </div>
                    <div className="notif-content">
                      <div className="notif-title">
                        <span className="sender-name">{notif.sender_nickname}</span>
                        {activeSidebarTab === "likes" && " 点赞了您的文章 "}
                        {activeSidebarTab === "replies" && " 在文章 "}
                        {activeSidebarTab === "at" && " 在文章 "}
                        {activeSidebarTab === "system" && " 向您发送了 "}

                        {activeSidebarTab !== "system" ? (
                          <Link href={`/p/${notif.post_slug}`} className="post-link">《{notif.post_title}》</Link>
                        ) : (
                          <span className="post-link">{notif.post_title}</span>
                        )}

                        {activeSidebarTab === "replies" && " 中回复了您"}
                        {activeSidebarTab === "at" && " 中提及了您"}
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

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-zinc-500">加载中...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
