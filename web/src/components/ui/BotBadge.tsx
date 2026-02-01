export default function BotBadge() {
  return (
    <span className="bg-[#5865F2] text-white text-[10px] px-1.5 py-[1px] rounded-[4px] ml-1.5 align-text-top inline-flex items-center h-[15px] max-h-[15px] leading-none font-medium select-none">
      <span className="mb-[1px]">BOT</span>
      <svg aria-label="Verified Bot" aria-hidden="false" role="img" width="10" height="10" viewBox="0 0 16 15.2" className="ml-0.5 text-white">
        <path d="M7.4,11.17,4.2,8l1.7-1.7L7.4,7.74l6-6L15.1,3.4Z" fill="currentColor" />
      </svg>
    </span>
  );
}
