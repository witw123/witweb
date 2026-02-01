
import { useState, useEffect } from "react";
import * as channelService from "@/services/channelService";

type CreateChannelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string | null;
  serverId: number;
  categoryId: number;
  categoryName: string;
};

export default function CreateChannelModal({
  isOpen,
  onClose,
  onSuccess,
  token,
  serverId,
  categoryId,
  categoryName
}: CreateChannelModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setError("");
      setLoading(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      setError("");
      await channelService.createChannel(
        name.trim(),
        description.trim(),
        serverId,
        categoryId,
        token
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#313338] rounded-md shadow-lg overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-4 py-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-discord-text-header uppercase">创建频道</h3>
          <button onClick={onClose} className="text-discord-text-muted hover:text-discord-text-header">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Subheader */}
        <div className="px-4 pb-2 text-xs text-discord-text-muted">
          属于 <span className="font-bold text-discord-text-header">{categoryName || "未分类"}</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">

            {/* Input - Name */}
            <div>
              <label className="block text-xs font-bold text-discord-text-muted uppercase mb-2">
                频道名称
              </label>
              <div className="flex items-center bg-[#1e1f22] rounded overflow-hidden p-1">
                <span className="pl-2 text-discord-text-muted text-lg">#</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                  placeholder="new-channel"
                  className="flex-1 bg-transparent border-none text-discord-text-header p-2 focus:outline-none placeholder-zinc-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Input - Description (Optional) */}
            <div>
              <label className="block text-xs font-bold text-discord-text-muted uppercase mb-2">
                描述 (可选)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="这个频道是关于什么的？"
                className="w-full bg-[#1e1f22] border-none rounded text-discord-text-header p-2 focus:outline-none placeholder-zinc-500"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 font-medium">
                Error: {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-[#2b2d31] px-4 py-3 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white hover:underline"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className={`px-6 py-2 text-sm font-medium text-white bg-[#5865F2] hover:bg-[#4752C4] rounded transition-colors ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {loading ? "创建中..." : "创建频道"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
