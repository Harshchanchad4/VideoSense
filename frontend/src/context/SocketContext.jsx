import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { createSocket, disconnectSocket } from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (token) {
      const newSocket = createSocket(token);

      newSocket.on('connect', () => {
        setConnected(true);
        console.log('Socket connected:', newSocket.id);
      });

      newSocket.on('disconnect', () => {
        setConnected(false);
        console.log('Socket disconnected');
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        setConnected(false);
      });

      setSocket(newSocket);
    } else {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
    }

    return () => {
      disconnectSocket();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};
