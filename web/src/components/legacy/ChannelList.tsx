"use client";

import { useEffect, useState } from "react";
import * as channelService from "@/services/channelService";

type Channel = {
  id: string | number;
  name: string;
  description?: string;
  message_count?: number;
};

export default function ChannelList({
  selectedChannel,
  onSelectChannel,
}: {
  selectedChannel: string | number | null;
  onSelectChannel: (id: string | number) => void;
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const isAdmin = profile?.username === (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const loadAuth = () => {
    if (typeof window === "undefined") return;
    const storedToken = localStorage.getItem("token");
    const storedProfile = localStorage.getItem("profile");
    let nextProfile: any = null;
    if (storedProfile) {
      try {
        nextProfile = JSON.parse(storedProfile);
      } catch {
        nextProfile = null;
      }
    }
    setToken(storedToken);
    setProfile(nextProfile);
  };

  useEffect(() => {
    loadAuth();
    loadChannels();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      loadAuth();
      loadChannels();
    };
    window.addEventListener("profile-updated", handler as EventListener);
    window.addEventListener("storage", handler as EventListener);
    return () => {
      window.removeEventListener("profile-updated", handler as EventListener);
      window.removeEventListener("storage", handler as EventListener);
    };
  }, []);

  const handleCreate = async () => {
    const name = newChannelName.trim();
    if (!name || creating) return;
    try {
      setCreating(true);
      await channelService.createChannel(name, newChannelDesc.trim(), token);
      setNewChannelName("");
      setNewChannelDesc("");
      await loadChannels();
    } catch (error: any) {
      alert(error.message || "\u521b\u5efa\u5931\u8d25");
    } finally {
      setCreating(false);
    }
  };

  const loadChannels = async () => {
    try {
      setLoading(true);
      const data = await channelService.getChannels();
      setChannels(data);

      if (!selectedChannel && data.length > 0) {
        onSelectChannel(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load channels:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="channel-list">
      <h3 className="text-lg font-bold mb-4">讨论频道</h3>
      {isAdmin && (
        <div className="card p-4 mb-4">
          <div className="text-sm font-medium mb-2">{"\u6dfb\u52a0\u9891\u9053"}</div>
          <input
            className="input mb-2"
            placeholder={"\u9891\u9053\u540d\u79f0"}
            value={newChannelName}
            onChange={(event) => setNewChannelName(event.target.value)}
          />
          <textarea
            className="input mb-2"
            placeholder={"\u9891\u9053\u63cf\u8ff0\uff08\u53ef\u9009\uff09"}
            value={newChannelDesc}
            onChange={(event) => setNewChannelDesc(event.target.value)}
          />
          <button
            className="btn-primary w-full justify-center"
            type="button"
            onClick={handleCreate}
            disabled={creating || !newChannelName.trim()}
          >
            {creating ? "\u521b\u5efa\u4e2d..." : "\u521b\u5efa\u9891\u9053"}
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel.id)}
            className={`channel-item ${selectedChannel === channel.id ? "active" : ""}`}
          >
            <div className="channel-name font-medium">{channel.name}</div>
            <div className="channel-desc text-xs text-muted">{channel.description}</div>
            <div className="channel-count text-xs text-muted mt-1">
              {channel.message_count} 条消息
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

