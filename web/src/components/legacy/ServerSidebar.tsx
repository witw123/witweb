"use client";

import { useEffect, useState } from "react";
import * as channelService from "@/services/channelService";
import { useAuth } from "@/app/providers";

export type Server = {
  id: number;
  name: string;
  icon_url?: string;
  owner_id?: number;
};

export default function ServerSidebar({
  selectedServerId,
  onSelectServer,
}: {
  selectedServerId: number | null;
  onSelectServer: (server: Server) => void;
}) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerIcon, setNewServerIcon] = useState("");
  const [creating, setCreating] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async (selectNewId?: number) => {
    try {
      setLoading(true);
      const res = await fetch("/api/channels?mode=servers", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      setServers(data);

      if (selectNewId) {
        const newServer = data.find((s: Server) => s.id === selectNewId);
        if (newServer) onSelectServer(newServer);
      } else if (!selectedServerId && data.length > 0) {
        onSelectServer(data[0]);
      }
    } catch (error) {
      console.error("Failed to load servers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onload = (prev) => {
      setNewServerIcon(prev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Actual upload
    try {
      setCreating(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setNewServerIcon(data.url);
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateServer = async () => {
    if (!newServerName.trim()) return;
    try {
      setCreating(true);
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newServerName.trim(),
          icon_url: newServerIcon.trim(),
          type: "server"
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create server");

      setIsModalOpen(false);
      setNewServerName("");
      setNewServerIcon("");
      loadServers(data.id);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading && servers.length === 0) {
    return (
      <aside className="server-sidebar">
        <div className="animate-pulse flex flex-col items-center gap-4 mt-4">
          <div className="w-12 h-12 bg-discord-bg-user rounded-full" />
          <div className="w-12 h-12 bg-discord-bg-user rounded-full" />
        </div>
      </aside>
    );
  }

  return (
    <>
      <aside className="server-sidebar">
        {/* Home / Direct Messages Icon - Discord Logo */}
        <div
          className={`server-icon ${selectedServerId === null ? "!bg-[#0070f3] !rounded-[16px]" : ""} from-system`}
          onClick={() => {
            onSelectServer({ id: -1, name: "个人", icon_url: "" } as any);
          }}
          title="私信"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1892.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.1023.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1569 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z" />
          </svg>
        </div>

        <div className="w-8 h-[2px] bg-discord-interactive-hover rounded-full my-1" />

        {servers.map((server) => {
          const isSystem = server.name === "系统服务器";
          return (
            <div
              key={server.id}
              className={`server-icon ${selectedServerId === server.id ? "active" : ""} ${isSystem ? "system" : ""}`}
              onClick={() => {
                onSelectServer(server);
                // Also update URL to reflect server change
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.set("server_id", server.id.toString());
                  window.history.pushState({}, "", url.toString());
                }
              }}
              title={server.name}
            >
              {isSystem ? (
                <span style={{ fontSize: "22px", fontWeight: "bold" }}>❖</span>
              ) : server.icon_url ? (
                <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover rounded-[inherit]" />
              ) : (
                <span className="font-medium text-sm">{server.name.substring(0, 2)}</span>
              )}
            </div>
          );
        })}

        <div className="w-8 h-[2px] bg-discord-interactive-hover rounded-full my-1" />

        <div
          className="server-icon group hover:bg-green-600 hover:text-white transition-all cursor-pointer"
          onClick={() => setIsModalOpen(true)}
          title="创建服务器"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
          </svg>
        </div>
      </aside>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#313338] w-full max-w-[440px] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">创建一个服务器</h2>
              <p className="text-[#b5bac1] text-sm mb-6">服务器是你与好友交流的地方。创建一个服务器并开始对话吧。</p>

              <div className="flex flex-col items-center mb-6">
                <label className="relative group cursor-pointer">
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                  <div className="w-20 h-20 rounded-full bg-discord-bg-user border-2 border-dashed border-[#b5bac1] flex flex-col items-center justify-center overflow-hidden group-hover:border-white transition-colors">
                    {newServerIcon ? (
                      <img src={newServerIcon} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#b5bac1">
                          <path d="m11 20v-5.586l-2.293 2.293-1.414-1.414 4.707-4.707 4.707 4.707-1.414 1.414-2.293-2.293v5.586zm-7-2h2v2h-2c-1.103 0-2-.897-2-2v-12c0-1.103.897-2 2-2h12c1.103 0 2 .897 2 2v6h-2v-6h-12v12h2v2zm14.5 4c-2.481 0-4.5-2.019-4.5-4.5s2.019-4.5 4.5-4.5 4.5 2.019 4.5 4.5-2.019 4.5-4.5 4.5zm0-7c-1.378 0-2.5 1.122-2.5 2.5s1.122 2.5 2.5 2.5 2.5-1.122 2.5-2.5-1.122-2.5-2.5-2.5z" />
                        </svg>
                        <span className="text-[10px] font-bold text-[#b5bac1] uppercase mt-1">上传</span>
                      </>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-[#5865f2] text-white rounded-full p-2 shadow-lg group-hover:bg-[#4752c4] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
                    </svg>
                  </div>
                </label>
              </div>

              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">服务器名称</label>
                  <input
                    type="text"
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    placeholder="给你的服务器起个名字"
                    className="w-full bg-[#1e1f22] text-[#dbdee1] p-3 rounded border-none outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#2b2d31] p-4 flex justify-between items-center">
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white text-sm hover:underline px-4 py-2"
              >
                取消
              </button>
              <button
                onClick={handleCreateServer}
                disabled={creating || !newServerName.trim()}
                className="bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium px-7 py-2.5 rounded transition-colors disabled:opacity-50"
              >
                {creating ? "提交中..." : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
