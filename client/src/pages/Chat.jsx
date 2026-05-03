import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import api from '../utils/api.js';
import { isSameDay, formatChatDate } from '../utils/time.js';
import MessageBubble from '../components/chat/MessageBubble.jsx';
import MessageInput from '../components/chat/MessageInput.jsx';
import DateSeparator from '../components/chat/DateSeparator.jsx';
import TypingIndicator from '../components/chat/TypingIndicator.jsx';
import { StatusCircle, StatusViewer, SegmentedCircle } from '../components/status/StatusViewer.jsx';
import {
  LogOut, Sun, Moon, MessageSquare,
  MessageCircle, CircleDashed, Settings, ChevronLeft, X
} from 'lucide-react';

const notify = (title, body) => {
  if (Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, icon: '/vite.svg' });
  }
};

export default function Chat() {
  const { user, setUser, logout }       = useAuth();
  const { emit, on, off, isConnected, onlineUsers } = useSocket();
  const { dark, toggle }       = useTheme();
  const navigate               = useNavigate();

  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'status'
  const [chat, setChat]         = useState(null);
  const [messages, setMessages] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [typing, setTyping]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadMore] = useState(false);
  const [hasMore, setHasMore]   = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [initialChat, setInitialChat] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [viewerStatus, setViewerStatus] = useState(null);

  const fileInputRef = useRef();

  const bottomRef  = useRef();
  const activeChatRef = useRef(null);
  const chatContainerRef = useRef(null);
  const typingTimer = useRef();
  const isTyping    = useRef(false);
  const skipRef     = useRef(0);
  const isInitialLoad = useRef(true);
  const lastMsgId = useRef(null);

  useEffect(() => {
    activeChatRef.current = chat;
  }, [chat]);

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const init = async () => {
      try {
        const [chatRes, statusRes] = await Promise.all([
          api.get('/chats/my-chat'),
          api.get('/statuses'),
        ]);
        setChat(chatRes.data.chat);
        setInitialChat(chatRes.data.chat);
        setStatuses(statusRes.data.statuses);
        setSidebarOpen(false); // Focused on chat by default

        const msgsRes = await api.get(`/chats/${chatRes.data.chat.id}/messages`, { params: { limit: 50, skip: 0 } });
        setMessages(msgsRes.data.messages);
        skipRef.current = msgsRes.data.messages.length;
        if (msgsRes.data.messages.length < 50) setHasMore(false);

        isInitialLoad.current = true; // Reset for initial scroll
        emit('join-chat', { chatId: chatRes.data.chat.id });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user.id, emit]);

  useEffect(() => {
    if (messages.length > 0 && chat) {
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
  }, [messages, chat?.id]);

  // Socket events
  useEffect(() => {
    if (!isConnected) return;
    if (activeChatRef.current) {
        emit('join-chat', { chatId: activeChatRef.current.id });
    }

    const offMsg = on('receive-message', (msg) => {
      try {
        if (activeChatRef.current?.id === msg.chatId) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Only mark as read if the message was sent by the other party
          if (msg.senderId !== user.id) {
            emit('message-read', { chatId: msg.chatId, messageIds: [msg.id] });
            if (Notification.permission === 'granted' && document.hidden) notify(`New Message`, msg.content || `[${msg.messageType}]`);
          }
        }
      } catch (e) {
        console.error('receive-message handler error:', e);
      }
    });

    const offDelivered = on('message-delivered', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isDelivered: true } : m));
    });

    const offRead = on('message-read', ({ messageIds, chatId }) => {
      if (activeChatRef.current?.id === chatId) {
        setMessages(prev => prev.map(m => messageIds.includes(m.id) ? { ...m, isRead: true } : m));
      }
    });

    const offTyping = on('user-typing', () => {
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3000);
    });

    const offStopTyping = on('user-stop-typing', () => setTyping(false));

    const offProfile = on('profile-updated', ({ userId, updates }) => {
      if (userId === activeChatRef.current?.adminId) {
        setChat(prev => prev ? ({ ...prev, admin: { ...prev.admin, ...updates } }) : prev);
        setInitialChat(prev => prev ? ({ ...prev, admin: { ...prev.admin, ...updates } }) : prev);
      }
    });
    
    const offDelete = on('message-deleted', ({ messageId, chatId }) => {
      if (activeChatRef.current?.id === chatId) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    });

    return () => { offMsg(); offDelivered(); offRead(); offTyping(); offStopTyping(); offProfile(); offDelete(); };
  }, [on, emit, user.id, isConnected]);

  const handleSend = useCallback(async (data) => {
    if (!chat) return;
    emit('send-message', { chatId: chat.id, ...data }, (res) => {
      if (res?.message) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === res.message.id);
          return exists ? prev : [...prev, { ...res.message, senderId: user.id }];
        });
      } else if (res?.error) {
        toast.error(res.error, {
          icon: '🚫',
          style: {
            borderRadius: '12px',
            background: '#333',
            color: '#fff',
          },
        });
      }
    });
  }, [chat, emit, user.id]);

  const handleTyping = useCallback(() => {
    if (!chat || !isConnected) return;
    if (!isTyping.current) {
      isTyping.current = true;
      emit('typing', { chatId: chat.id });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      emit('stop-typing', { chatId: chat.id });
    }, 2000);
  }, [chat, emit, isConnected]);

  const loadMore = async () => {
    if (!chat || loadingMore || !hasMore) return;
    setLoadMore(true);
    const scrollContainer = chatContainerRef.current;
    const oldHeight = scrollContainer?.scrollHeight || 0;
    
    try {
      const res = await api.get(`/chats/${chat.id}/messages`, { params: { limit: 50, skip: skipRef.current } });
      const older = res.data.messages;
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev]);
        skipRef.current += older.length;
        
        // Scroll restoration
        setTimeout(() => {
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight - oldHeight;
          }
        }, 0);
      }
      if (older.length < 50) setHasMore(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadMore(false);
    }
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
      toast.success('Profile picture updated!', { id: 'upload' });
    } catch (err) {
      toast.error('Failed to upload profile picture', { id: 'upload' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin shadow-lg" />
      </div>
    );
  }

  const adminOnline = chat && onlineUsers.has(chat.adminId);

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-[var(--bg)] relative">
      {/* 1. NAV RAIL (Sidebar on Desktop, Bottom Bar on Mobile) */}
      <div className={`${(!sidebarOpen && chat && activeTab === 'chats') ? 'hidden md:flex' : 'flex'} fixed bottom-0 left-0 right-0 h-16 md:relative md:h-screen md:w-16 flex md:flex-col items-center justify-around md:justify-start py-0 md:py-4 gap-0 md:gap-4 bg-gray-100 dark:bg-gray-900 border-t md:border-t-0 md:border-r border-[var(--border)] z-30 transition-all duration-300`}>
        <div className="hidden md:flex w-10 h-10 rounded-full overflow-hidden mb-4 border-2 border-green-500 flex-shrink-0">
           {user.profilePicture ? <img src={user.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-green-600 text-white font-bold">{user.name[0]}</div>}
        </div>
        
        <button onClick={() => setActiveTab('chats')}
          className={`flex-1 md:flex-none p-3 rounded-xl flex flex-col md:block items-center gap-1 transition ${activeTab === 'chats' ? 'bg-gray-200 dark:bg-gray-800 text-green-500' : 'text-gray-500 hover:text-green-400'}`}>
          <MessageCircle size={24} />
          <span className="text-[10px] md:hidden font-bold">Chats</span>
        </button>
        
        <button onClick={() => setActiveTab('status')}
          className={`flex-1 md:flex-none p-3 rounded-xl flex flex-col md:block items-center gap-1 transition ${activeTab === 'status' ? 'bg-gray-200 dark:bg-gray-800 text-green-500' : 'text-gray-500 hover:text-green-400'}`}>
          <CircleDashed size={24} />
          <span className="text-[10px] md:hidden font-bold">Status</span>
        </button>

        <button onClick={() => setActiveTab('settings')}
          className={`flex-1 md:flex-none p-3 rounded-xl flex flex-col md:block items-center gap-1 transition ${activeTab === 'settings' ? 'bg-gray-200 dark:bg-gray-800 text-green-500' : 'text-gray-500 hover:text-green-400'}`}>
          <Settings size={24} />
          <span className="text-[10px] md:hidden font-bold">Settings</span>
        </button>

        <div className="contents md:flex md:mt-auto md:flex-col md:gap-4">
          <button onClick={toggle} className="flex-1 md:flex-none p-3 rounded-xl flex flex-col md:block items-center gap-1 text-gray-500 hover:text-green-400">
            {dark ? <Sun size={24} /> : <Moon size={24} />}
            <span className="text-[10px] md:hidden font-bold">Theme</span>
          </button>
          <button onClick={() => { logout(); navigate('/login'); }} className="flex-1 md:flex-none p-3 rounded-xl flex flex-col md:block items-center gap-1 text-gray-500 hover:text-red-500">
            <LogOut size={24} />
            <span className="text-[10px] md:hidden font-bold">Logout</span>
          </button>
        </div>
      </div>

      {/* 2. SIDEBAR CONTENT */}
      <div className={`${(!sidebarOpen && chat && activeTab === 'chats') ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex flex-col bg-white dark:bg-[#111B21] border-r border-[var(--border)] overflow-hidden transition-all duration-300 pb-16 md:pb-0`}>
        {activeTab === 'chats' && (
          <>
            <div className="px-4 py-4 border-b border-[var(--border)]">
               <h2 className="text-xl font-bold dark:text-white">Chats</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
               <button onClick={() => { setChat(initialChat); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#202C33] transition ${chat ? 'bg-gray-50 dark:bg-[#2A3942]/30' : ''}`}>
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-green-600 flex-shrink-0">
                    {initialChat?.admin?.profilePicture ? (
                      <img src={initialChat.admin.profilePicture} className="w-full h-full object-cover" />
                    ) : (
                      <MessageSquare size={24} className="text-white absolute inset-0 m-auto" />
                    )}
                    {adminOnline && <div className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#111B21]" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                     <div className="flex justify-between items-baseline">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{initialChat?.admin?.name || 'Admin'}</p>
                        <span className="text-[10px] text-gray-400">{formatChatDate(chat?.lastMessageAt)}</span>
                     </div>
                     <p className="text-sm text-gray-500 truncate">{chat?.lastMessage || 'Start a conversation'}</p>
                  </div>
               </button>
            </div>
          </>
        )}
        {activeTab === 'status' && (
          <>
            <div className="px-4 py-4 border-b border-[var(--border)]">
               <h2 className="text-xl font-bold dark:text-white">Status</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
               <p className="px-4 py-2 text-xs font-bold text-green-500 uppercase tracking-widest">Admin Updates</p>
                {Object.values(statuses.reduce((acc, s) => {
                  const key = s.userId || 'admin';
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(s);
                  return acc;
                }, {})).map((group, idx) => {
                  const first = group[0];
                  const viewedCount = group.filter(s => s.isViewed).length;
                  const startIndex = statuses.findIndex(s => s.id === first.id);

                  return (
                    <button key={idx} onClick={() => setViewerStatus(startIndex)}
                      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#202C33] rounded-xl transition group">
                      <div className="relative w-12 h-12 flex-shrink-0">
                        <SegmentedCircle count={group.length} viewedCount={viewedCount} size={48} />
                        <div className="absolute inset-0 m-auto w-[40px] h-[40px] rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800">
                          {first.contentType === 'image' ? (
                            <img src={first.mediaUrl} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-500">
                              <CircleDashed size={18} className="text-white"/>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                         <p className="font-semibold dark:text-white truncate group-hover:text-green-500 transition-colors">Administrator</p>
                         <p className="text-xs text-gray-500">{formatChatDate(first.createdAt)}</p>
                      </div>
                    </button>
                  );
                })}
                {statuses.length === 0 && <div className="p-8 text-center text-gray-500 text-sm">No recent updates</div>}
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
                          <span className="text-white text-xs font-bold">EDIT</span>
                        </div>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-lg">{user.name}</p>
                        <p className="text-xs text-gray-500">Click avatar to update</p>
                      </div>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                  </div>
              </div>
           </div>
        )}
      </div>

      {/* 3. MAIN CHAT AREA */}
      <div className={`${(!sidebarOpen && chat && activeTab === 'chats') ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col chat-bg min-w-0 h-full relative`}>
         {chat ? (
           <>
             {/* Chat Header */}
             <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#202C33] border-b border-[var(--border)] z-10 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2A3942] transition" onClick={() => setShowProfile(true)}>
                <button onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }} className="md:hidden p-1 text-gray-500 -ml-1">
                   <ChevronLeft size={24} />
                </button>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-green-600 flex-shrink-0 relative">
                   {chat?.admin?.profilePicture ? <img src={chat.admin.profilePicture} className="w-full h-full object-cover"/> : <MessageSquare size={20} className="text-white absolute inset-0 m-auto" />}
                </div>
                <div className="flex-1 min-w-0">
                   <p className="font-bold dark:text-white text-[15px] leading-tight">{chat?.admin?.name || 'Admin'}</p>
                   <p className="text-[11px] text-gray-500 font-medium">
                      {adminOnline ? <span className="text-green-500 font-bold">Online</span> : ''}
                   </p>
                </div>
             </div>

             {/* Messages Area */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-4 py-4 flex flex-col custom-scrollbar" 
                onScroll={e => {
                  if (e.target.scrollTop > 0) setHasScrolled(true);
                  if (e.target.scrollTop < 100) loadMore();
                }}
              >
                <div className="flex-1" />
                {loadingMore && (
                  <div className="flex justify-center items-center py-4 animate-in fade-in zoom-in duration-300">
                    <div className="spinner-sm" />
                    <span className="ml-2 text-xs text-gray-500 font-medium">Loading history...</span>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const prevMsg = messages[i - 1];
                  const showDate = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
                  return (
                    <div key={msg.id}>
                      {showDate && <DateSeparator date={msg.createdAt} />}
                      <MessageBubble msg={msg} enableObserver={hasScrolled} />
                    </div>
                  );
                })}
                {typing && <TypingIndicator name="Support" />}
                <div ref={bottomRef} className="h-4" />
             </div>

             {/* Blocked Info */}
             {user?.isBlocked && (
                <div className="mx-4 my-2 px-4 py-3 bg-red-100 dark:bg-red-900/40 border-l-4 border-red-500 rounded-lg text-red-700 dark:text-red-300 text-xs font-semibold shadow-sm animate-bounce">
                  System Notice: Your communication privileges have been restricted.
                </div>
             )}

             {/* Input */}
             {!user?.isBlocked && (
                <div onKeyDown={handleTyping} className="p-1">
                   <MessageInput onSend={handleSend} disabled={false} chatId={chat?.id} />
                </div>
             )}
           </>
         ) : (
           <div className="flex-1 flex items-center justify-center p-12 text-center text-gray-500">
              Welcome to Support. Your conversation will appear here.
           </div>
         )}
      </div>

      {/* 4. ADMIN PROFILE PANE */}
      {showProfile && chat && (
        <div className="absolute right-0 top-0 bottom-0 w-full md:w-80 lg:w-96 bg-white dark:bg-[#111B21] border-l border-[var(--border)] z-40 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="flex items-center gap-4 p-4 border-b border-[var(--border)] bg-gray-50 dark:bg-[#202C33]">
            <button onClick={() => setShowProfile(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white"><X size={24} /></button>
            <h2 className="text-lg font-bold dark:text-white">Admin Profile</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
            <div className="w-40 h-40 rounded-full overflow-hidden bg-green-600 border-4 border-white dark:border-[#202C33] shadow-lg mb-6">
              {chat.admin?.profilePicture ? <img src={chat.admin.profilePicture} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-4xl text-white font-bold">{chat.admin?.name?.[0]}</div>}
            </div>
            <h3 className="text-2xl font-bold dark:text-white mb-1">{chat.admin?.name || 'Administrator'}</h3>
            <p className="text-sm text-gray-500 font-medium mb-8">{adminOnline ? 'Online' : ''}</p>
            
            <div className="w-full bg-gray-50 dark:bg-[#202C33] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-left">
               <p className="text-[11px] font-bold text-green-500 uppercase mb-2 tracking-widest">About</p>
               <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{chat.admin?.about || 'Hey there! I am using ChatApp.'}</p>
            </div>
          </div>
        </div>
      )}

      {viewerStatus !== null && (
        <StatusViewer statuses={statuses} startIndex={viewerStatus} onClose={() => setViewerStatus(null)} />
      )}
    </div>
  );
}
