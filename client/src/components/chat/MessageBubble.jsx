import { useState, useRef, useEffect, useCallback } from 'react';
import { formatMessageTime } from '../../utils/time.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { Check, CheckCheck, MoreVertical, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api.js';

/**
 * MessageBubble
 *
 * Read-receipt rules (WhatsApp-style):
 *   ✓  (single gray)   — sent, not yet delivered (receiver offline)
 *   ✓✓ (double gray)   — delivered (receiver connected), not yet read
 *   ✓✓ (double blue)   — receiver has scrolled this message into their viewport
 *
 * `isRead` is ONLY set server-side when the receiver emits `message-read`
 * which is triggered here by IntersectionObserver once the message element
 * enters the scroll container's visible area.
 *
 * Props:
 *   msg           — message object from state
 *   root          — React ref to the scroll container (required for observer)
 */
export default function MessageBubble({ msg, root }) {
  const { user } = useAuth();
  const { emit } = useSocket();
  const [showOptions, setShowOptions] = useState(false);
  const isMine = msg.senderId === user.id;
  const isAdmin = user.role === 'admin';
  const ref = useRef();
  const observedRef = useRef(false); // prevent duplicate observe calls

  // ── Viewport visibility observer ────────────────────────────────────────
  // Only observe messages sent BY the other party that haven't been read yet.
  useEffect(() => {
    // Skip if this is our own message, already read, or already being observed
    if (isMine || msg.isRead || observedRef.current) return;

    const rootEl = root?.current;
    const el = ref.current;
    if (!rootEl || !el) return;

    // Wait for the element to actually be inside the root before observing
    if (!rootEl.contains(el)) return;

    observedRef.current = true;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Fire read receipt to server
            emit('message-read', { chatId: msg.chatId, messageIds: [msg.id] });
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: rootEl,
        rootMargin: '0px',
        threshold: 0.5, // at least 50% visible
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      observedRef.current = false;
    };
  // Re-run only when read status or the root ref changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg.id, msg.isRead, isMine, root]);

  // ── Delete handler (admin only) ─────────────────────────────────────────
  const handleDelete = useCallback(() => {
    const toastId = toast.loading('Deleting...');

    emit('delete-message', { messageId: msg.id, chatId: msg.chatId }, async (res) => {
      try {
        if (res?.success) {
          toast.success('Message deleted', { id: toastId });
        } else {
          const errMsg = res?.error || 'Unknown error';
          toast.error(`${errMsg} — trying HTTP fallback`, { id: toastId });
          try {
            await api.delete(`/chats/messages/${msg.id}`);
            toast.success('Message deleted (via HTTP)', { id: toastId });
          } catch {
            toast.error('Failed to delete message', { id: toastId });
          }
        }
      } catch {
        // No ack
        try {
          await api.delete(`/chats/messages/${msg.id}`);
          toast.success('Message deleted (via HTTP)', { id: toastId });
        } catch {
          toast.error('Failed to delete message', { id: toastId });
        }
      }
    });

    setShowOptions(false);
  }, [msg.id, msg.chatId, emit]);

  // ── Read receipt icon ───────────────────────────────────────────────────
  const ReadReceipt = () => {
    if (!isMine) return null;
    if (msg.isRead)      return <CheckCheck size={14} className="text-blue-500 drop-shadow-sm" />;
    if (msg.isDelivered) return <CheckCheck size={14} className="text-gray-400" />;
    return <Check size={14} className="text-gray-400" />;
  };

  // ── Media content ───────────────────────────────────────────────────────
  const MediaContent = () => {
    if (msg.messageType === 'image') {
      return (
        <div className="mb-1 rounded-lg overflow-hidden border border-black/5 shadow-inner">
          <img
            src={msg.mediaUrl}
            alt="image"
            onError={e => (e.target.style.display = 'none')}
            className="max-w-[240px] max-h-[320px] object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-300"
            onClick={() => window.open(msg.mediaUrl, '_blank')}
          />
        </div>
      );
    }
    if (msg.messageType === 'video') {
      return <video src={msg.mediaUrl} controls className="rounded-lg max-w-[240px] max-h-[200px] mb-1 shadow-sm" />;
    }
    if (msg.messageType === 'audio') {
      return <audio src={msg.mediaUrl} controls className="max-w-[240px] mb-1 scale-90 origin-left" />;
    }
    return null;
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      ref={ref}
      className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1.5 msg-slide-in group relative`}
    >
      <div
        className={`
          relative max-w-[75%] min-w-[64px] px-2.5 py-1.5 rounded-2xl shadow-sm transition-all
          ${isMine
            ? 'user-bubble rounded-br-sm text-black dark:text-gray-100'
            : 'admin-bubble dark:bg-[#1F2C34] rounded-bl-sm text-black dark:text-gray-100'}
        `}
      >
        {/* Admin-only options menu */}
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
              <div className="absolute right-0 z-[999999] top-full mt-1 bg-white dark:bg-[#233138] shadow-xl rounded-lg py-1 border border-gray-100 dark:border-gray-800 min-w-[120px]">
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
    </div>
  );
}
