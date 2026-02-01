"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Message, Channel, Category, ChatState } from "@/types/chat";
import { chatService } from "@/services/mockChatService";
import { useAuth } from "@/app/providers";

interface ChatContextProps extends ChatState {
  setActiveChannel: (channelId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  setDraft: (content: string) => void;
  // Channel Management (Restored)
  createChannel: (categoryId: string, name: string, description: string, readOnly: boolean, type: "text" | "voice") => Promise<void>;
  updateChannel: (channelId: string, updates: { name?: string; description?: string; readOnly?: boolean }) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  categories: Category[];
  userProfile: any;
  isAdmin: boolean;
}

const ChatContext = createContext<ChatContextProps | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token, loading: authLoading, user } = useAuth(); // using user from AuthProvider
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>("gen_general");
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Simple admin check: if username is 'witw'
  const isAdmin = userProfile?.username === "witw";

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    const init = async () => {
      try {
        const cats = await chatService.getCategories();
        setCategories(cats);

        const msgs = await chatService.getMessages(activeChannelId);
        setMessages(prev => ({ ...prev, [activeChannelId]: msgs }));

        const initialDraft = chatService.getDraft(activeChannelId);
        setDrafts(prev => ({ ...prev, [activeChannelId]: initialDraft }));

        if (token) {
          try {
            const res = await fetch("/api/profile", {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.ok && data.profile) {
                setUserProfile(data.profile);
              }
            }
          } catch (e) {
            console.error("Failed to fetch profile", e);
          }
        }
      } catch (err) {
        console.error("Chat init failed", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [authLoading, token]);

  useEffect(() => {
    if (!activeChannelId) return;
    const loadChannelData = async () => {
      const msgs = await chatService.getMessages(activeChannelId);
      setMessages(prev => ({ ...prev, [activeChannelId]: msgs }));
      const draft = chatService.getDraft(activeChannelId);
      setDrafts(prev => ({ ...prev, [activeChannelId]: draft }));
    };
    loadChannelData();
  }, [activeChannelId]);

  const handleSetActiveChannel = (id: string) => {
    setActiveChannelId(id);
  };

  const handleSetDraft = (content: string) => {
    setDrafts(prev => ({ ...prev, [activeChannelId]: content }));
    chatService.saveDraft(activeChannelId, content);
  };

  const handleSendMessage = async (content: string) => {
    // Determine Identity: If Admin in System Channel, force System identity
    let profile = userProfile || { id: "guest", username: "Guest", nickname: "Guest" };

    // Force system identity for admins in sys_announcements
    if (activeChannelId === "sys_announcements" && isAdmin) {
      profile = {
        id: "system",
        username: "System",
        nickname: "System",
        avatar_url: null
      };
    }

    const tempId = "temp_" + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      channelId: activeChannelId,
      authorId: profile.username || profile.id || "guest",
      authorName: profile.nickname || profile.username || "Guest",
      authorAvatar: profile.avatar_url,
      content,
      createdAt: Date.now(),
      type: isAdmin && activeChannelId === "sys_announcements" ? "system" : "user",
      status: "sending"
    };

    setMessages(prev => ({
      ...prev,
      [activeChannelId]: [...(prev[activeChannelId] || []), optimisticMsg]
    }));
    handleSetDraft("");

    try {
      const sentMsg = await chatService.sendMessage(activeChannelId, content, profile);
      setMessages(prev => {
        const list = prev[activeChannelId] || [];
        return {
          ...prev,
          [activeChannelId]: list.map(m => m.id === tempId ? sentMsg : m)
        };
      });
    } catch (e) {
      setMessages(prev => {
        const list = prev[activeChannelId] || [];
        return {
          ...prev,
          [activeChannelId]: list.map(m => m.id === tempId ? { ...m, status: "failed" } : m)
        };
      });
    }
  };

  const handleRetryMessage = async (oldMsgId: string) => {
    const list = messages[activeChannelId] || [];
    const targetMsg = list.find(m => m.id === oldMsgId);
    if (!targetMsg) return;

    // Reset status to sending
    setMessages(prev => ({
      ...prev,
      [activeChannelId]: list.map(m => m.id === oldMsgId ? { ...m, status: "sending" } : m)
    }));

    try {
      const sentMsg = await chatService.sendMessage(activeChannelId, targetMsg.content, userProfile);
      setMessages(prev => ({
        ...prev,
        [activeChannelId]: prev[activeChannelId].map(m => m.id === oldMsgId ? sentMsg : m)
      }));
    } catch {
      setMessages(prev => ({
        ...prev,
        [activeChannelId]: prev[activeChannelId].map(m => m.id === oldMsgId ? { ...m, status: "failed" } : m)
      }));
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Optimistic delete
    const oldList = messages[activeChannelId] || [];
    setMessages(prev => ({
      ...prev,
      [activeChannelId]: prev[activeChannelId].filter(m => m.id !== messageId)
    }));

    try {
      await chatService.deleteMessage(activeChannelId, messageId);
    } catch (e) {
      console.error("Failed to delete", e);
      // Rollback
      setMessages(prev => ({
        ...prev,
        [activeChannelId]: oldList
      }));
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    // Optimistic edit
    const oldList = messages[activeChannelId] || [];
    setMessages(prev => ({
      ...prev,
      [activeChannelId]: prev[activeChannelId].map(m => m.id === messageId ? { ...m, content: newContent } : m)
    }));

    try {
      await chatService.editMessage(activeChannelId, messageId, newContent);
    } catch (e) {
      console.error("Failed to edit", e);
      // Rollback
      setMessages(prev => ({
        ...prev,
        [activeChannelId]: oldList
      }));
    }
  };

  // --- Channel Management Handlers ---

  const reloadCategories = async () => {
    const cats = await chatService.getCategories();
    setCategories(cats);
  };

  const handleCreateChannel = async (categoryId: string, name: string, description: string, readOnly: boolean, type: "text" | "voice") => {
    await chatService.createChannel(categoryId, name, description, readOnly, type);
    await reloadCategories();
  };

  const handleUpdateChannel = async (channelId: string, updates: { name?: string; description?: string; readOnly?: boolean }) => {
    await chatService.updateChannel(channelId, updates);
    await reloadCategories();
  };

  const handleDeleteChannel = async (channelId: string) => {
    await chatService.deleteChannel(channelId);
    const newCats = await chatService.getCategories();
    setCategories(newCats);

    // If active channel deleted, switch to first available
    if (activeChannelId === channelId) {
      const firstChan = newCats.flatMap(c => c.channels)[0];
      setActiveChannelId(firstChan ? firstChan.id : "");
    }
  };

  const flattenChannels = categories.flatMap(c => c.channels);

  return (
    <ChatContext.Provider
      value={{
        activeChannelId,
        channels: flattenChannels,
        categories,
        messages,
        drafts,
        isLoading,
        userProfile,
        isAdmin,
        setActiveChannel: handleSetActiveChannel,
        sendMessage: handleSendMessage,
        retryMessage: handleRetryMessage,
        deleteMessage: handleDeleteMessage,
        editMessage: handleEditMessage,
        setDraft: handleSetDraft,
        // Channel Management
        createChannel: handleCreateChannel,
        updateChannel: handleUpdateChannel,
        deleteChannel: handleDeleteChannel
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
