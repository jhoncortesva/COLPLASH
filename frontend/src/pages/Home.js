import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import './Home.css';

function Home() {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Estados para configuración de sala
  const [showSettings, setShowSettings] = useState(false);
  const [totalRounds, setTotalRounds] = useState(3);
  const [allowSelfVote, setAllowSelfVote] = useState(false);
  
  const navigate = useNavigate();
  const { socket } = useSocket();
  const hasEmittedRef = useRef(false);

  // Cambiar título de la pestaña
  useEffect(() => {
    document.title = 'COLPLASH';
  }, []);

  // Limpiar listeners cuando se desmonta el componente
  useEffect(() => {
    return () => {
      if (socket) {
        socket.off('room-created');
        socket.off('error');
      }
    };
  }, [socket]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    
    // Evitar múltiples clicks
    if (isCreating || hasEmittedRef.current) {
      console.log('⚠️ Ya se está creando una sala');
      return;
    }
    
    if (!nickname.trim()) {
      setError('Por favor ingresa tu nombre');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (nickname.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (nickname.trim().length > 20) {
      setError('El nombre debe tener máximo 20 caracteres');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!socket) {
      setError('Error de conexión. Recarga la página.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setIsCreating(true);
    hasEmittedRef.current = true;

    console.log('🎮 Creando sala...');

    // Limpiar listeners previos
    socket.off('room-created');
    socket.off('error');

    // Configurar listeners ANTES de emitir
    socket.once('room-created', (data) => {
      console.log('✅ Sala creada:', data);
      setIsCreating(false);
      hasEmittedRef.current = false;
      
      // Navegar a la sala
      navigate('/room', { 
        state: { 
          roomCode: data.roomCode, 
          nickname: nickname.trim(),
          playerId: data.playerId,
          isHost: true,
          skipJoin: true
        },
        replace: true
      });
    });

    socket.once('error', (data) => {
      console.error('❌ Error:', data.message);
      setError(data.message);
      setIsCreating(false);
      hasEmittedRef.current = false;
      setTimeout(() => setError(''), 3000);
    });

    // Emitir evento
    socket.emit('create-room', { 
      nickname: nickname.trim(),
      totalRounds,
      allowSelfVote
    });
    
    console.log('📤 Evento create-room emitido');
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    
    if (!nickname.trim()) {
      setError('Por favor ingresa tu nombre');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!roomCode.trim()) {
      setError('Por favor ingresa el código de sala');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (roomCode.trim().length !== 6) {
      setError('El código debe tener 6 caracteres');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (nickname.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (nickname.trim().length > 20) {
      setError('El nombre debe tener máximo 20 caracteres');
      setTimeout(() => setError(''), 3000);
      return;
    }

    navigate('/room', { 
      state: { 
        roomCode: roomCode.trim().toUpperCase(), 
        nickname: nickname.trim(),
        skipJoin: false
      },
      replace: true
    });
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <h1 className="game-title">🎮 COLPLASH</h1>
        <p className="game-subtitle">¡El juego de respuestas más divertido!</p>

        {error && <div className="error-message">{error}</div>}

        <form className="home-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label htmlFor="nickname">Tu Nombre</label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Escribe tu nombre"
              maxLength={20}
              autoComplete="off"
              disabled={isCreating}
            />
          </div>

          <div className="button-group">
            <button 
              type="button" 
              onClick={() => setShowSettings(!showSettings)}
              className="btn btn-settings"
              disabled={isCreating}
            >
              ⚙️ Configuración de sala
            </button>

            {showSettings && (
              <div className="settings-panel">
                <div className="setting-item">
                  <label htmlFor="totalRounds">Número de rondas:</label>
                  <select 
                    id="totalRounds"
                    value={totalRounds} 
                    onChange={(e) => setTotalRounds(parseInt(e.target.value))}
                  >
                    <option value="1">1 ronda</option>
                    <option value="3">3 rondas</option>
                    <option value="5">5 rondas</option>
                    <option value="7">7 rondas</option>
                    <option value="10">10 rondas</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label htmlFor="allowSelfVote">
                    <input 
                      type="checkbox" 
                      id="allowSelfVote"
                      checked={allowSelfVote}
                      onChange={(e) => setAllowSelfVote(e.target.checked)}
                    />
                    Permitir votar por tu propia respuesta
                  </label>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              onClick={handleCreateRoom}
              className="btn btn-create"
              disabled={isCreating}
            >
              {isCreating ? 'Creando...' : 'Crear Sala'}
            </button>
          </div>

          <div className="divider">
            <span>O</span>
          </div>

          <div className="form-group">
            <label htmlFor="roomCode">Código de Sala</label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Ej: ABC123"
              maxLength={6}
              autoComplete="off"
              disabled={isCreating}
            />
          </div>

          <button 
            type="submit" 
            onClick={handleJoinRoom}
            className="btn btn-join"
            disabled={isCreating}
          >
            Unirse a Sala
          </button>
        </form>
      </div>
    </div>
  );
}

export default Home;