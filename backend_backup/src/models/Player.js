const pool = require('../config/database');

class Player {
  // Añadir jugador a sala (con manejo de duplicados)
  static async create(roomId, socketId, nickname, isHost = false) {
    // Primero, eliminar cualquier registro anterior con el mismo socket_id
    await pool.query('DELETE FROM players WHERE socket_id = $1', [socketId]);
    
    const query = `
      INSERT INTO players (room_id, socket_id, nickname, is_host)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [roomId, socketId, nickname, isHost]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Buscar jugador por socket ID
  static async findBySocketId(socketId) {
    const query = 'SELECT * FROM players WHERE socket_id = $1';
    const result = await pool.query(query, [socketId]);
    return result.rows[0];
  }

  // Buscar jugador por nickname y sala (para reconexión)
  static async findByNicknameAndRoom(nickname, roomId) {
    const query = 'SELECT * FROM players WHERE nickname = $1 AND room_id = $2';
    const result = await pool.query(query, [nickname, roomId]);
    return result.rows[0];
  }

  // Actualizar socket_id (reconexión)
  static async updateSocketId(playerId, newSocketId) {
    // Eliminar cualquier otro jugador con este socket_id
    await pool.query('DELETE FROM players WHERE socket_id = $1 AND id != $2', [newSocketId, playerId]);
    
    const query = 'UPDATE players SET socket_id = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [newSocketId, playerId]);
    return result.rows[0];
  }

  // Contar jugadores en sala
  static async countInRoom(roomId) {
    const query = 'SELECT COUNT(*) FROM players WHERE room_id = $1';
    const result = await pool.query(query, [roomId]);
    return parseInt(result.rows[0].count);
  }

  // Eliminar jugador
  static async delete(socketId) {
    const query = 'DELETE FROM players WHERE socket_id = $1 RETURNING *';
    const result = await pool.query(query, [socketId]);
    return result.rows[0];
  }

  // Actualizar puntaje
  static async updateScore(playerId, score) {
    const query = 'UPDATE players SET score = score + $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [score, playerId]);
    return result.rows[0];
  }

  // Marcar jugador como desconectado (sin eliminarlo)
  static async markDisconnected(socketId) {
    const query = 'UPDATE players SET socket_id = $1 WHERE socket_id = $2 RETURNING *';
    const result = await pool.query(query, [`disconnected_${Date.now()}`, socketId]);
    return result.rows[0];
  }
}

module.exports = Player;