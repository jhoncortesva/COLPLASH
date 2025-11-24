const Room = require('../models/Room');
const Player = require('../models/Player');

const roomController = {
  // Crear sala
  createRoom: async (req, res) => {
    try {
      const { hostId } = req.body;
      
      if (!hostId) {
        return res.status(400).json({ error: 'Se requiere hostId' });
      }

      const room = await Room.create(hostId);
      
      res.status(201).json({
        success: true,
        room: {
          id: room.id,
          code: room.code,
          status: room.status
        }
      });
    } catch (error) {
      console.error('Error creando sala:', error);
      res.status(500).json({ error: 'Error al crear la sala' });
    }
  },

  // Unirse a sala
  joinRoom: async (req, res) => {
    try {
      const { code } = req.params;
      const room = await Room.findByCode(code.toUpperCase());

      if (!room) {
        return res.status(404).json({ error: 'Sala no encontrada' });
      }

      if (room.status !== 'waiting') {
        return res.status(400).json({ error: 'La sala ya comenzó' });
      }

      const playerCount = await Player.countInRoom(room.id);
      
      if (playerCount >= room.max_players) {
        return res.status(400).json({ error: 'Sala llena' });
      }

      res.json({
        success: true,
        room: {
          id: room.id,
          code: room.code,
          status: room.status,
          players: playerCount
        }
      });
    } catch (error) {
      console.error('Error uniéndose a sala:', error);
      res.status(500).json({ error: 'Error al unirse a la sala' });
    }
  },

  // Obtener información de sala
  getRoomInfo: async (req, res) => {
    try {
      const { roomId } = req.params;
      const room = await Room.findByCode(roomId);
      
      if (!room) {
        return res.status(404).json({ error: 'Sala no encontrada' });
      }

      const players = await Room.getPlayers(room.id);

      res.json({
        success: true,
        room: {
          id: room.id,
          code: room.code,
          status: room.status,
          players: players
        }
      });
    } catch (error) {
      console.error('Error obteniendo info de sala:', error);
      res.status(500).json({ error: 'Error al obtener información' });
    }
  }
};

module.exports = roomController;