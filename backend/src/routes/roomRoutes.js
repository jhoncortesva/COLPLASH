const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

// Crear sala con configuraciones
router.post('/create', async (req, res) => {
  try {
    const { hostId, totalRounds = 3, allowSelfVote = false } = req.body;
    
    if (!hostId) {
      return res.status(400).json({ error: 'Se requiere hostId' });
    }

    // Validar totalRounds
    const rounds = parseInt(totalRounds);
    if (isNaN(rounds) || rounds < 1 || rounds > 10) {
      return res.status(400).json({ error: 'El número de rondas debe estar entre 1 y 10' });
    }

    const room = await Room.create(hostId, rounds, allowSelfVote);
    
    res.status(201).json({ 
      room,
      message: 'Sala creada exitosamente'
    });
  } catch (error) {
    console.error('Error al crear sala:', error);
    res.status(500).json({ error: 'Error al crear sala' });
  }
});

// Unirse a sala (verificar si existe)
router.post('/join', async (req, res) => {
  try {
    const { roomCode } = req.body;
    
    if (!roomCode) {
      return res.status(400).json({ error: 'Se requiere código de sala' });
    }

    const room = await Room.findByCode(roomCode.toUpperCase());
    
    if (!room) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    if (room.status !== 'waiting') {
      return res.status(400).json({ error: 'La sala ya comenzó' });
    }

    res.status(200).json({ 
      room,
      message: 'Sala encontrada'
    });
  } catch (error) {
    console.error('Error al unirse a sala:', error);
    res.status(500).json({ error: 'Error al unirse a sala' });
  }
});

module.exports = router;