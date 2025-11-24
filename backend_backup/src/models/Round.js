const pool = require('../config/database');

class Round {
  // Crear nueva ronda
  static async create(roomId, roundNumber, promptId) {
    const query = `
      INSERT INTO rounds (room_id, round_number, prompt_id, status)
      VALUES ($1, $2, $3, 'answering')
      RETURNING *
    `;
    
    const result = await pool.query(query, [roomId, roundNumber, promptId]);
    const round = result.rows[0];
    
    // Obtener el texto del prompt
    const promptQuery = await pool.query(
      'SELECT prompt_text FROM prompts WHERE id = $1',
      [promptId]
    );
    
    // Agregar el texto del prompt al objeto de la ronda
    round.prompt = promptQuery.rows[0].prompt_text;
    
    return round;
  }

  // Obtener ronda actual de una sala
  static async getCurrentRound(roomId) {
    const query = `
      SELECT r.*, p.prompt_text as prompt
      FROM rounds r
      JOIN prompts p ON r.prompt_id = p.id
      WHERE r.room_id = $1
      ORDER BY r.round_number DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [roomId]);
    return result.rows[0];
  }

  // Actualizar estado de ronda
  static async updateStatus(roundId, status) {
    const query = 'UPDATE rounds SET status = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [status, roundId]);
    return result.rows[0];
  }

  // Obtener respuestas de una ronda
  static async getAnswers(roundId) {
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

  // Contar respuestas de una ronda
  static async countAnswers(roundId) {
    const query = 'SELECT COUNT(*) FROM answers WHERE round_id = $1';
    const result = await pool.query(query, [roundId]);
    return parseInt(result.rows[0].count);
  }

  // Obtener prompt aleatorio
  static async getRandomPrompt() {
    const query = 'SELECT * FROM prompts ORDER BY RANDOM() LIMIT 1';
    const result = await pool.query(query);
    return result.rows[0];
  }

  // Obtener todos los prompts
  static async getAllPrompts() {
    const query = 'SELECT * FROM prompts';
    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = Round;