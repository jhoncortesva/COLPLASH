const pool = require('../config/database');

class Player {
  // Crear jugador
  static async create(roomId, socketId, nickname, isHost = false) {
    const query = `
      INSERT INTO players (room_id, socket_id, nickname, is_host)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [roomId, socketId, nickname, isHost]);
    return result.rows[0];
  }

  // Buscar jugador por socket_id
  static async findBySocketId(socketId) {
    const query = 'SELECT * FROM players WHERE socket_id = $1';
    const result = await pool.query(query, [socketId]);
    return result.rows[0];
  }

  // Buscar jugador por ID
  static async findById(playerId) {
    const query = 'SELECT * FROM players WHERE id = $1';
    const result = await pool.query(query, [playerId]);
    return result.rows[0];
  }

  // Obtener todos los jugadores de una sala
  static async findByRoom(roomId) {
    const query = `
      SELECT id, nickname, score, is_host, socket_id
      FROM players
      WHERE room_id = $1
      ORDER BY is_host DESC, id ASC
    `;
    const result = await pool.query(query, [roomId]);
    return result.rows;
  }

  // Actualizar socket_id de un jugador (para reconexión)
  static async updateSocketId(playerId, newSocketId) {
    const query = 'UPDATE players SET socket_id = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [newSocketId, playerId]);
    return result.rows[0];
  }

  // Actualizar puntuación
  static async updateScore(playerId, points) {
    const query = `
      UPDATE players 
      SET score = score + $1 
      WHERE id = $2 
      RETURNING *
    `;
    const result = await pool.query(query, [points, playerId]);
    return result.rows[0];
  }

  // Eliminar jugador
  static async delete(playerId) {
    const query = 'DELETE FROM players WHERE id = $1';
    await pool.query(query, [playerId]);
  }

  // Eliminar jugadores de una sala
  static async deleteByRoom(roomId) {
    const query = 'DELETE FROM players WHERE room_id = $1';
    await pool.query(query, [roomId]);
  }

  // Contar jugadores en una sala
  static async countInRoom(roomId) {
    const query = 'SELECT COUNT(*) FROM players WHERE room_id = $1';
    const result = await pool.query(query, [roomId]);
    return parseInt(result.rows[0].count);
  }

  // Buscar host de una sala
  static async findHostByRoom(roomId) {
    const query = 'SELECT * FROM players WHERE room_id = $1 AND is_host = true';
    const result = await pool.query(query, [roomId]);
    return result.rows[0];
  }

  // Promover jugador a host
  static async promoteToHost(playerId) {
    const query = 'UPDATE players SET is_host = true WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [playerId]);
    return result.rows[0];
  }

  // Reiniciar puntajes de una sala
  static async resetScores(roomId) {
    const query = 'UPDATE players SET score = 0 WHERE room_id = $1';
    await pool.query(query, [roomId]);
  }

  // Buscar jugador por room_id y socket_id
  static async findByRoomAndSocket(roomId, socketId) {
    const query = 'SELECT * FROM players WHERE room_id = $1 AND socket_id = $2';
    const result = await pool.query(query, [roomId, socketId]);
    return result.rows[0];
  }
}

module.exports = Player;