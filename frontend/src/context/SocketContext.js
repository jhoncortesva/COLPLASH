import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

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
  const socketRef = useRef(null);

  useEffect(() => {
    // Evitar crear múltiples sockets
    if (socketRef.current) {
      return;
    }

    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
    
    console.log('🔌 Conectando a:', SOCKET_URL);
    
    // Crear conexión al servidor
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;

    // Eventos de conexión
    newSocket.on('connect', () => {
      console.log('✅ Socket conectado:', newSocket.id);
      setSocket(newSocket);
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket desconectado:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('💥 Error de conexión:', error);
      setConnected(false);
    });

    // Cleanup
    return () => {
      console.log('🧹 Cerrando socket');
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};