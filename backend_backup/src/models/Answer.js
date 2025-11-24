const pool = require('../config/database');

class Answer {
  // Crear respuesta
  static async create(roundId, playerId, answerText) {
    const query = `
      INSERT INTO answers (round_id, player_id, answer_text, votes)
      VALUES ($1, $2, $3, 0)
      RETURNING *
    `;
    
    const result = await pool.query(query, [roundId, playerId, answerText]);
    return result.rows[0];
  }

  // Verificar si un jugador ya respondió
  static async hasAnswered(roundId, playerId) {
    const query = 'SELECT * FROM answers WHERE round_id = $1 AND player_id = $2';
    const result = await pool.query(query, [roundId, playerId]);
    return result.rows.length > 0;
  }

  // Votar por una respuesta
  static async vote(answerId, playerId, allowSelfVote = false) {
    // Verificar que la respuesta existe
    const answerQuery = await pool.query(
      'SELECT player_id FROM answers WHERE id = $1',
      [answerId]
    );

    if (answerQuery.rows.length === 0) {
      throw new Error('Respuesta no encontrada');
    }

    const answerOwnerId = answerQuery.rows[0].player_id;

    // Verificar que no vote por su propia respuesta (solo si está deshabilitado)
    if (!allowSelfVote && answerOwnerId === playerId) {
      throw new Error('No puedes votar por tu propia respuesta');
    }

    // Verificar que no haya votado ya
    const voteCheckQuery = await pool.query(
      'SELECT * FROM votes WHERE answer_id = $1 AND player_id = $2',
      [answerId, playerId]
    );
    
    if (voteCheckQuery.rows.length > 0) {
      throw new Error('Ya votaste por esta respuesta');
    }

    // Registrar voto
    await pool.query(
      'INSERT INTO votes (answer_id, player_id) VALUES ($1, $2)',
      [answerId, playerId]
    );

    // Incrementar contador de votos
    const updateQuery = `
      UPDATE answers 
      SET votes = votes + 1 
      WHERE id = $1 
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [answerId]);
    return result.rows[0];
  }

  // Contar votos de un jugador en una ronda
  static async countPlayerVotes(roundId, playerId) {
    const query = `
      SELECT COUNT(*) FROM votes v
      JOIN answers a ON v.answer_id = a.id
      WHERE a.round_id = $1 AND v.player_id = $2
    `;
    const result = await pool.query(query, [roundId, playerId]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = Answer;