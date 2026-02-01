
import { useEffect, useRef } from "react";
import { Server } from "./ServerSidebar";

type ServerDropdownProps = {
  server: Server;
  isOpen: boolean;
  onClose: () => void;
  onInvite: () => void;
  onSettings: () => void;
  onCreateChannel: () => void;
  onLeave: () => void;
  isOwner: boolean;
};

export default function ServerDropdown({
  server,
  isOpen,
  onClose,
  onInvite,
  onSettings,
  onCreateChannel,
  onLeave,
  isOwner,
}: ServerDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className="absolute top-[50px] left-[10px] w-[220px] bg-[#111214] rounded-md shadow-2xl z-50 overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-100 border border-[#1e1f22]"
    >
      <div className="px-2 space-y-[2px]">
        <MenuItem
          label="邀请好友"
          onClick={onInvite}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#949cf7] group-hover:text-white">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" x2="20" y1="8" y2="14" />
              <line x1="23" x2="17" y1="11" y2="11" />
            </svg>
          }
        />

        {isOwner && (
          <>
            <MenuItem
              label="服务器设置"
              onClick={onSettings}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#b5bac1] group-hover:text-white">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              }
            />
            <MenuItem
              label="创建频道"
              onClick={onCreateChannel}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#b5bac1] group-hover:text-white">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="16" />
                  <line x1="8" x2="16" y1="12" y2="12" />
                </svg>
              }
            />
          </>
        )}

        <div className="h-[1px] bg-[#1f2023] my-1 mx-2" />

        <MenuItem
          label="离开服务器"
          onClick={onLeave}
          textColor="text-[#fa777c] group-hover:text-white"
          hoverBg="group-hover:bg-[#da373c]"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#fa777c] group-hover:text-white">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          }
        />
      </div>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  icon,
  textColor = "text-[#b5bac1] group-hover:text-white",
  hoverBg = "group-hover:bg-[#4752c4]"
}: any) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`w-full text-left px-2 py-1.5 rounded-[2px] flex items-center justify-between group cursor-pointer hover:bg-[#4752c4] ${hoverBg} transition-colors`}
    >
      <span className={`text-sm font-medium ${textColor}`}>
        {label}
      </span>
      {icon}
    </button>
  )
}
