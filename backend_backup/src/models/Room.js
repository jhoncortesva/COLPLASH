const pool = require('../config/database');

class Room {
  // Crear sala con configuraciones
  static async create(hostId, totalRounds = 3, allowSelfVote = false) {
    const code = this.generateCode();
    const query = `
      INSERT INTO rooms (code, host_id, status, total_rounds, allow_self_vote)
      VALUES ($1, $2, 'waiting', $3, $4)
      RETURNING *
    `;
    
    const result = await pool.query(query, [code, hostId, totalRounds, allowSelfVote]);
    return result.rows[0];
  }

  // Generar código aleatorio de 6 caracteres
  static generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Buscar sala por código
  static async findByCode(code) {
    const query = 'SELECT * FROM rooms WHERE code = $1';
    const result = await pool.query(query, [code]);
    return result.rows[0];
  }

  // Obtener jugadores de una sala
  static async getPlayers(roomId) {
    const query = `
      SELECT id, nickname, score, is_host, socket_id
      FROM players
      WHERE room_id = $1
      ORDER BY is_host DESC, id ASC
    `;
    const result = await pool.query(query, [roomId]);
    return result.rows;
  }

  // Actualizar estado de sala
  static async updateStatus(roomId, status) {
    const query = 'UPDATE rooms SET status = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [status, roomId]);
    return result.rows[0];
  }

  // Eliminar sala
  static async delete(roomId) {
    const query = 'DELETE FROM rooms WHERE id = $1';
    await pool.query(query, [roomId]);
  }

  // Verificar si se puede iniciar el juego
  static async canStartGame(roomId) {
    const playerCount = await Player.countInRoom(roomId);
    const MIN_PLAYERS = 3;
    return playerCount >= MIN_PLAYERS;
  }

  // Obtener configuraciones de la sala
  static async getSettings(roomId) {
    const query = 'SELECT total_rounds, allow_self_vote FROM rooms WHERE id = $1';
    const result = await pool.query(query, [roomId]);
    return result.rows[0];
  }

  // Reiniciar sala para jugar de nuevo
  static async restart(roomId) {
    // Reiniciar estado de la sala
    await pool.query('UPDATE rooms SET status = $1 WHERE id = $2', ['waiting', roomId]);
    
    // Reiniciar puntajes de jugadores
    await pool.query('UPDATE players SET score = 0 WHERE room_id = $1', [roomId]);
    
    console.log(`🔄 Sala ${roomId} reiniciada`);
  }
}

// Importar Player al final para evitar dependencia circular
const Player = require('./Player');

module.exports = Room;