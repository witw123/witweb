import { useState, useEffect, useRef } from "react";
import { getThumbnailUrl } from "../utils/url";
import * as channelService from "../services/channelService";

export default function ChannelView({ channelId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const token = localStorage.getItem("token");
  const profile = JSON.parse(localStorage.getItem("profile") || "{}");

  // Auto-refresh messages every 10 seconds
  useEffect(() => {
    if (!channelId) return;

    loadMessages();
    const interval = setInterval(() => {
      loadMessages(true); // Silent refresh
    }, 10000);

    return () => clearInterval(interval);
  }, [channelId]);

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await channelService.getMessages(channelId);
      setMessages(data.reverse()); // Reverse to show oldest first

      // Scroll to bottom on first load
      if (!silent) {
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !token) return;

    try {
      setSending(true);
      const message = await channelService.postMessage(channelId, newMessage.trim());
      setMessages([...messages, message]);
      setNewMessage("");

      // Scroll to bottom after sending
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      alert(error.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId) => {
    if (!confirm("确定要删除这条消息吗？")) return;

    try {
      await channelService.deleteMessage(messageId);
      setMessages(messages.filter((m) => m.id !== messageId));
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted">加载中...</div>;
  }

  return (
    <div className="channel-view">
      <div className="messages-container" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted">暂无消息，发送第一条消息吧！</div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="message-item">
              <div className="message-header">
                <div className="flex items-center gap-2">
                  {message.user_avatar ? (
                    <img
                      src={getThumbnailUrl(message.user_avatar, 64)}
                      alt={message.username}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="avatar-fallback w-8 h-8 flex items-center justify-center rounded-full bg-secondary text-xs">
                      {message.username?.[0] || "U"}
                    </div>
                  )}
                  <span className="font-medium text-sm">{message.username}</span>
                  <span className="text-xs text-muted">
                    {new Date(message.created_at).toLocaleString()}
                  </span>
                </div>
                {profile.username === "witw" && (
                  <button
                    onClick={() => handleDelete(message.id)}
                    className="btn-ghost btn-sm text-accent"
                  >
                    删除
                  </button>
                )}
              </div>
              <div className="message-content">{message.content}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {token ? (
        <form onSubmit={handleSend} className="message-input-form">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
            className="message-input"
            rows="3"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="btn-primary"
          >
            {sending ? "发送中..." : "发送"}
          </button>
        </form>
      ) : (
        <div className="text-center py-4 text-muted">
          请先<a href="/login" className="text-accent">登录</a>后发言
        </div>
      )}
    </div>
  );
}
