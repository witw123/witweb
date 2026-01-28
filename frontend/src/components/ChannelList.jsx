import { useState, useEffect } from "react";
import { getThumbnailUrl } from "../utils/url";
import * as channelService from "../services/channelService";

export default function ChannelList({ selectedChannel, onSelectChannel }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const data = await channelService.getChannels();
      setChannels(data);

      // Auto-select first channel if none selected
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
    return <div className="text-muted text-sm">加载中...</div>;
  }

  return (
    <div className="channel-list">
      <h3 className="text-lg font-bold mb-4">讨论频道</h3>
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
