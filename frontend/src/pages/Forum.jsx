import { useState } from "react";
import ChannelList from "../components/ChannelList";
import ChannelView from "../components/ChannelView";
import "../styles/channels.css";

export default function Forum() {
  const [selectedChannel, setSelectedChannel] = useState(null);

  return (
    <div className="forum-page">
      <div className="forum-header">
        <h1 className="text-2xl font-bold">讨论区</h1>
        <p className="text-muted">分享创作经验，交流技术心得</p>
      </div>

      <div className="split-layout">
        <aside className="side-panel">
          <div className="card">
            <ChannelList
              selectedChannel={selectedChannel}
              onSelectChannel={setSelectedChannel}
            />
          </div>
        </aside>

        <section className="forum-main">
          {selectedChannel ? (
            <ChannelView channelId={selectedChannel} />
          ) : (
            <div className="empty-state">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium mb-2">欢迎来到讨论区</h3>
                <p className="text-muted">请选择左侧频道开始讨论</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
