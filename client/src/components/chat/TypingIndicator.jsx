export default function TypingIndicator({ name }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1 items-center admin-bubble dark:bg-[#1F2C34] px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
      {name && <span className="text-xs text-gray-400">{name} is typing...</span>}
    </div>
  );
}
