import { Channel, Message, MessageStatus, Category } from "@/types/chat";

const STORAGE_KEYS = {
  MESSAGES: "witweb_chat_messages_v6",
  DRAFTS: "witweb_chat_drafts_v6",
  CHANNELS: "witweb_chat_channels_v6", // Optional if we want to dynamic channels later
};

// Initial Categories (Default)
const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "cat_text",
    name: "文字频道",
    channels: [
      {
        id: "sys_announcements",
        name: "系统公告",
        description: "官方系统公告与维护通知",
        type: "text",
        readOnly: true,
        categoryId: "cat_text"
      },
      {
        id: "gen_general",
        name: "综合",
        description: "全球加密综合讨论频道",
        type: "text",
        readOnly: false,
        categoryId: "cat_text"
      },
    ],
  },
  {
    id: "cat_voice",
    name: "语音频道",
    channels: [
      {
        id: "voice_lounge",
        name: "休闲酒馆",
        description: "甚至可以听到酒杯的碰撞声",
        type: "voice",
        readOnly: false,
        categoryId: "cat_voice"
      },
      {
        id: "voice_gaming",
        name: "游戏开黑",
        description: "FPS 游戏专用语音",
        type: "voice",
        readOnly: false,
        categoryId: "cat_voice"
      }
    ],
  },
];

const INITIAL_MESSAGES: Message[] = [];

// Helper to simulate delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockChatService {
  private messages: Record<string, Message[]> = {};
  private drafts: Record<string, string> = {};
  private categories: Category[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      this.loadFromStorage();
    } else {
      // Server-side / SSR fallback
      this.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
  }

  private loadFromStorage() {
    try {
      const storedMsgs = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      const storedDrafts = localStorage.getItem(STORAGE_KEYS.DRAFTS);
      const storedChannels = localStorage.getItem(STORAGE_KEYS.CHANNELS);

      if (storedMsgs) {
        this.messages = JSON.parse(storedMsgs);
      } else {
        // Seed initial messages
        INITIAL_MESSAGES.forEach(msg => {
          if (!this.messages[msg.channelId]) this.messages[msg.channelId] = [];
          this.messages[msg.channelId].push(msg);
        });
        this.saveMessages();
      }

      if (storedDrafts) {
        this.drafts = JSON.parse(storedDrafts);
      }

      if (storedChannels) {
        this.categories = JSON.parse(storedChannels);
      } else {
        this.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        this.saveCategories();
      }

    } catch (e) {
      console.error("Failed to load chat storage", e);
      // Fallback
      this.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
  }

  private saveMessages() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(this.messages));
    }
  }

  private saveDrafts() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(this.drafts));
    }
  }

  private saveCategories() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(this.categories));
    }
  }

  async getCategories(): Promise<Category[]> {
    await delay(300);
    return this.categories;
  }

  // --- Admin Channel Management ---

  async createChannel(categoryId: string, name: string, description: string, readOnly: boolean = false, type: "text" | "voice" = "text"): Promise<Channel> {
    await delay(300);
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) throw new Error("Category not found");

    const newChannel: Channel = {
      id: "chan_" + Date.now(),
      name,
      description,
      type,
      readOnly,
      categoryId
    };

    category.channels.push(newChannel);
    this.saveCategories();
    return newChannel;
  }

  async updateChannel(channelId: string, updates: { name?: string; description?: string; readOnly?: boolean }): Promise<Channel> {
    await delay(300);
    let targetChannel: Channel | undefined;

    for (const cat of this.categories) {
      const ch = cat.channels.find(c => c.id === channelId);
      if (ch) {
        if (updates.name) ch.name = updates.name;
        if (updates.description !== undefined) ch.description = updates.description;
        if (updates.readOnly !== undefined) ch.readOnly = updates.readOnly;
        targetChannel = ch;
        break;
      }
    }

    if (!targetChannel) throw new Error("Channel not found");
    this.saveCategories();
    return targetChannel;
  }

  async deleteChannel(channelId: string): Promise<void> {
    await delay(300);
    let found = false;

    // Prevent deleting the very last channel or system channels if needed
    // For now, allow deleting anything except system announcements maybe?

    for (const cat of this.categories) {
      const idx = cat.channels.findIndex(c => c.id === channelId);
      if (idx !== -1) {
        if (idx !== -1) {
          // Allow deleting any channel, including system ones
          cat.channels.splice(idx, 1);
          found = true;
          break;
        }
      }
    }

    if (!found) throw new Error("Channel not found");
    this.saveCategories();
  }

  // --- End Admin Management ---

  async getMessages(channelId: string): Promise<Message[]> {
    await delay(300);
    return this.messages[channelId] || [];
  }

  async sendMessage(channelId: string, content: string, profile: any): Promise<Message> {
    const newMessage: Message = {
      id: "msg_" + Date.now() + Math.random().toString(36).substr(2, 9),
      channelId,
      authorId: profile.username || profile.id || "guest",
      authorName: profile.nickname || profile.username || "Guest",
      authorAvatar: profile.avatar_url || "",
      content,
      createdAt: Date.now(),
      type: "user",
      status: "sending",
    };

    // Optimistic: We don't save to DB yet, but we return it to UI
    // The UI handles adding it to the list immediately.

    // Simulate network
    await delay(Math.random() * 600 + 600); // 600-1200ms

    // 10% failure chance
    if (Math.random() < 0.1) {
      throw new Error("Failed to send message (Simulated Network Error)");
    }

    // Success
    newMessage.status = "sent";

    // Save to "DB"
    if (!this.messages[channelId]) this.messages[channelId] = [];
    this.messages[channelId].push(newMessage);
    this.saveMessages();

    return newMessage;
  }

  saveDraft(channelId: string, content: string) {
    this.drafts[channelId] = content;
    this.saveDrafts();
  }

  getDraft(channelId: string): string {
    return this.drafts[channelId] || "";
  }

  // For Search (Local only for now)
  searchMessages(query: string, channelId?: string): Message[] {
    const results: Message[] = [];
    const targetChannels = channelId ? [channelId] : Object.keys(this.messages);

    targetChannels.forEach(cid => {
      const msgs = this.messages[cid] || [];
      msgs.forEach(m => {
        if (m.content.toLowerCase().includes(query.toLowerCase())) {
          results.push(m);
        }
      });
    });

    return results.sort((a, b) => b.createdAt - a.createdAt);
  }
  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    const list = this.messages[channelId] || [];
    this.messages[channelId] = list.filter(m => m.id !== messageId);
    this.saveMessages();
  }

  async editMessage(channelId: string, messageId: string, newContent: string): Promise<Message> {
    const list = this.messages[channelId] || [];
    const msg = list.find(m => m.id === messageId);
    if (!msg) throw new Error("Message not found");

    msg.content = newContent;
    // can add editedAt if type supported
    this.saveMessages();
    return msg;
  }
}

export const chatService = new MockChatService();
