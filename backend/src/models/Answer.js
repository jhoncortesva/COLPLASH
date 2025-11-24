const pool = require('../config/database');

class Answer {
  // Crear respuesta
  static async create(roundId, playerId, answerText) {
    const query = `
      INSERT INTO answers (round_id, player_id, answer_text)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [roundId, playerId, answerText]);
    return result.rows[0];
  }

  // Verificar si un jugador ya respondió
  static async hasAnswered(roundId, playerId) {
    const query = `
      SELECT COUNT(*) 
      FROM answers 
      WHERE round_id = $1 AND player_id = $2
    `;
    const result = await pool.query(query, [roundId, playerId]);
    return parseInt(result.rows[0].count) > 0;
  }

  // Incrementar votos de una respuesta
  static async incrementVotes(answerId) {
    const query = `
      UPDATE answers 
      SET votes = votes + 1 
      WHERE id = $1 
      RETURNING *
    `;
    const result = await pool.query(query, [answerId]);
    return result.rows[0];
  }

  // Obtener respuesta por ID
  static async findById(answerId) {
    const query = 'SELECT * FROM answers WHERE id = $1';
    const result = await pool.query(query, [answerId]);
    return result.rows[0];
  }

  // Votar por una respuesta (con validación de allowSelfVote)
  static async vote(answerId, playerId, allowSelfVote = false) {
    // Obtener la respuesta
    const answer = await this.findById(answerId);
    
    if (!answer) {
      throw new Error('Respuesta no encontrada');
    }

    // Verificar si está votando por su propia respuesta
    if (answer.player_id === playerId && !allowSelfVote) {
      throw new Error('No puedes votar por tu propia respuesta');
    }

    // Incrementar votos
    return await this.incrementVotes(answerId);
  }

  // Obtener todas las respuestas de una ronda con información del jugador
  static async getByRound(roundId) {
    const query = `
      SELECT a.*, p.nickname as player_nickname
      FROM answers a
      JOIN players p ON a.player_id = p.id
      WHERE a.round_id = $1
      ORDER BY a.id
    `;
    const result = await pool.query(query, [roundId]);
    return result.rows;
  }

  // Obtener respuesta de un jugador en una ronda específica
  static async getByPlayerAndRound(playerId, roundId) {
    const query = `
      SELECT * FROM answers 
      WHERE player_id = $1 AND round_id = $2
    `;
    const result = await pool.query(query, [playerId, roundId]);
    return result.rows[0];
  }
}

module.exports = Answer;