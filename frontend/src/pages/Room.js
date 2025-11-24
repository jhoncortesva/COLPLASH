import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useGameAudio } from '../hooks/useGameAudio';
import Chat from '../components/Chat';
import AnswerPhase from '../components/AnswerPhase';
import VotingPhase from '../components/VotingPhase';
import RoundResults from '../components/RoundResults';
import FinalResults from '../components/FinalResults';
import './Room.css';

function Room() {
  const location = useLocation();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const { 
    playLobbyMusic, 
    playAnsweringMusic, 
    playVotingMusic, 
    playResultsMusic, 
    stopAllMusic, 
    playMessageNotification, 
    toggleMute, 
    isMuted 
  } = useGameAudio();
  
  const [players, setPlayers] = useState([]);
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [error, setError] = useState('');
  const hasJoinedRef = useRef(false);

  const [gamePhase, setGamePhase] = useState('waiting');
  const [currentRound, setCurrentRound] = useState(null);
  const [roundNumber, setRoundNumber] = useState(0);
  const [totalRounds, setTotalRounds] = useState(3);
  const [allowSelfVote, setAllowSelfVote] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [winner, setWinner] = useState(null);

  const { roomCode: initialRoomCode, nickname, playerId: initialPlayerId, isHost: initialIsHost, skipJoin } = location.state || {};

  const handleLeaveRoom = () => {
    if (socket && roomCode) {
      console.log('🚪 Saliendo de la sala...');
      socket.emit('leave-room', { roomCode });
    }
    stopAllMusic();
    navigate('/', { replace: true });
  };

  // Efecto para cambiar música según la fase
  useEffect(() => {
    if (!roomCode) {
      document.title = 'COLPLASH';
      return;
    }

    switch (gamePhase) {
      case 'waiting':
        document.title = `Sala: ${roomCode}`;
        playLobbyMusic();
        break;
      case 'answering':
        document.title = '✏️ Responde';
        playAnsweringMusic();
        break;
      case 'voting':
        document.title = '🗳️ Hora de Votar';
        playVotingMusic();
        break;
      case 'results':
        document.title = '🏆 Resultados';
        playResultsMusic();
        break;
      case 'final':
        document.title = '🎉 ¡Juego Terminado!';
        playResultsMusic(); // Usa la misma música que results
        break;
      default:
        document.title = 'COLPLASH';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, roomCode]);

  // Cleanup al desmontar componente
  useEffect(() => {
    return () => {
      stopAllMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialRoomCode || !nickname) {
      navigate('/', { replace: true });
      return;
    }

    if (!socket || !connected || hasJoinedRef.current) return;

    console.log('🔌 Unirse a sala:', { initialRoomCode, nickname, skipJoin });
    
    setRoomCode(initialRoomCode);
    hasJoinedRef.current = true;

    if (skipJoin) {
      console.log('⏭️ Host creado, saltando join-room');
      
      if (initialPlayerId) {
        setPlayerId(initialPlayerId);
      }
      if (initialIsHost !== undefined) {
        setIsHost(initialIsHost);
      }
      
      return;
    }

    console.log('🔌 Emitiendo join-room:', initialRoomCode);
    socket.emit('join-room', { roomCode: initialRoomCode, nickname });

  }, [socket, connected, initialRoomCode, nickname, skipJoin, initialPlayerId, initialIsHost, navigate]);

  useEffect(() => {
    if (!socket) return;

    console.log('👂 Registrando listeners');

    socket.on('joined-successfully', (data) => {
      console.log('✅ [RECIBIDO] joined-successfully:', data);
      setPlayerId(data.playerId);
      setIsHost(data.isHost);
      setPlayers(data.players);
      setRoomCode(data.roomCode);
      setTotalRounds(data.totalRounds || 3);
      setAllowSelfVote(data.allowSelfVote || false);

      if (data.gameStarted && data.currentRound) {
        console.log('🔄 Reconectando a juego en curso...');
        setGameStarted(true);
        setCurrentRound(data.currentRound);
        setRoundNumber(data.roundNumber || data.currentRound.round_number);

        if (data.currentRound.status === 'answering') {
          setGamePhase('answering');
        } else if (data.currentRound.status === 'voting') {
          setGamePhase('voting');
          if (data.answers) {
            setAnswers(data.answers);
          }
        } else if (data.currentRound.status === 'results') {
          setGamePhase('results');
          if (data.answers) {
            setAnswers(data.answers);
          }
        }

        console.log('✅ Reconectado a fase:', data.currentRound.status);
      }
    });

    socket.on('player-joined', (data) => {
      console.log('👤 [RECIBIDO] player-joined:', data);
      setPlayers(data.players);
      
      if (!playerId && data.players && data.players.length > 0 && nickname) {
        const me = data.players.find(p => p.nickname === nickname);
        if (me) {
          setPlayerId(me.id);
          setIsHost(me.is_host);
        }
      }
    });

    socket.on('player-left', (data) => {
      console.log('👋 [RECIBIDO] player-left:', data);
      setPlayers(data.players);
    });

    socket.on('player-disconnected', (data) => {
      console.log('⏸️ [RECIBIDO] player-disconnected:', data);
      setError(`${data.nickname} se desconectó`);
      setTimeout(() => setError(''), 3000);
    });

    socket.on('player-removed', (data) => {
      console.log('❌ [RECIBIDO] player-removed:', data);
      setPlayers(data.players);
      setError(data.message);
      setTimeout(() => setError(''), 5000);
    });

    socket.on('new-host', (data) => {
      console.log('👑 [RECIBIDO] new-host:', data);
      if (data.hostId === playerId) {
        setIsHost(true);
      }
    });

    socket.on('game-started', (data) => {
      console.log('🎮 [RECIBIDO] game-started:', data);
      setGameStarted(true);
      setGamePhase('answering');
      setCurrentRound(data.round);
      setRoundNumber(data.roundNumber);
      setTotalRounds(data.totalRounds || 3);
      setAllowSelfVote(data.allowSelfVote || false);
    });

    socket.on('start-voting', (data) => {
      console.log('🗳️ [RECIBIDO] start-voting:', data);
      setGamePhase('voting');
      setCurrentRound(data.round);
      setAnswers(data.answers);
      setAllowSelfVote(data.allowSelfVote || false);
    });

    socket.on('show-results', (data) => {
      console.log('🏆 [RECIBIDO] show-results:', data);
      setGamePhase('results');
      setAnswers(data.answers);
      setPlayers(data.players);
    });

    socket.on('new-round', (data) => {
      console.log('▶️ [RECIBIDO] new-round:', data);
      setGamePhase('answering');
      setCurrentRound(data.round);
      setRoundNumber(data.roundNumber);
      setAnswers([]);
    });

    socket.on('game-ended', (data) => {
      console.log('🎉 [RECIBIDO] game-ended:', data);
      setGamePhase('final');
      setPlayers(data.players);
      setWinner(data.winner);
    });

    socket.on('game-restarted', (data) => {
      console.log('🔄 [RECIBIDO] game-restarted:', data);
      setGamePhase('waiting');
      setGameStarted(false);
      setPlayers(data.players);
      setRoundNumber(0);
      setCurrentRound(null);
      setAnswers([]);
      setWinner(null);
    });

    socket.on('error', (data) => {
      console.error('❌ [RECIBIDO] error:', data);
      setError(data.message);
      setTimeout(() => setError(''), 5000);
    });

    return () => {
      console.log('🧹 Removiendo listeners');
      socket.off('joined-successfully');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('player-disconnected');
      socket.off('player-removed');
      socket.off('new-host');
      socket.off('game-started');
      socket.off('start-voting');
      socket.off('show-results');
      socket.off('new-round');
      socket.off('game-ended');
      socket.off('game-restarted');
      socket.off('error');
    };
  }, [socket, playerId, nickname]);

  const handleStartGame = () => {
    if (players.length < 3) {
      setError('Se necesitan al menos 3 jugadores para iniciar');
      setTimeout(() => setError(''), 3000);
      return;
    }
    socket.emit('start-game', { roomCode });
  };

  const handleNextRound = () => {
    socket.emit('next-round', { roomCode });
  };

  if (!connected) {
    return (
      <div className="room-container">
        <div className="loading">Conectando al servidor...</div>
      </div>
    );
  }

  const renderGameContent = () => {
    switch (gamePhase) {
      case 'waiting':
        return (
          <div className="room-card">
            <div className="room-header">
              <h1>Sala: {roomCode}</h1>
              <div className="room-status">
                <span className="status-indicator"></span>
                Esperando jugadores
              </div>
            </div>

            <div className="players-section">
              <h2>Jugadores ({players.length})</h2>
              <div className="players-list">
                {players.length === 0 ? (
                  <div className="no-players">Cargando jugadores...</div>
                ) : (
                  players.map((player) => (
                    <div key={player.id} className="player-item">
                      <span className="player-name">
                        {player.nickname}
                        {player.id === playerId && ' (Tú)'}
                      </span>
                      {player.is_host && <span className="host-badge">HOST</span>}
                    </div>
                  ))
                )}
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="room-actions">
              {isHost ? (
                <>
                  <button 
                    onClick={handleStartGame}
                    className="btn btn-start"
                    disabled={players.length < 3}
                  >
                    {players.length < 3 
                      ? `Se necesitan ${3 - players.length} jugador(es) más` 
                      : 'Iniciar Juego'}
                  </button>
                  {players.length < 3 && roomCode && (
                    <p className="hint-text">
                      💡 Comparte el código <strong>{roomCode}</strong> con tus amigos
                    </p>
                  )}
                </>
              ) : (
                <div className="waiting-message">
                  Esperando que el host inicie el juego...
                </div>
              )}
            </div>

            <button 
              onClick={handleLeaveRoom}
              className="btn btn-leave"
            >
              Salir de la Sala
            </button>
          </div>
        );

      case 'answering':
        return (
          <div className="game-container">
            <div className="game-header">
              <div className="game-info">
                <span className="room-code-small">Sala: {roomCode}</span>
                <span className="round-info-small">Ronda {roundNumber}/{totalRounds}</span>
              </div>
            </div>
            <AnswerPhase
              socket={socket}
              roomCode={roomCode}
              round={currentRound}
              playerId={playerId}
            />
          </div>
        );

      case 'voting':
        return (
          <div className="game-container">
            <div className="game-header">
              <div className="game-info">
                <span className="room-code-small">Sala: {roomCode}</span>
                <span className="round-info-small">Ronda {roundNumber}/{totalRounds}</span>
              </div>
            </div>
            <VotingPhase
              socket={socket}
              roomCode={roomCode}
              round={currentRound}
              answers={answers}
              playerId={playerId}
              isHost={isHost}
              allowSelfVote={allowSelfVote}
            />
          </div>
        );

      case 'results':
        return (
          <div className="game-container">
            <div className="game-header">
              <div className="game-info">
                <span className="room-code-small">Sala: {roomCode}</span>
                <span className="round-info-small">Ronda {roundNumber}/{totalRounds}</span>
              </div>
            </div>
            <RoundResults
              round={currentRound}
              answers={answers}
              players={players}
              isHost={isHost}
              onNextRound={handleNextRound}
            />
          </div>
        );

      case 'final':
        return (
          <div className="game-container">
            <FinalResults
              players={players}
              winner={winner}
              socket={socket}
              roomCode={roomCode}
              isHost={isHost}
              playerId={playerId}
              nickname={nickname}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="room-container">
      {renderGameContent()}

      {socket && roomCode && nickname && (
        <Chat 
          socket={socket} 
          roomCode={roomCode} 
          playerNickname={nickname}
          onMessageReceived={playMessageNotification}
        />
      )}

      {error && gamePhase !== 'waiting' && (
        <div className="error-toast">
          {error}
        </div>
      )}

      {/* Botón para mutear/desmutear */}
      <button 
        className="mute-button"
        onClick={toggleMute}
        title={isMuted ? 'Activar sonido' : 'Silenciar'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}

export default Room;