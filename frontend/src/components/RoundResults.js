import React from 'react';
import './RoundResults.css';

function RoundResults({ round, answers, players, isHost, onNextRound }) {
  // Ordenar respuestas por votos (mayor a menor)
  const sortedAnswers = [...answers].sort((a, b) => b.votes - a.votes);

  // Determinar posiciones correctamente (manejar empates)
  let currentPosition = 1;
  const answersWithPosition = sortedAnswers.map((answer, index) => {
    // Si no es el primero y tiene los mismos votos que el anterior
    if (index > 0 && answer.votes === sortedAnswers[index - 1].votes) {
      // Mantener la misma posición
      return { ...answer, position: sortedAnswers[index - 1].position };
    } else {
      // Nueva posición
      const position = currentPosition;
      currentPosition++;
      return { ...answer, position };
    }
  });

  const getMedalEmoji = (position, votes) => {
    // Si no tiene votos, no mostrar medalla
    if (votes === 0) {
      return '-';
    }
    
    switch(position) {
      case 1: return '#1';
      case 2: return '#2';
      case 3: return '#3';
      default: return `#${position}`;
    }
  };

  return (
    <div className="round-results">
      <div className="results-header">
        <h1 className="results-title">
          🏆 Resultados de la Ronda {round.round_number}
        </h1>
        <p className="results-prompt">{round.prompt}</p>
      </div>

      <div className="answers-results">
        {answersWithPosition.map((answer) => {
          const isWinner = answer.position === 1 && answer.votes > 0;
          const hasVotes = answer.votes > 0;
          
          return (
            <div 
              key={answer.id} 
              className={`result-card ${isWinner ? 'winner' : ''} ${hasVotes && answer.position <= 3 ? `position-${answer.position}` : ''} ${!hasVotes ? 'no-votes' : ''}`}
            >
              <div className="result-position">
                {getMedalEmoji(answer.position, answer.votes)}
              </div>

              <div className="result-content">
                <div className="result-player">
                  <span className="player-icon">👤</span>
                  <span className="player-name">{answer.playerNickname}</span>
                  {isWinner && <span className="best-badge">Mejor Respuesta</span>}
                </div>

                <div className="result-answer">
                  {answer.text}
                </div>
              </div>

              <div className="result-votes">
                <div className="votes-icon">👍</div>
                <div className="votes-count">{answer.votes}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="scoreboard-section">
        <h2 className="scoreboard-title">📊 Clasificación General</h2>
        <div className="scoreboard-grid">
          {players
            .sort((a, b) => b.score - a.score)
            .map((player, index) => (
              <div key={player.id} className={`scoreboard-card ${index === 0 ? 'leader' : ''}`}>
                <div className="scoreboard-rank">
                  {index === 0 && '👑'}
                  {index > 0 && `#${index + 1}`}
                </div>
                <div className="scoreboard-info">
                  <div className="scoreboard-name">{player.nickname}</div>
                  <div className="scoreboard-score">{player.score} pts</div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {isHost && (
        <button 
          onClick={onNextRound}
          className="btn btn-next-round"
        >
          SIGUIENTE RONDA ▶
        </button>
      )}

      {!isHost && (
        <div className="waiting-host-message">
          Esperando que el host continúe...
        </div>
      )}
    </div>
  );
}

export default RoundResults;