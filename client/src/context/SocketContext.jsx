import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { setupPushNotifications } from '../utils/push.js';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, logout }                  = useAuth();
  const socketRef                          = useRef(null);
  const [isConnected, setIsConnected]      = useState(false);
  const [onlineUsers, setOnlineUsers]      = useState(new Set());

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const token = localStorage.getItem('token');
    // Connect to the base URL (Vite proxy handles /socket.io)
    // Use relative URL for development, absolute for production
    const socketUrl = import.meta.env.DEV ? '/' : 'https://api.chatyapp.online';
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected:', socket.id, 'URL:', socketUrl);
      // Register push subscription once the socket (and therefore auth) is confirmed
      setupPushNotifications().catch(e => console.warn('[Push] setup error:', e));
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection Error:', error.message);
    });

    socket.on('user-online', ({ userId }) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    });

    socket.on('user-offline', ({ userId }) => {
      setOnlineUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
    });

    socket.on('admin-online', () => {
      setOnlineUsers(prev => new Set([...prev, 'admin']));
    });

    socket.on('force-logout', ({ reason }) => {
      alert(reason || 'You have been logged out because your account is active on another device.');
      logout();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const emit = useCallback((event, data, ack) => {
    if (!socketRef.current) return console.warn('[Socket] Emit failed: no socket instance');
    socketRef.current.emit(event, data, ack);
  }, []);

  // Updated 'on' to be more resilient
  const on = useCallback((event, handler) => {
    const s = socketRef.current;
    if (s) {
      s.on(event, handler);
      return () => s.off(event, handler);
    }
    // Fallback if called before socket is ready: return no-op
    return () => {};
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  const value = useMemo(() => ({
    socket: socketRef.current,
    isConnected,
    onlineUsers,
    emit,
    on,
    off
  }), [isConnected, onlineUsers, emit, on, off]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
