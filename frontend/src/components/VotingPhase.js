import React, { useState, useEffect } from 'react';
import './VotingPhase.css';

function VotingPhase({ socket, roomCode, round, answers, playerId, isHost, allowSelfVote }) {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [playersVoted, setPlayersVoted] = useState([]);
  const [myAnswerId, setMyAnswerId] = useState(null);

  console.log('🗳️ VotingPhase Props:', { allowSelfVote, playerId, answers });

  useEffect(() => {
    if (!socket || !playerId) return;

    // Buscar mi respuesta en las respuestas
    const myAnswer = answers.find(a => a.playerId === playerId);
    if (myAnswer) {
      console.log('📝 Mi respuesta encontrada:', myAnswer.id, '(allowSelfVote:', allowSelfVote, ')');
      setMyAnswerId(myAnswer.id);
    } else {
      socket.emit('get-my-answer', { roomCode });
    }

    socket.on('my-answer-id', (data) => {
      console.log('📝 Mi respuesta ID del servidor:', data.answerId);
      setMyAnswerId(data.answerId);
    });

    socket.on('player-voted', (data) => {
      setPlayersVoted(prev => [...prev, data.playerId]);
    });

    socket.on('vote-registered', () => {
      // Voto confirmado
    });

    return () => {
      socket.off('my-answer-id');
      socket.off('player-voted');
      socket.off('vote-registered');
    };
  }, [socket, roomCode, playerId, answers, allowSelfVote]);

  const handleVote = (answerId) => {
    if (hasVoted) return;

    if (!allowSelfVote && answerId === myAnswerId) {
      console.log('⚠️ No puedes votar por tu propia respuesta');
      return;
    }

    socket.emit('submit-vote', { roomCode, answerId });
    setHasVoted(true);
    setSelectedAnswer(answerId);
  };

  const handleForceResults = () => {
    socket.emit('force-results', { roomCode });
  };

  if (!round) {
    return <div className="voting-phase"><div className="loading">Cargando...</div></div>;
  }

  return (
    <div className="voting-phase">
      <div className="voting-header">
        <h2>¡Hora de votar!</h2>
        <p className="voting-prompt">{round.prompt}</p>
        {!allowSelfVote && (
          <p className="voting-instruction">Vota por la mejor respuesta (no puedes votar por la tuya)</p>
        )}
        {allowSelfVote && (
          <p className="voting-instruction">Vota por la mejor respuesta</p>
        )}
      </div>

      <div className="answers-grid">
        {answers.map((answer) => {
          const isMyAnswer = answer.id === myAnswerId;
          const isSelected = selectedAnswer === answer.id;
          const cannotVote = !allowSelfVote && isMyAnswer;
          const isDisabled = hasVoted && !isSelected;

          return (
            <button
              key={answer.id}
              className={`answer-card 
                ${isMyAnswer && !allowSelfVote ? 'my-answer' : ''} 
                ${isSelected ? 'selected' : ''} 
                ${cannotVote ? 'cannot-vote' : ''}
                ${isDisabled ? 'disabled' : ''}`}
              onClick={() => handleVote(answer.id)}
              disabled={cannotVote || isDisabled}
            >
              <div className="answer-text">{answer.text}</div>
              {isMyAnswer && !allowSelfVote && (
                <div className="my-answer-badge">Tu respuesta</div>
              )}
              {isSelected && (
                <div className="voted-badge">✓ Votado</div>
              )}
            </button>
          );
        })}
      </div>

      {hasVoted && (
        <div className="waiting-message">
          <p>Voto registrado</p>
          <p className="waiting-text">Esperando a los demás...</p>
          {playersVoted.length > 0 && (
            <p className="voted-count">
              {playersVoted.length} jugador(es) han votado
            </p>
          )}
        </div>
      )}

      {isHost && (
        <button 
          onClick={handleForceResults}
          className="btn btn-force"
        >
          ⚠️ Forzar Resultados
        </button>
      )}
    </div>
  );
}

export default VotingPhase;