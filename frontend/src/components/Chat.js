import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';

function Chat({ socket, roomCode, playerNickname, onMessageReceived }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
      
      // Reproducir sonido si el chat está cerrado y no es mi mensaje
      if (!isOpen && message.playerNickname !== playerNickname && onMessageReceived) {
        onMessageReceived();
      }
      
      // Incrementar contador si está cerrado
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    });

    return () => {
      socket.off('new-message');
    };
  }, [socket, isOpen, playerNickname, onMessageReceived]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;

    socket.emit('send-message', {
      roomCode,
      message: inputMessage.trim()
    });

    setInputMessage('');
  };

  const toggleChat = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  return (
    <>
      <button 
        className={`chat-toggle ${isOpen ? 'active' : ''}`}
        onClick={toggleChat}
      >
        💬
        {unreadCount > 0 && (
          <span className="chat-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="chat-container">
          <div className="chat-header">
            <h3>💬 Chat de la Sala</h3>
            <button onClick={toggleChat} className="chat-close">✕</button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <span style={{ fontSize: '3rem' }}>💬</span>
                <p>No hay mensajes aún</p>
                <p className="chat-hint">¡Sé el primero en escribir!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`chat-message ${msg.playerNickname === playerNickname ? 'own-message' : ''}`}
                >
                  <div className="message-author">{msg.playerNickname}</div>
                  <div className="message-content">{msg.message}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="chat-input-container">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="chat-input"
              maxLength={200}
            />
            <button 
              type="submit" 
              className="chat-send-btn"
              disabled={!inputMessage.trim()}
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default Chat;