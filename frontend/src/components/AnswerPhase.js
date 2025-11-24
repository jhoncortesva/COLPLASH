import React, { useState, useEffect } from 'react';
import './AnswerPhase.css';

function AnswerPhase({ socket, roomCode, round, playerId }) {
  const [answer, setAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [playersAnswered, setPlayersAnswered] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('player-answered', (data) => {
      setPlayersAnswered(prev => [...prev, data.playerId]);
    });

    return () => {
      socket.off('player-answered');
    };
  }, [socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!answer.trim() || answer.trim().length < 2) {
      return;
    }

    socket.emit('submit-answer', { roomCode, answer: answer.trim() });
    setHasAnswered(true);
  };

  if (!round) {
    return <div className="answer-phase"><div className="loading">Cargando...</div></div>;
  }

  return (
    <div className="answer-phase">
      <div className="prompt-card">
        <div className="prompt-category">{round.category || 'Pregunta'}</div>
        <h2 className="prompt-text">{round.prompt}</h2>
      </div>

      {!hasAnswered ? (
        <form onSubmit={handleSubmit} className="answer-form">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Escribe tu respuesta aquí..."
            maxLength={200}
            rows={4}
            className="answer-input"
            autoFocus
          />
          <div className="char-count">{answer.length}/200</div>
          
          <button 
            type="submit" 
            className="btn btn-submit"
            disabled={!answer.trim() || answer.trim().length < 2}
          >
            Enviar Respuesta
          </button>
        </form>
      ) : (
        <div className="waiting-message">
          <div className="check-icon">✓</div>
          <p>Respuesta enviada</p>
          <p className="waiting-text">Esperando a los demás...</p>
          {playersAnswered.length > 0 && (
            <p className="answered-count">
              {playersAnswered.length} jugador(es) han respondido
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default AnswerPhase;