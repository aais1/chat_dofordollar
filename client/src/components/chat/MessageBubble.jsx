import { formatMessageTime } from '../../utils/time.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Check, CheckCheck } from 'lucide-react';

export default function MessageBubble({ msg }) {
  const { user } = useAuth();
  const isMine = msg.senderId === user.id;

  const ReadReceipt = () => {
    if (!isMine) return null;
    // Blue checkmarks for read, gray for delivered/sent
    if (msg.isRead) return <CheckCheck size={14} className="text-blue-500 drop-shadow-sm" />;
    if (msg.isDelivered) return <CheckCheck size={14} className="text-gray-500" />;
    return <Check size={14} className="text-gray-400" />;
  };

  const MediaContent = () => {
    if (msg.messageType === 'image') {
      return (
        <div className="mb-1 rounded-lg overflow-hidden border border-black/5 shadow-inner">
          <img src={msg.mediaUrl} alt="image" onError={e => e.target.style.display='none'}
            className="max-w-[240px] max-h-[320px] object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-300"
            onClick={() => window.open(msg.mediaUrl, '_blank')} />
        </div>
      );
    }
    if (msg.messageType === 'video') {
      return (
        <video src={msg.mediaUrl} controls className="rounded-lg max-w-[240px] max-h-[200px] mb-1 shadow-sm" />
      );
    }
    if (msg.messageType === 'audio') {
      return (
        <audio src={msg.mediaUrl} controls className="max-w-[240px] mb-1 scale-90 origin-left" />
      );
    }
    return null;
  };

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1.5 msg-slide-in group`}>
      <div className={`
        relative max-w-[75%] min-w-[64px] px-2.5 py-1.5 rounded-2xl shadow-sm transition-all
        ${isMine
          ? 'user-bubble rounded-br-sm text-black dark:text-gray-100' // Dark text for light green, light text for dark green
          : 'admin-bubble dark:bg-[#1F2C34] rounded-bl-sm text-black dark:text-gray-100'}
      `}>
        {/* Subtle tail effect placeholder or just rounded corners */}
        <MediaContent />
        
        {msg.content && (
          <p className="text-[14px] leading-[1.4] text-black dark:text-white break-words whitespace-pre-wrap px-0.5 font-normal">
            {msg.content}
          </p>
        )}
        
        <div className={`flex items-center gap-1.5 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] font-medium opacity-60 uppercase tracking-tighter">
            {formatMessageTime(msg.createdAt)}
          </span>
          <ReadReceipt />
        </div>
      </div>
    </div>
  );
}
