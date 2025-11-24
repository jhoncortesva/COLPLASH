import React from 'react';
import { useNavigate } from 'react-router-dom';
import './FinalResults.css';

function FinalResults({ players, winner, socket, roomCode, isHost, nickname }) {
  const navigate = useNavigate();

  const handleRestart = () => {
    if (socket && roomCode) {
      console.log('🔄 Reiniciando juego...');
      socket.emit('restart-game', { roomCode });
    }
  };

  const handleExit = () => {
    if (socket && roomCode) {
      console.log('🚪 Saliendo de la sala...');
      socket.emit('leave-room', { roomCode });
    }
    navigate('/', { replace: true });
  };

  // Ordenar jugadores por puntaje (mayor a menor)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="final-results">
      <div className="winner-section">
        <div className="winner-trophy">🏆</div>
        <h1 className="winner-title">¡{winner?.nickname} Gana!</h1>
        <div className="winner-score">{winner?.score} puntos</div>
      </div>

      <div className="final-scoreboard">
        <h2>Tabla Final</h2>
        <div className="scoreboard-list">
          {sortedPlayers.map((player, index) => (
            <div 
              key={player.id} 
              className={`scoreboard-item ${index === 0 ? 'first-place' : ''} ${index === 1 ? 'second-place' : ''} ${index === 2 ? 'third-place' : ''}`}
            >
              <div className="player-rank">
                {index === 0 && '🥇'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
                {index > 2 && `#${index + 1}`}
              </div>
              <div className="player-info">
                <span className="player-name">{player.nickname}</span>
                {player.is_host && <span className="host-badge-small">HOST</span>}
              </div>
              <div className="player-score">{player.score} pts</div>
            </div>
          ))}
        </div>
      </div>

      <div className="final-actions">
        {isHost ? (
          <>
            <button 
              onClick={handleRestart}
              className="btn btn-restart"
            >
              🔄 Jugar de Nuevo
            </button>
            <button 
              onClick={handleExit}
              className="btn btn-exit"
            >
              🚪 Salir
            </button>
          </>
        ) : (
          <>
            <div className="waiting-host-message">
              Esperando que el host decida...
            </div>
            <button 
              onClick={handleExit}
              className="btn btn-exit"
            >
              🚪 Salir
            </button>
          </>
        )}
      </div>

      <div className="game-stats">
        <div className="stat-item">
          <div className="stat-value">{players.length}</div>
          <div className="stat-label">Jugadores</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{sortedPlayers[0]?.score || 0}</div>
          <div className="stat-label">Mayor Puntaje</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{Math.round(sortedPlayers.reduce((sum, p) => sum + p.score, 0) / players.length)}</div>
          <div className="stat-label">Promedio</div>
        </div>
      </div>
    </div>
  );
}

export default FinalResults;