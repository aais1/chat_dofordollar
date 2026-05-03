import { useState } from 'react';
import { formatMessageTime } from '../../utils/time.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { Check, CheckCheck, MoreVertical, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api.js';

export default function MessageBubble({ msg }) {
  const { user } = useAuth();
  const { emit, isConnected } = useSocket();
  const [showOptions, setShowOptions] = useState(false);
  const [dbgAction, setDbgAction] = useState(null);
  const isMine = msg.senderId === user.id;
  const isAdmin = user.role === 'admin';

  const handleDelete = () => {
    // Proceed immediately without a blocking browser confirm dialog
    const toastId = toast.loading('Deleting...');

    emit('delete-message', { messageId: msg.id, chatId: msg.chatId }, async (res) => {
      try {
        if (res?.success) {
          toast.success('Message deleted', { id: toastId });
          setDbgAction('deleted via socket');
        } else if (res?.error) {
          toast.error(res.error + ' — trying HTTP fallback', { id: toastId });
          setDbgAction('socket error, falling back');
          // Fallback to REST API
          try {
            await api.delete(`/chats/messages/${msg.id}`);
            toast.success('Message deleted (via HTTP)', { id: toastId });
            setDbgAction('deleted via HTTP');
          } catch (err) {
            toast.error('Failed to delete message', { id: toastId });
          }
        } else {
          // No ack received, try HTTP fallback
          setDbgAction('no ack, falling back');
          try {
            await api.delete(`/chats/messages/${msg.id}`);
            toast.success('Message deleted (via HTTP)', { id: toastId });
            setDbgAction('deleted via HTTP');
          } catch (err) {
            toast.error('Failed to delete message', { id: toastId });
          }
        }
      } catch (err) {
        toast.error('Failed to delete message', { id: toastId });
      }
    });

    setShowOptions(false);
  };

  const ReadReceipt = () => {
    if (!isMine) return null;
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
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1.5 msg-slide-in group relative`}>
      <div className={`
        relative max-w-[75%] min-w-[64px] px-2.5 py-1.5 rounded-2xl shadow-sm transition-all
        ${isMine
          ? 'user-bubble rounded-br-sm text-black dark:text-gray-100'
          : 'admin-bubble dark:bg-[#1F2C34] rounded-bl-sm text-black dark:text-gray-100'}
      `}>
        {isAdmin && (
          <div className="absolute top-1 right-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 touch-manipulation"
              aria-label="Message options"
            >
              <MoreVertical size={16} />
            </button>

            {showOptions && (
              <div className="absolute right-0 z-[999999]  top-full mt-1 bg-white dark:bg-[#233138] shadow-xl rounded-lg py-1 z-20 border border-gray-100 dark:border-gray-800 min-w-[120px]">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  className="w-full flex relative z-[999999] items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors font-medium"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        )}

        {/* mobile trash and DBG removed per request */}
        <MediaContent />
        
        {msg.content && (
          <p className="text-[14px] leading-[1.4] text-black dark:text-white break-words whitespace-pre-wrap px-0.5 font-normal pr-4">
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
      
      {/* {showOptions && (
        <div 
          className="fixed inset-0 z-[15]" 
          onClick={() => setShowOptions(false)} 
        />
      )} */}
    </div>
  );
}
