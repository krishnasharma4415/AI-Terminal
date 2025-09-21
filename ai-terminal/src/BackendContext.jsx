import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5000';

export const BackendContext = createContext();

export function BackendProvider({ children }) {
  const [backendStatus, setBackendStatus] = useState({
    isConnected: false,
    socketConnected: false,
    aiEnabled: false,
    isChecking: true,
    error: null,
  });
  
  const socketRef = useRef(null);

  const initSocket = () => {
    if (socketRef.current) return;

    console.log('Initializing socket connection to', BACKEND_URL);
    const socket = io(BACKEND_URL, { 
      transports: ['websocket'], 
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setBackendStatus(prev => ({ ...prev, socketConnected: true }));
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setBackendStatus(prev => ({ ...prev, socketConnected: false }));
    });

    socket.on('connection_status', (data) => {
      console.log('Connection status:', data);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setBackendStatus(prev => ({ 
        ...prev, 
        socketConnected: false,
        error: `WebSocket error: ${error.message}`
      }));
    });

    socketRef.current = socket;
  };

  useEffect(() => {
    checkBackendHealth();

    const intervalId = setInterval(checkBackendHealth, 60000);

    return () => {
      clearInterval(intervalId);
      if (socketRef.current) {
        console.log('Closing socket connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const checkBackendHealth = async () => {
    try {
      setBackendStatus(prev => ({ ...prev, isChecking: true }));
      
      const response = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      
      const newStatus = {
        isConnected: true,
        aiEnabled: data.ai_enabled || false,
        isChecking: false,
        error: null,
        system: data.system || 'Unknown',
        version: data.version || '1.0.0',
        socketEnabled: data.websockets_enabled || false,
      };
      
      setBackendStatus(newStatus);
      
      if (newStatus.isConnected && newStatus.socketEnabled && !socketRef.current) {
        initSocket();
      }
      
    } catch (error) {
      console.error('Backend health check failed:', error);
      setBackendStatus({
        isConnected: false,
        aiEnabled: false,
        isChecking: false,
        error: error.message || 'Failed to connect to backend',
      });
    }
  };

  return (
    <BackendContext.Provider value={{ 
      ...backendStatus, 
      checkBackendHealth,
      backendUrl: BACKEND_URL,
      socket: socketRef.current
    }}>
      {children}
    </BackendContext.Provider>
  );
}

export function useBackend() {
  return useContext(BackendContext);
}
