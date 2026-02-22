import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuth();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!user) {
      // Disconnect socket when user logs out
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create socket connection (authentication via httpOnly cookie)
    // Use same URL logic as API (same origin in production, localhost in dev)
    const getSocketURL = () => {
      if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
      if (import.meta.env.PROD) return window.location.origin; // Same origin in production
      return 'http://localhost:5000'; // Development fallback
    };
    
    const socketUrl = getSocketURL();
    console.log('Connecting to WebSocket:', socketUrl);
    
    const newSocket = io(socketUrl, {
      withCredentials: true, // Important: Send cookies with socket connection
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
      transports: ['websocket', 'polling'] // Try WebSocket first, fallback to polling
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
      reconnectAttempts.current = 0;
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      reconnectAttempts.current += 1;
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const value = {
    socket,
    connected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
