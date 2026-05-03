import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import api from '../utils/api.js';
import { uploadUnsigned } from '../utils/cloudinary.js';
import { isSameDay, formatChatDate, formatLastSeen } from '../utils/time.js';
import MessageBubble from '../components/chat/MessageBubble.jsx';
import MessageInput from '../components/chat/MessageInput.jsx';
import DateSeparator from '../components/chat/DateSeparator.jsx';
import TypingIndicator from '../components/chat/TypingIndicator.jsx';
import { StatusViewer, SegmentedCircle } from '../components/status/StatusViewer.jsx';
import {
  LogOut, Sun, Moon, Search, Shield, X,
  Ban, BellOff, Trash2, Plus, Upload, Settings,
  Image as ImageIcon, Film, Type, ChevronLeft, MoreVertical,
  MessageCircle, CircleDashed, Filter, Tag, Pin, Archive, ArchiveRestore
} from 'lucide-react';

const notify = (title, body, icon) => {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon });
  }
};

function ChatRow({ chat, selected, onClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = chat.unreadCount;
  
  // Close menu when clicking anywhere else
  useEffect(() => {
    if (!menuOpen) return;
    const handleClose = () => setMenuOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [menuOpen]);

  return (
    <div className="relative group">
      <button onClick={() => onClick('open')}
        className={`w-full flex items-center gap-3 px-4 py-3 transition hover:bg-gray-100 dark:hover:bg-[#202C33] ${selected ? 'bg-gray-100 dark:bg-[#2A3942]' : ''}`}>
        <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
        {chat.userProfilePicture
          ? <img src={chat.userProfilePicture} className="w-full h-full object-cover" alt="" />
          : <div className="w-full h-full flex items-center justify-center font-bold text-white text-sm" style={{ backgroundColor: `hsl(${(chat.userId * 47) % 360}, 60%, 50%)` }}>
              {chat.userName?.[0]?.toUpperCase()}
            </div>
        }
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex justify-between items-baseline mb-0.5">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{chat.userName}</p>
          <span className={`text-[11px] flex-shrink-0 ml-1 ${unread > 0 ? 'text-green-500 font-bold' : 'text-gray-400'}`}>
            {formatChatDate(chat.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
             {chat.userIsBlocked ? <span className="text-red-500">🚫 Blocked</span> : (chat.lastMessage || 'No messages')}
          </p>
          {unread > 0 && (
            <span className="ml-2 flex-shrink-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-black" aria-hidden="true" />
          )}
        </div>
          {chat.labels && chat.labels.length > 0 && (
            <div className="flex gap-1 mt-1 overflow-x-auto no-scrollbar">
              {chat.labels.map(l => (
                <span key={l.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap" style={{ backgroundColor: `${l.color}22`, color: l.color, border: `1px solid ${l.color}44` }}>
                   {l.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      {/* Action Buttons */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2">
         {/* Desktop View: Hover icons */}
         <div className="hidden md:flex flex-col justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-gray-100 dark:from-[#2A3942] to-transparent pl-4">
            <button onClick={(e) => { e.stopPropagation(); onClick('pin'); }} className="p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full text-gray-500 hover:text-green-500 transition shadow-sm">
              <Pin size={14} className={chat.isPinned ? 'fill-current' : ''} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onClick('archive'); }} className="p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full text-gray-500 hover:text-blue-500 transition shadow-sm">
              {chat.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
         </div>

         {/* Mobile View: Dropdown Menu */}
         <div className="md:hidden top-4 relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <MoreVertical size={20} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#2A3942] rounded-2xl shadow-2xl z-[60] border border-[var(--border)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <button 
                  onClick={(e) => { e.stopPropagation(); onClick('pin'); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-[#202C33] text-gray-700 dark:text-gray-200 transition"
                >
                  <Pin size={16} className={chat.isPinned ? 'fill-current text-green-500' : ''} />
                  {chat.isPinned ? 'Unpin' : 'Pin Chat'}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onClick('archive'); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-[#202C33] text-gray-700 dark:text-gray-200 border-t border-[var(--border)] transition"
                >
                  {chat.isArchived ? <ArchiveRestore size={16} className="text-blue-500" /> : <Archive size={16} />}
                  {chat.isArchived ? 'Unarchive' : 'Archive'}
                </button>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}

function ChatRowSkeleton() {
  return (
    <div className="w-full flex items-center gap-3 px-4 py-3 opacity-60">
      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between items-center">
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          <div className="h-2 w-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        </div>
        <div className="h-2 w-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
      </div>
    </div>
  );
}

function LabelModal({ onClose, onCreated, chats }) {
  const [name, setName] = useState('');
  const [selectedChats, setSelectedChats] = useState([]);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error('Label name required');
    setLoading(true);
    try {
      const { data } = await api.post('/labels', { name, chatIds: selectedChats });
      onCreated(data.label, selectedChats);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create label');
    } finally {
      setLoading(false);
    }
  };

  const toggleChat = (id) => {
    setSelectedChats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#202C33] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-gray-50 dark:bg-[#2A3942]">
          <h3 className="font-semibold text-gray-900 dark:text-white">Create New Label</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>
        <div className="p-5 flex-shrink-0">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block uppercase">Label Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Lead" autoFocus
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111B21] text-gray-900 dark:text-white focus:outline-none focus:border-green-500" />
        </div>
        <div className="px-5 pb-2 flex-shrink-0">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block uppercase">Assign to Chats (Optional)</label>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
          {chats.map(c => (
             <label key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2A3942] cursor-pointer transition">
                <input type="checkbox" checked={selectedChats.includes(c.id)} onChange={() => toggleChat(c.id)} className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500" />
                <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden flex-shrink-0">
                   {c.userProfilePicture ? <img src={c.userProfilePicture} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-green-600 flex items-center justify-center text-white font-bold text-xs">{c.userName[0]}</div>}
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.userName}</span>
             </label>
          ))}
          {chats.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No chats available</p>}
        </div>
        <div className="flex gap-3 p-5 bg-gray-50 dark:bg-[#2A3942]/50 border-t border-[var(--border)] flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">Cancel</button>
          <button onClick={submit} disabled={loading || !name.trim()}
            className="flex-1 py-2.5 rounded-xl text-[#111B21] font-bold disabled:opacity-50 transition bg-green-500 hover:bg-green-400 shadow-lg shadow-green-500/20">
            {loading ? 'Creating...' : 'Create Label'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusUploadModal({ onClose, onCreated }) {
  const [type, setType]       = useState('text');
  const [text, setText]       = useState('');
  const [bg, setBg]           = useState('#128C7E');
  const [file, setFile]       = useState(null);
  const [caption, setCaption] = useState('');
  const [duration, setDur]    = useState(1);
  const [loading, setLoad]    = useState(false);
  const fileRef = useRef();

  const submit = async () => {
    setLoad(true);
    try {
      let mediaUrl = null;
      if (type !== 'text' && file) {
        const { url } = await uploadUnsigned(file, type);
        mediaUrl = url;
      }
      const { data } = await api.post('/statuses', {
        contentType: type, mediaUrl, textContent: type === 'text' ? text : null,
        caption, backgroundColor: bg, duration,
      });
      onCreated(data.status);
      onClose();
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setLoad(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#202C33] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-gray-50 dark:bg-[#2A3942]">
          <h3 className="font-semibold text-gray-900 dark:text-white">New Status Update</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            {[['text', 'Text', <Type size={16}/>], ['image', 'Image', <ImageIcon size={16}/>], ['video', 'Video', <Film size={16}/>]].map(([t, label, icon]) => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${type === t ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-600' : 'border-gray-100 dark:border-gray-700 text-gray-500'}`}>
                {icon} {label}
              </button>
            ))}
          </div>
          {type === 'text' ? (
            <div className="space-y-3">
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Type something..."
                className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111B21] text-gray-900 dark:text-white resize-none h-32 text-center text-xl font-medium focus:outline-none" style={{ backgroundColor: bg + '22', color: bg }} />
              <div className="flex gap-2 items-center justify-center">
                <p className="text-sm text-gray-500">Pick Background:</p>
                {['#128C7E', '#075E54', '#34B7F1', '#EC2B1F', '#F98E1D'].map(c => (
                   <button key={c} onClick={() => setBg(c)} className={`w-8 h-8 rounded-full border-2 ${bg === c ? 'border-gray-900' : 'border-transparent'}`} style={{backgroundColor: c}}/>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <button onClick={() => fileRef.current.click()}
                className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-12 flex flex-col items-center gap-3 text-gray-400 hover:border-green-500 hover:text-green-500 transition-all bg-gray-50 dark:bg-[#111B21]">
                <Upload size={32} />
                <span className="text-sm font-medium">{file ? file.name : `Select ${type} file`}</span>
              </button>
              <input ref={fileRef} type="file" accept={type === 'image' ? 'image/*' : 'video/*'} className="hidden" onChange={e => setFile(e.target.files[0])} />
              <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption..."
                className="w-full mt-4 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111B21] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 bg-gray-50 dark:bg-[#2A3942]/50 border-t border-[var(--border)]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition">Discard</button>
          <button onClick={submit} disabled={loading || (type !== 'text' && !file) || (type === 'text' && !text.trim())}
            className="flex-1 py-2.5 rounded-xl text-[#111B21] font-bold disabled:opacity-50 transition bg-green-500 hover:bg-green-400 shadow-lg shadow-green-500/20">
            {loading ? 'Posting...' : 'Share Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, setUser, logout }       = useAuth();
  const { emit, on, isConnected } = useSocket();
  const { dark, toggle }       = useTheme();
  const navigate               = useNavigate();

  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'status' | 'settings'
  const [chats, setChats]           = useState([]);
  const [selectedChat, setSelected] = useState(null);
  const [messages, setMessages]     = useState([]);
  const [statuses, setStatuses]     = useState([]);
  const [search, setSearch]         = useState('');
  const [allLabels, setAllLabels]   = useState([]);
  const [activeLabel, setActiveLabel] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [typing, setTyping]         = useState(false);
  const [loading, setLoading]       = useState(true);
  const [msgLoading, setMsgLoad]    = useState(false);
  const [showStatusModal, setShowModal] = useState(false);
  const [viewStatus, setViewStatus] = useState(null);
  const [welcomeMsg, setWelcome]     = useState('');
  const [isEditingWelcome, setEditingWelcome] = useState(false);
  const [tempWelcome, setTempWelcome] = useState('');
  const [aboutMsg, setAbout]         = useState(user?.about || '');
  const [isEditingAbout, setEditingAbout] = useState(false);
  const [tempAbout, setTempAbout]     = useState('');
  const [sidebarOpen, setSidebar]   = useState(true);
  const [hasMore, setHasMore]       = useState(true);
  const [loadingMore, setLoadMore]  = useState(false);

  const bottomRef   = useRef();
  const fileInputRef = useRef();
  const typingTimer = useRef();
  const selectedChatRef = useRef(null);
  const chatContainerRef = useRef(null);
  const skipRef     = useRef(0);
  const lastMsgId = useRef(null);
  const isInitialLoad = useRef(true);
  const lastChatId = useRef(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (Notification.permission === 'default') Notification.requestPermission();
    const init = async () => {
      try {
        const [chatRes, statusRes, welcomeRes, labelsRes] = await Promise.all([
          api.get('/chats'), api.get('/statuses'), api.get('/welcome'), api.get('/labels')
        ]);
        setChats(chatRes.data.chats);
        setStatuses(statusRes.data.statuses);
        setWelcome(welcomeRes.data.message);
        setAllLabels(labelsRes.data.labels);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (messages.length > 0 && selectedChat) {
      const latestMsg = messages[messages.length - 1];
      const isNewMessage = latestMsg.id !== lastMsgId.current;
      
      if (isNewMessage || isInitialLoad.current) {
        const behavior = isInitialLoad.current ? 'auto' : 'smooth';
        const timer = setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior });
        }, 50);
        lastMsgId.current = latestMsg.id;
        isInitialLoad.current = false;
        return () => clearTimeout(timer);
      }
    }
  }, [messages, selectedChat?.id]);

  useEffect(() => {
    if (!isConnected) return;
    if (selectedChatRef.current) emit('join-chat', { chatId: selectedChatRef.current.id });

    const offMsg = on('receive-message', (msg) => {
      if (selectedChatRef.current?.id === msg.chatId) {
        setMessages(prev => [...prev, msg]);
        emit('message-read', { chatId: msg.chatId, messageIds: [msg.id] });
      } else if (msg.senderId !== user.id) {
        notify(`Message from ${msg.senderName || 'User'}`, msg.content || `[${msg.messageType}]`, '/vite.svg');
        toast.success(`${msg.senderName || 'User'}: ${msg.content || `[${msg.messageType}]`}`);
      }
      setChats(prev => {
        const updated = prev.map(c => c.id === msg.chatId ? { ...c, lastMessage: msg.content || `[${msg.messageType}]`, lastMessageAt: msg.createdAt, unreadCount: selectedChatRef.current?.id === msg.chatId ? 0 : c.unreadCount + 1 } : c);
        return [...updated].sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      });
    });

    const offRead = on('message-read', ({ messageIds, chatId }) => {
      if (selectedChatRef.current?.id === chatId) setMessages(prev => prev.map(m => messageIds.includes(m.id) ? { ...m, isRead: true } : m));
    });

    const offTyping = on('user-typing', ({ userId }) => {
      if (selectedChatRef.current?.userId === userId) {
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3000);
      }
    });

    const offStopTyping = on('user-stop-typing', () => setTyping(false));

    const offDelete = on('message-deleted', ({ messageId, chatId, lastMessage, lastMessageAt }) => {
      if (selectedChatRef.current?.id === chatId) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, lastMessage, lastMessageAt } : c));
    });

    return () => { offMsg(); offRead(); offTyping(); offStopTyping(); offDelete(); };
  }, [on, emit, user.id, isConnected]);

  const updateWelcome = async () => {
    try {
      await api.put('/welcome', { message: tempWelcome });
      setWelcome(tempWelcome);
      setEditingWelcome(false);
    } catch (e) { alert('Update failed'); }
  };

  const updateAbout = async () => {
    try {
      await api.patch(`/users/${user.id}/about`, { about: tempAbout });
      setAbout(tempAbout);
      setEditingAbout(false);
      setUser(prev => ({ ...prev, about: tempAbout }));
      emit('update-profile', { about: tempAbout });
    } catch (e) { alert('Update failed'); }
  };

  const handleProfilePicChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      toast.loading('Uploading...', { id: 'upload' });
      const { data } = await api.patch(`/users/${user.id}/profile-picture`, formData);
      setUser(data.user);
      emit('update-profile', { profilePicture: data.user.profilePicture });
      toast.success('Profile picture updated!', { id: 'upload' });
    } catch (err) {
      toast.error('Failed to upload profile picture', { id: 'upload' });
    }
  };

  const openChat = async (chat) => {
    setSelected(chat);
    setSidebar(false);
    setMsgLoad(true);
    setHasMore(true);
    skipRef.current = 0;
    isInitialLoad.current = true;
    try {
      const res = await api.get(`/chats/${chat.id}/messages`, { params: { limit: 50, skip: 0 } });
      setMessages(res.data.messages);
      skipRef.current = res.data.messages.length;
      if (res.data.messages.length < 50) setHasMore(false);
      
      await api.patch(`/chats/${chat.id}/read`);
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
      emit('join-chat', { chatId: chat.id });
      emit('message-read', { chatId: chat.id, messageIds: res.data.messages.filter(m => !m.isRead && m.senderId !== user.id).map(m => m.id) });
    } catch (err) { console.error(err); } finally { setMsgLoad(false); }
  };

  const loadMore = async () => {
    if (!selectedChat || msgLoading || loadingMore || !hasMore) return;
    setLoadMore(true);
    const scrollContainer = chatContainerRef.current;
    const oldHeight = scrollContainer?.scrollHeight || 0;

    try {
      const res = await api.get(`/chats/${selectedChat.id}/messages`, { params: { limit: 50, skip: skipRef.current } });
      const older = res.data.messages;
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev]);
        skipRef.current += older.length;
        setTimeout(() => {
          if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight - oldHeight;
        }, 0);
      }
      if (older.length < 50) setHasMore(false);
    } catch (err) { console.error(err); } finally { setLoadMore(false); }
  };

  const handleSend = useCallback(async (data) => {
    if (!selectedChat) return;
    emit('send-message', { chatId: selectedChat.id, ...data }, (res) => {
      if (res?.message) {
        setMessages(prev => prev.some(m => m.id === res.message.id) ? prev : [...prev, { ...res.message, senderId: user.id }]);
      } else if (res?.error) {
        toast.error(res.error);
      }
    });
  }, [selectedChat, emit, user.id]);

  const handleTyping = useCallback(() => {
    if (!selectedChat) return;
    if (!typingTimer.current) { emit('typing', { chatId: selectedChat.id }); }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { typingTimer.current = null; emit('stop-typing', { chatId: selectedChat.id }); }, 2000);
  }, [selectedChat, emit]);

  const toggleBlock = async (userId) => {
    const { data } = await api.patch(`/users/${userId}/block`);
    setChats(prev => prev.map(c => c.userId === userId ? { ...c, userIsBlocked: data.user.isBlocked } : c));
    setSelected(prev => prev?.userId === userId ? { ...prev, userIsBlocked: data.user.isBlocked } : prev);
  };

  const handleDeleteChat = async (chatId) => {
    if (!confirm('Are you sure you want to clear this chat history and remove it from your list?')) return;
    try {
      await api.delete(`/chats/${chatId}`);
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (selectedChat?.id === chatId) {
        setSelected(null);
        setMessages([]);
      }
      toast.success('Chat history cleared');
    } catch (err) {
      toast.error('Failed to clear chat');
    }
  };

  let filtered = chats.filter(c => {
    const matchesSearch = c.userName?.toLowerCase().includes(search.toLowerCase()) || c.userPhone?.includes(search);
    const matchesLabel = activeLabel ? c.labels?.some(l => l.id === activeLabel) : true;
    const matchesUnread = onlyUnread ? c.unreadCount > 0 : true;
    const matchesArchive = showArchived ? c.isArchived : !c.isArchived;
    
    return matchesSearch && matchesLabel && matchesUnread && matchesArchive;
  });

  const handleChatAction = async (chatId, action) => {
    if (action === 'open') {
      const chat = chats.find(c => c.id === chatId);
      if (chat) openChat(chat);
      return;
    }
    try {
      const { data } = await api.patch(`/chats/${chatId}/${action}`);
      setChats(prev => {
        const field = action === 'pin' ? 'isPinned' : 'isArchived';
        const updated = prev.map(c => c.id === chatId ? { ...c, [field]: data[field] } : c);
        return [...updated].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
        });
      });
    } catch (e) {
      toast.error(`Failed to ${action} chat`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-[var(--bg)] relative">
      {/* 1. NAV RAIL (Sidebar on Desktop, Bottom Bar on Mobile) */}
      <div className={`${(selectedChat && !sidebarOpen) ? 'hidden md:flex' : 'flex'} fixed bottom-0 left-0 right-0 h-16 md:relative md:h-screen md:w-16 flex md:flex-col items-center justify-around md:justify-start py-0 md:py-4 gap-0 md:gap-4 bg-gray-100 dark:bg-[#111B21] border-t md:border-t-0 md:border-r border-[#2A3942] z-30 transition-all duration-300`}>
         <div className="hidden md:flex w-10 h-10 rounded-full bg-green-500 items-center justify-center text-[#111B21] font-black mb-4">AD</div>
         <button onClick={() => setActiveTab('chats')} className={`flex-1 md:flex-none p-3 rounded-xl flex flex-col md:block items-center gap-1 ${activeTab === 'chats' ? 'bg-gray-200 dark:bg-[#2A3942] text-green-500' : 'text-gray-500'}`}>
            <MessageCircle size={24}/>
            <span className="text-[10px] md:hidden font-bold">Chats</span>
         </button>
         <button onClick={() => setActiveTab('status')} className={`flex-1 md:flex-none p-3 rounded-xl flex flex-col md:block items-center gap-1 ${activeTab === 'status' ? 'bg-gray-200 dark:bg-[#2A3942] text-green-500' : 'text-gray-500'}`}>
            <CircleDashed size={24}/>
            <span className="text-[10px] md:hidden font-bold">Status</span>
         </button>
         <button onClick={() => setActiveTab('settings')} className={`flex-1 md:flex-none p-3 rounded-xl flex flex-col md:block items-center gap-1 ${activeTab === 'settings' ? 'bg-gray-200 dark:bg-[#2A3942] text-green-500' : 'text-gray-500'}`}>
            <Settings size={24}/>
            <span className="text-[10px] md:hidden font-bold">Settings</span>
         </button>
         <div className="contents md:flex md:mt-auto md:flex-col md:gap-4">
            <button onClick={toggle} className="flex-1 md:flex-none p-3 rounded-xl flex flex-col md:block items-center gap-1 text-gray-500 hover:text-green-400">
               {dark ? <Sun size={24}/> : <Moon size={24}/>}
               <span className="text-[10px] md:hidden font-bold">Theme</span>
            </button>
            <button onClick={() => {logout(); navigate('/admin/login');}} className="flex-1 md:flex-none p-3 rounded-xl flex flex-col md:block items-center gap-1 text-gray-500 hover:text-red-500">
               <LogOut size={24}/>
               <span className="text-[10px] md:hidden font-bold">Logout</span>
            </button>
         </div>
      </div>

      {/* 2. SIDEBAR CONTENT */}
      <div className={`${(selectedChat && !sidebarOpen) ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 bg-white dark:bg-[#111B21] border-r border-[#2A3942] flex-shrink-0 animate-in fade-in duration-300 z-20 pb-16 md:pb-0`}>
         {activeTab === 'chats' && (
           <>
              <div className="flex items-center justify-between px-4 py-4 pt-6">
                 <h2 className="text-2xl font-bold dark:text-white">Admin</h2>
                 {/* <button className="p-2 dark:text-gray-400"><Filter size={18}/></button> */}
              </div>
              <div className="px-4 mb-2">
                 <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..." className="w-full bg-gray-100 dark:bg-[#202C33] text-sm py-2 pl-10 pr-4 rounded-xl dark:text-white focus:outline-none"/>
                 </div>
              </div>
          <div className="px-4 mb-3 flex items-center gap-2">
            {/* Fixed pills: Archived, Unread, Add New (not part of the scroll area) */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <button onClick={() => setShowArchived(!showArchived)}
                className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full transition border ${showArchived ? 'opacity-100 bg-blue-100 text-blue-600 border-blue-500' : 'opacity-60 hover:opacity-100 bg-gray-100 text-gray-600 border-transparent'}`}>
                <Archive size={10}/> {showArchived ? 'Hide Archived' : 'Archived'}
              </button>

              <button onClick={() => setOnlyUnread(!onlyUnread)}
                className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full transition border ${onlyUnread ? 'opacity-100 bg-green-100 text-green-600 border-green-500' : 'opacity-60 hover:opacity-100 bg-gray-100 text-gray-600 border-transparent'}`}>
                <BellOff size={10}/> {onlyUnread ? 'Showing Unread' : 'Unread'}
              </button>

              <button onClick={() => setShowLabelModal(true)} className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-[#202C33] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2A3942] transition">
                <Plus size={12}/> Add New
              </button>
            </div>

            {/* Scrollable labels only */}
            <div className="flex-1 overflow-x-auto no-scrollbar pb-1">
              <div className="flex gap-2">
               {allLabels.map(l => (
                 <button key={l.id} onClick={() => setActiveLabel(prev => prev === l.id ? null : l.id)}
                   className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full transition border ${activeLabel === l.id ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                   style={{ backgroundColor: `${l.color}22`, color: l.color, borderColor: activeLabel === l.id ? l.color : 'transparent' }}>
                   <Tag size={10}/> {l.name}
                 </button>
               ))}
             </div>
            </div>
          </div>
               <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {[1,2,3,4,5,6].map(i => <ChatRowSkeleton key={i} />)}
                    </div>
                  ) : filtered.map(chat => (
                    <ChatRow key={chat.id} chat={chat} selected={selectedChat?.id === chat.id} onClick={(action) => handleChatAction(chat.id, action)} />
                  ))}
               </div> 
           </>
         )}

         {activeTab === 'status' && (
           <>
              <div className="px-5 py-6">
                 <h2 className="text-2xl font-bold dark:text-white mb-6">Status</h2>
                 <button onClick={() => setShowModal(true)} className="w-full flex items-center gap-4 p-3 hover:bg-gray-100 dark:hover:bg-[#202C33] rounded-2xl transition">
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-[#111B21]"><Plus size={24}/></div>
                    <div className="text-left">
                       <p className="font-bold dark:text-white">My Status</p>
                       <p className="text-xs text-gray-500">Tap to add your update</p>
                    </div>
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5">
                 <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-4">Current Stories</p>
                 {Object.values(statuses.reduce((acc, s) => {
                     if (!acc[s.userId]) acc[s.userId] = [];
                     acc[s.userId].push(s);
                     return acc;
                  }, {})).map((group, groupIdx) => {
                     const first = group[0];
                     const viewedCount = group.filter(s => s.isViewed).length;
                     const startIndex = statuses.findIndex(s => s.id === first.id);
                     
                     return (
                        <button key={first.userId} onClick={() => setViewStatus(startIndex)} className="w-full flex items-center gap-4 py-3 border-b border-[#2A3942]/10 group">
                           <div className="relative w-14 h-14 flex-shrink-0">
                              <SegmentedCircle count={group.length} viewedCount={viewedCount} size={56} />
                              <div className="absolute inset-0 m-auto w-[46px] h-[46px] rounded-full overflow-hidden bg-white dark:bg-[#111B21] p-[1px]">
                                 {first.userProfilePicture ? (
                                    <img src={first.userProfilePicture} className="w-full h-full object-cover rounded-full" alt="" />
                                 ) : (
                                    <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center text-white">
                                       <CircleDashed size={20}/>
                                    </div>
                                 )}
                              </div>
                           </div>
                           <div className="text-left flex-1 min-w-0">
                              <p className="font-bold dark:text-white truncate group-hover:text-green-500 transition-colors">{first.userName}</p>
                              <p className="text-xs text-gray-500">{formatChatDate(first.createdAt)}</p>
                           </div>
                        </button>
                     );
                  })}
                  {statuses.length === 0 && <p className="text-sm text-gray-500 italic">No active stories</p>}
              </div>
           </>
         )}

         {activeTab === 'settings' && (
           <div className="px-6 py-6">
               <h2 className="text-2xl font-bold dark:text-white mb-6">Settings</h2>
               <div className="space-y-6">
                  {/* Profile Picture Section */}
                  <div className="bg-gray-50 dark:bg-[#202C33] p-6 rounded-3xl border border-[var(--border)] shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-green-600 border-2 border-white dark:border-[#202C33] shadow-md flex-shrink-0 relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        {user.profilePicture ? <img src={user.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl">{user.name?.[0]}</div>}
                        <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                          <Upload size={20} className="text-white" />
                        </div>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-lg">{user.name}</p>
                        <p className="text-xs text-gray-500">Click avatar to update</p>
                      </div>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                  </div>

                  <div className="bg-gray-50 dark:bg-[#202C33] p-6 rounded-3xl border border-[var(--border)] shadow-sm">
                     <p className="text-[11px] font-bold text-green-500 uppercase mb-3 tracking-widest">Automatic Welcome Message</p>
                     
                     {isEditingWelcome ? (
                        <div className="space-y-4">
                           <textarea 
                              value={tempWelcome} 
                              onChange={e => setTempWelcome(e.target.value)}
                              className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111B21] text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              rows={4}
                           />
                           <div className="flex gap-2">
                              <button onClick={updateWelcome} className="flex-1 py-2 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition">Save Changes</button>
                              <button onClick={() => setEditingWelcome(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm hover:bg-gray-300 transition">Cancel</button>
                           </div>
                        </div>
                     ) : (
                        <>
                           <p className="text-[15px] text-gray-700 dark:text-gray-200 italic mb-6 leading-relaxed line-clamp-4">"{welcomeMsg || 'No welcome message set.'}"</p>
                           <button 
                              onClick={() => { setTempWelcome(welcomeMsg); setEditingWelcome(true); }} 
                              className="flex items-center gap-2 text-[12px] font-bold text-green-500 hover:text-green-400 transition group"
                           >
                              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                              EDIT WELCOME MESSAGE
                           </button>
                        </>
                     )}
                  <div className="bg-gray-50 dark:bg-[#202C33] p-6 rounded-3xl border border-[var(--border)] shadow-sm mt-4">
                     <p className="text-[11px] font-bold text-green-500 uppercase mb-3 tracking-widest">My About Info</p>
                     
                     {isEditingAbout ? (
                        <div className="space-y-4">
                           <textarea 
                              value={tempAbout} 
                              onChange={e => setTempAbout(e.target.value)}
                              className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111B21] text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              rows={2}
                           />
                           <div className="flex gap-2">
                              <button onClick={updateAbout} className="flex-1 py-2 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition">Save Changes</button>
                              <button onClick={() => setEditingAbout(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm hover:bg-gray-300 transition">Cancel</button>
                           </div>
                        </div>
                     ) : (
                        <>
                           <p className="text-[15px] text-gray-700 dark:text-gray-200 mb-6 leading-relaxed">"{aboutMsg || 'Available'}"</p>
                           <button 
                              onClick={() => { setTempAbout(aboutMsg); setEditingAbout(true); }} 
                              className="flex items-center gap-2 text-[12px] font-bold text-green-500 hover:text-green-400 transition group"
                           >
                              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                              EDIT ABOUT INFO
                           </button>
                        </>
                     )}
                  </div>
                </div>
              </div>
           </div>
         )}
      </div>

      {/* 3. CHAT AREA */}
      <div className={`${(selectedChat && !sidebarOpen) ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col chat-bg min-w-0 h-full relative pb-0 md:pb-0`}>
         {selectedChat ? (
           <>
              <div className="flex items-center gap-3 px-4 py-3 bg-[#202C33] border-b border-[#2A3942] z-10 shadow-lg cursor-pointer hover:bg-[#2A3942] transition" onClick={() => setShowUserProfile(true)}>
                 <button onClick={(e) => { e.stopPropagation(); setSidebar(true); }} className="md:hidden p-1 text-gray-400">
                     <ChevronLeft size={24}/>
                 </button>
                 <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold overflow-hidden">
                    {selectedChat.userProfilePicture ? <img src={selectedChat.userProfilePicture} className="w-full h-full object-cover" /> : selectedChat.userName[0]}
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{selectedChat.userName}</p>
                    <p className="text-[10px] text-gray-400">Click to view profile</p>
                 </div>
                 <button onClick={(e) => { e.stopPropagation(); toggleBlock(selectedChat.userId); }} className={`p-2 rounded-full ${selectedChat.userIsBlocked ? 'text-red-500' : 'text-gray-400 font-bold'}`}><Ban size={18}/></button>
                 <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(selectedChat.id); }} className="p-2 rounded-full text-red-500"><Trash2 size={18}/></button>
              </div>
               <div className="flex-1 relative overflow-hidden flex flex-col">
                  {msgLoading && (
                     <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-[#0B141A]/60 backdrop-blur-md z-30 animate-in fade-in duration-300">
                        <div className="spinner" />
                     </div>
                  )}
                  <div 
                      ref={chatContainerRef}
                      className="flex-1 overflow-y-auto px-4 py-5 flex flex-col custom-scrollbar"
                      onScroll={e => { if (e.target.scrollTop < 100) loadMore(); }}
                  >
                     <div className="flex-1" />
                     {loadingMore && (
                        <div className="flex justify-center items-center py-4 animate-in fade-in zoom-in duration-300">
                           <div className="spinner-sm" />
                           <span className="ml-2 text-[11px] text-gray-500 font-bold uppercase tracking-wider">Fetching more messages...</span>
                        </div>
                     )}
                     {messages.map((msg, i) => {
                        const prevMsg = messages[i-1]; const showDate = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
                        return (<div key={msg.id}>{showDate && <DateSeparator date={msg.createdAt}/>}<MessageBubble msg={msg}/></div>);
                     })}
                     {typing && <TypingIndicator name="User"/>}
                     <div ref={bottomRef} className="h-4"/>
                  </div>
               </div>
              <div onKeyDown={handleTyping} className="p-1"><MessageInput onSend={handleSend} disabled={selectedChat.userIsBlocked} chatId={selectedChat.id} /></div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <h2 className="text-2xl font-bold dark:text-white">Admin Dashboard</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-sm">Select a chat from the sidebar to manage conversations.</p>
           </div>
         )}
      </div>

      {showLabelModal && <LabelModal onClose={() => setShowLabelModal(false)} onCreated={(label, chatIds) => {
         setAllLabels(prev => [...prev, label]);
         if (chatIds && chatIds.length > 0) {
            setChats(prev => prev.map(c => chatIds.includes(c.id) ? { ...c, labels: [...(c.labels || []), label] } : c));
         }
      }} chats={chats} />}
      {showStatusModal && <StatusUploadModal onClose={() => setShowModal(false)} onCreated={s => setStatuses(prev => [s, ...prev])}/>}
      {viewStatus !== null && <StatusViewer statuses={statuses.filter(s => activeTab === 'chats' ? true : true)} startIndex={viewStatus} onClose={() => setViewStatus(null)} />}

      {/* 4. USER PROFILE PANE */}
      {showUserProfile && selectedChat && (
        <div className="absolute right-0 top-0 bottom-0 w-full md:w-80 lg:w-96 bg-white dark:bg-[#111B21] border-l border-[var(--border)] z-[70] flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
          <div className="flex items-center gap-4 p-4 border-b border-[var(--border)] bg-gray-50 dark:bg-[#202C33]">
            <button onClick={() => setShowUserProfile(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white"><X size={24} /></button>
            <h2 className="text-lg font-bold dark:text-white">User Profile</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
            <div className="w-40 h-40 rounded-full overflow-hidden bg-green-600 border-4 border-white dark:border-[#202C33] shadow-lg mb-6">
              {selectedChat.userProfilePicture ? (
                <img src={selectedChat.userProfilePicture} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-white font-bold">
                  {selectedChat.userName?.[0]}
                </div>
              )}
            </div>
            <h3 className="text-2xl font-bold dark:text-white mb-1 text-center">{selectedChat.userName}</h3>
            <p className="text-sm text-gray-500 font-medium mb-2">{selectedChat.userPhone}</p>
            <p className="text-xs text-gray-400 mb-8 tracking-wide">Joined {new Date(selectedChat.createdAt).toLocaleDateString()}</p>
            
            <div className="w-full space-y-4">
              <div className="bg-gray-50 dark:bg-[#202C33] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-left">
                 <p className="text-[11px] font-bold text-green-500 uppercase mb-2 tracking-widest">About</p>
                 <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{selectedChat.userAbout || 'Hey there! I am using ChatApp.'}</p>
              </div>

              <div className="bg-gray-50 dark:bg-[#202C33] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-left">
                 <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 tracking-widest">Last Seen</p>
                 <p className="text-sm text-gray-800 dark:text-gray-200">{formatLastSeen(selectedChat.userLastSeen)}</p>
              </div>

              <div className="bg-gray-50 dark:bg-[#202C33] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-left">
                 <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 tracking-widest">Chat Status</p>
                 <div className="flex items-center gap-2">
                    {selectedChat.userIsBlocked ? (
                      <span className="flex items-center gap-1 text-red-500 font-bold text-sm"><Ban size={14}/> Restricted</span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-500 font-bold text-sm"><Shield size={14}/> Verified User</span>
                    )}
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    
  );
}
