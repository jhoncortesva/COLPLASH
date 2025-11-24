const pool = require('../config/database');

class Vote {
  // Registrar un voto
  static async create(answerId, playerId) {
    const query = `
      INSERT INTO votes (answer_id, player_id)
      VALUES ($1, $2)
      ON CONFLICT (answer_id, player_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [answerId, playerId]);
    return result.rows[0];
  }

  // Verificar si un jugador ya votó en una ronda
  static async hasVoted(roundId, playerId) {
    const query = `
      SELECT COUNT(*) 
      FROM votes v
      JOIN answers a ON v.answer_id = a.id
      WHERE a.round_id = $1 AND v.player_id = $2
    `;
    const result = await pool.query(query, [roundId, playerId]);
    return parseInt(result.rows[0].count) > 0;
  }

  // Contar votos de una respuesta
  static async countByAnswer(answerId) {
    const query = 'SELECT COUNT(*) FROM votes WHERE answer_id = $1';
    const result = await pool.query(query, [answerId]);
    return parseInt(result.rows[0].count);
  }

  // Obtener todos los votos de una ronda
  static async getByRound(roundId) {
    const query = `
      SELECT v.*, a.answer_text, p.nickname as voter_nickname
      FROM votes v
      JOIN answers a ON v.answer_id = a.id
      JOIN players p ON v.player_id = p.id
      WHERE a.round_id = $1
    `;
    const result = await pool.query(query, [roundId]);
    return result.rows;
  }
}

module.exports = Vote;