const Room = require('../models/Room');
const Player = require('../models/Player');
const Round = require('../models/Round');
const Answer = require('../models/Answer');
const Vote = require('../models/Vote');

// Mapa para timeouts activos
const activeTimeouts = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);

    // === CREAR SALA ===
    socket.on('create-room', async (data) => {
      try {
        console.log('📥 [CREATE-ROOM] Evento recibido:', data);
        console.log('📥 [CREATE-ROOM] Socket ID:', socket.id);
        
        const { nickname, totalRounds = 3, allowSelfVote = false } = data;

        if (!nickname) {
          socket.emit('error', { message: 'Nombre requerido' });
          return;
        }

        // Crear sala
        const room = await Room.create(socket.id, totalRounds, allowSelfVote);
        console.log('🎲 Sala creada:', room.code);

        // Crear jugador host
        const player = await Player.create(room.id, socket.id, nickname, true);
        console.log('👤 Host creado:', player.nickname);

        // Unirse a la sala de Socket.IO
        socket.join(room.code);

        // Emitir evento de sala creada
        socket.emit('room-created', { 
          roomCode: room.code,
          playerId: player.id,
          isHost: true
        });

        console.log('✅ Sala creada exitosamente:', room.code);
      } catch (error) {
        console.error('💥 Error en create-room:', error);
        socket.emit('error', { message: 'Error al crear sala' });
      }
    });

    // === UNIRSE A SALA ===
    socket.on('join-room', async (data) => {
      try {
        console.log('📥 [JOIN-ROOM] Evento recibido:', data);
        
        const { roomCode, nickname } = data;

        if (!roomCode || !nickname) {
          socket.emit('error', { message: 'Código de sala y nombre requeridos' });
          return;
        }

        // Buscar sala
        const room = await Room.findByCode(roomCode);
        if (!room) {
          socket.emit('error', { message: 'Sala no encontrada' });
          return;
        }

        // Verificar si la sala está llena (máximo 8 jugadores)
        const currentPlayers = await Player.findByRoom(room.id);
        if (currentPlayers.length >= 8) {
          socket.emit('error', { message: 'La sala está llena' });
          return;
        }

        // Verificar si el jugador ya está en la sala (reconexión)
        let player = await Player.findBySocketId(socket.id);
        
        if (!player) {
          // Crear nuevo jugador
          player = await Player.create(room.id, socket.id, nickname, false);
          console.log('👤 Jugador creado:', player.nickname);
        } else {
          // Actualizar socket_id del jugador existente
          await Player.updateSocketId(player.id, socket.id);
          console.log('🔄 Jugador reconectado:', player.nickname);
        }

        // Unirse a la sala de Socket.IO
        socket.join(roomCode);

        // Obtener todos los jugadores
        const players = await Player.findByRoom(room.id);

        // Emitir a todos en la sala que un jugador se unió
        io.to(roomCode).emit('player-joined', {
          players: players.map(p => ({
            id: p.id,
            nickname: p.nickname,
            is_host: p.is_host,
            score: p.score
          }))
        });

        // Emitir al jugador que se unió exitosamente
        socket.emit('joined-successfully', {
          playerId: player.id,
          isHost: player.is_host,
          roomCode: room.code,
          players: players.map(p => ({
            id: p.id,
            nickname: p.nickname,
            is_host: p.is_host,
            score: p.score
          })),
          totalRounds: room.total_rounds,
          allowSelfVote: room.allow_self_vote
        });

        console.log('✅ Jugador unido a sala:', roomCode);
      } catch (error) {
        console.error('💥 Error en join-room:', error);
        socket.emit('error', { message: 'Error al unirse a la sala' });
      }
    });

    // === RESTO DEL CÓDIGO... ===
    // (mantén todo lo demás igual)

    // Iniciar juego
    socket.on('start-game', async (data) => {
      try {
        const { roomCode } = data;
        console.log(`🎮 Solicitud de inicio de juego en sala: ${roomCode}`);
        
        const player = await Player.findBySocketId(socket.id);

        if (!player || !player.is_host) {
          console.log('❌ Solo el host puede iniciar el juego');
          socket.emit('error', { message: 'Solo el host puede iniciar el juego' });
          return;
        }

        const room = await Room.findByCode(roomCode);
        const playerCount = await Player.countInRoom(room.id);

        // Verificar que haya al menos 3 jugadores
        if (playerCount < 3) {
          console.log(`❌ Se necesitan al menos 3 jugadores (hay ${playerCount})`);
          socket.emit('error', { message: 'Se necesitan al menos 3 jugadores para iniciar' });
          return;
        }

        await Room.updateStatus(room.id, 'playing');

        // Crear primera ronda
        const randomPrompt = await Round.getRandomPrompt();
        const firstRound = await Round.create(room.id, 1, randomPrompt.id);

        io.to(roomCode).emit('game-started', {
          message: 'El juego ha comenzado!',
          round: firstRound,
          roundNumber: 1,
          totalRounds: room.total_rounds,
          allowSelfVote: room.allow_self_vote
        });

        console.log(`🎮 Juego iniciado en sala ${roomCode} con ${playerCount} jugadores (${room.total_rounds} rondas, allowSelfVote: ${room.allow_self_vote})`);

        // Establecer timeout de 60 segundos para auto-respuestas
        const timeoutId = setTimeout(async () => {
          await autoCompleteAnswers(roomCode, room.id, firstRound.id, io);
          activeTimeouts.delete(`${room.id}_${firstRound.id}`);
        }, 60000);
        
        // Guardar el timeout para poder cancelarlo si es necesario
        activeTimeouts.set(`${room.id}_${firstRound.id}`, timeoutId);
        console.log(`⏰ Timer de 60s iniciado para ronda ${firstRound.id}`);

      } catch (error) {
        console.error('💥 Error en start-game:', error);
        socket.emit('error', { message: 'Error al iniciar el juego' });
      }
    });

    // === FASE 1: RESPONDER ===
    socket.on('submit-answer', async (data) => {
      try {
        const { roomCode, answer } = data;
        const player = await Player.findBySocketId(socket.id);

        if (!player) {
          socket.emit('error', { message: 'Jugador no encontrado' });
          return;
        }

        const room = await Room.findByCode(roomCode);
        const currentRound = await Round.getCurrentRound(room.id);

        if (!currentRound || currentRound.status !== 'answering') {
          socket.emit('error', { message: 'No hay ronda activa' });
          return;
        }

        // Verificar si ya respondió
        const hasAnswered = await Answer.hasAnswered(currentRound.id, player.id);
        if (hasAnswered) {
          socket.emit('error', { message: 'Ya enviaste tu respuesta' });
          return;
        }

        // Guardar respuesta
        await Answer.create(currentRound.id, player.id, answer.trim());

        // Notificar que el jugador respondió
        io.to(roomCode).emit('player-answered', {
          playerId: player.id,
          nickname: player.nickname
        });

        // Verificar si todos respondieron
        const totalPlayers = await Player.countInRoom(room.id);
        const totalAnswers = await Round.countAnswers(currentRound.id);

        console.log(`📝 ${player.nickname} respondió. ${totalAnswers}/${totalPlayers}`);

        if (totalAnswers === totalPlayers) {
          // Todos respondieron, cancelar timeout si existe
          if (activeTimeouts.has(`${room.id}_${currentRound.id}`)) {
            clearTimeout(activeTimeouts.get(`${room.id}_${currentRound.id}`));
            activeTimeouts.delete(`${room.id}_${currentRound.id}`);
            console.log('⏹️ Timer cancelado - todos respondieron');
          }

          // Todos respondieron, pasar a votación
          await Round.updateStatus(currentRound.id, 'voting');
          
          const answers = await Round.getAnswers(currentRound.id);
          
          io.to(roomCode).emit('start-voting', {
            round: currentRound,
            answers: answers.map(a => ({
              id: a.id,
              text: a.answer_text,
            })),
            allowSelfVote: room.allow_self_vote
          });

          console.log(`🗳️ Iniciando votación en sala ${roomCode} (allowSelfVote: ${room.allow_self_vote})`);
        }
      } catch (error) {
        console.error('💥 Error en submit-answer:', error);
        socket.emit('error', { message: 'Error al enviar respuesta' });
      }
    });

    // === OBTENER MI RESPUESTA ===
    socket.on('get-my-answer', async (data) => {
      try {
        const { roomCode } = data;
        const player = await Player.findBySocketId(socket.id);

        if (!player) {
          return;
        }

        const room = await Room.findByCode(roomCode);
        const currentRound = await Round.getCurrentRound(room.id);

        if (!currentRound) {
          return;
        }

        // Buscar respuesta del jugador en esta ronda
        const answerQuery = await pool.query(
          'SELECT id FROM answers WHERE round_id = $1 AND player_id = $2',
          [currentRound.id, player.id]
        );

        if (answerQuery.rows.length > 0) {
          socket.emit('my-answer-id', {
            answerId: answerQuery.rows[0].id
          });
        }
      } catch (error) {
        console.error('💥 Error en get-my-answer:', error);
      }
    });

    // === FASE 2: VOTAR ===
    socket.on('submit-vote', async (data) => {
      try {
        const { roomCode, answerId } = data;
        const player = await Player.findBySocketId(socket.id);

        if (!player) {
          socket.emit('error', { message: 'Jugador no encontrado' });
          return;
        }

        const room = await Room.findByCode(roomCode);
        const currentRound = await Round.getCurrentRound(room.id);

        if (!currentRound || currentRound.status !== 'voting') {
          socket.emit('error', { message: 'No es fase de votación' });
          return;
        }

        // Registrar voto (pasar allowSelfVote)
        await Answer.vote(answerId, player.id, room.allow_self_vote);

        // Notificar que el jugador votó
        io.to(roomCode).emit('player-voted', {
          playerId: player.id,
          nickname: player.nickname
        });

        // Verificar si todos votaron
        const totalPlayers = await Player.countInRoom(room.id);
        const votesCount = await pool.query(`
          SELECT COUNT(DISTINCT v.player_id) as voters
          FROM votes v
          JOIN answers a ON v.answer_id = a.id
          WHERE a.round_id = $1
        `, [currentRound.id]);

        const totalVoters = parseInt(votesCount.rows[0].voters);

        console.log(`🗳️ ${player.nickname} votó. ${totalVoters}/${totalPlayers}`);

        if (totalVoters === totalPlayers) {
          // Todos votaron, mostrar resultados
          await Round.updateStatus(currentRound.id, 'results');
          
          const answers = await Round.getAnswers(currentRound.id);
          
          // Actualizar puntajes
          for (const answer of answers) {
            if (answer.votes > 0) {
              await Player.updateScore(answer.player_id, answer.votes * 100);
            }
          }

          // Obtener jugadores actualizados
          const players = await Room.getPlayers(room.id);

          io.to(roomCode).emit('show-results', {
            round: currentRound,
            answers: answers,
            players: players
          });

          console.log(`🏆 Mostrando resultados en sala ${roomCode}`);
        }
      } catch (error) {
        console.error('💥 Error en submit-vote:', error);
        socket.emit('error', { message: error.message || 'Error al votar' });
      }
    });

    // === SIGUIENTE RONDA ===
    socket.on('next-round', async (data) => {
      try {
        const { roomCode } = data;
        const player = await Player.findBySocketId(socket.id);

        if (!player || !player.is_host) {
          socket.emit('error', { message: 'Solo el host puede avanzar' });
          return;
        }

        const room = await Room.findByCode(roomCode);
        const currentRound = await Round.getCurrentRound(room.id);

        const nextRoundNumber = (currentRound?.round_number || 0) + 1;
        const maxRounds = room.total_rounds;

        if (nextRoundNumber > maxRounds) {
          // Juego terminado
          const players = await Room.getPlayers(room.id);
          const winner = players.reduce((prev, current) => 
            (prev.score > current.score) ? prev : current
          );

          io.to(roomCode).emit('game-ended', {
            players: players,
            winner: winner
          });

          console.log(`🎉 Juego terminado en sala ${roomCode}. Ganador: ${winner.nickname}`);
        } else {
          // Crear nueva ronda
          const randomPrompt = await Round.getRandomPrompt();
          const newRound = await Round.create(room.id, nextRoundNumber, randomPrompt.id);

          io.to(roomCode).emit('new-round', {
            round: newRound,
            roundNumber: nextRoundNumber,
            totalRounds: maxRounds
          });

          console.log(`▶️ Ronda ${nextRoundNumber} iniciada en sala ${roomCode}`);

          // Establecer timeout de 60 segundos para auto-respuestas
          const timeoutId = setTimeout(async () => {
            await autoCompleteAnswers(roomCode, room.id, newRound.id, io);
            activeTimeouts.delete(`${room.id}_${newRound.id}`);
          }, 60000);
          
          // Guardar el timeout para poder cancelarlo si es necesario
          activeTimeouts.set(`${room.id}_${newRound.id}`, timeoutId);
          console.log(`⏰ Timer de 60s iniciado para ronda ${newRound.id}`);
        }
      } catch (error) {
        console.error('💥 Error en next-round:', error);
        socket.emit('error', { message: 'Error al iniciar siguiente ronda' });
      }
    });

    // === REINICIAR JUEGO ===
    socket.on('restart-game', async (data) => {
      try {
        const { roomCode } = data;
        const player = await Player.findBySocketId(socket.id);

        if (!player || !player.is_host) {
          socket.emit('error', { message: 'Solo el host puede reiniciar el juego' });
          return;
        }

        const room = await Room.findByCode(roomCode);

        // Reiniciar la sala
        await Room.restart(room.id);

        // Obtener jugadores con puntajes reiniciados
        const players = await Room.getPlayers(room.id);

        // Notificar a todos que el juego se reinició
        io.to(roomCode).emit('game-restarted', {
          message: 'El juego se ha reiniciado',
          players: players,
          roomCode: roomCode
        });

        console.log(`🔄 Juego reiniciado en sala ${roomCode}`);
      } catch (error) {
        console.error('💥 Error en restart-game:', error);
        socket.emit('error', { message: 'Error al reiniciar el juego' });
      }
    });

    // === FORZAR RESULTADOS (EMERGENCIA) ===
    socket.on('force-results', async (data) => {
      try {
        const { roomCode } = data;
        const player = await Player.findBySocketId(socket.id);

        if (!player || !player.is_host) {
          socket.emit('error', { message: 'Solo el host puede forzar resultados' });
          return;
        }

        const room = await Room.findByCode(roomCode);
        const currentRound = await Round.getCurrentRound(room.id);

        if (!currentRound || currentRound.status !== 'voting') {
          return;
        }

        console.log('⚠️ Host forzó resultados en sala:', roomCode);

        // Marcar ronda como resultados
        await Round.updateStatus(currentRound.id, 'results');
        
        const answers = await Round.getAnswers(currentRound.id);
        
        // Actualizar puntajes
        for (const answer of answers) {
          if (answer.votes > 0) {
            await Player.updateScore(answer.player_id, answer.votes * 100);
          }
        }

        const players = await Room.getPlayers(room.id);

        io.to(roomCode).emit('show-results', {
          round: currentRound,
          answers: answers,
          players: players
        });

        console.log('🏆 Resultados forzados mostrados');
      } catch (error) {
        console.error('💥 Error en force-results:', error);
      }
    });

    // Chat - Enviar mensaje
    socket.on('send-message', async (data) => {
      try {
        const { roomCode, message } = data;
        const player = await Player.findBySocketId(socket.id);

        if (!player) {
          socket.emit('error', { message: 'No estás en ninguna sala' });
          return;
        }

        const room = await Room.findByCode(roomCode);

        if (!room) {
          socket.emit('error', { message: 'Sala no encontrada' });
          return;
        }

        // Crear objeto de mensaje
        const chatMessage = {
          id: Date.now(),
          playerId: player.id,
          playerNickname: player.nickname,
          message: message.trim(),
          timestamp: new Date().toISOString()
        };

        // Opcional: Guardar en base de datos
        try {
          await pool.query(
            'INSERT INTO chat_messages (room_id, player_id, message) VALUES ($1, $2, $3)',
            [room.id, player.id, message.trim()]
          );
        } catch (err) {
          console.log('No se pudo guardar mensaje en BD (tabla no existe):', err.message);
        }

        // Emitir mensaje a todos en la sala
        io.to(roomCode).emit('new-message', chatMessage);

        console.log(`💬 ${player.nickname} en ${roomCode}: ${message}`);
      } catch (error) {
        console.error('💥 Error en send-message:', error);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });

    // Desconexión (con manejo de reconexión)
    socket.on('disconnect', async () => {
      try {
        const player = await Player.findBySocketId(socket.id);
        
        if (player) {
          console.log(`👋 Jugador desconectándose: ${player.nickname}`);
          
          // Obtener el código de la sala
          const roomQuery = await pool.query(
            'SELECT code, status FROM rooms WHERE id = $1', 
            [player.room_id]
          );
          
          const room = roomQuery.rows[0];

          if (room) {
            // Si el juego está en curso, NO eliminar al jugador, solo marcarlo como desconectado
            if (room.status === 'playing') {
              console.log(`⏸️ ${player.nickname} desconectado pero no eliminado (juego en curso)`);
              
              // Marcar como desconectado temporalmente
              await Player.markDisconnected(socket.id);

              // Notificar a los demás
              io.to(room.code).emit('player-disconnected', {
                playerId: player.id,
                nickname: player.nickname,
                message: `${player.nickname} se desconectó. Esperando reconexión...`
              });

              // Establecer timeout de 2 minutos para eliminación definitiva
              setTimeout(async () => {
                try {
                  // Verificar si el jugador sigue desconectado
                  const checkPlayer = await pool.query(
                    'SELECT socket_id FROM players WHERE id = $1',
                    [player.id]
                  );

                  if (checkPlayer.rows.length > 0 && checkPlayer.rows[0].socket_id.startsWith('disconnected_')) {
                    console.log(`⏰ Timeout alcanzado. Eliminando a ${player.nickname}`);
                    
                    // Eliminar jugador permanentemente
                    await pool.query('DELETE FROM players WHERE id = $1', [player.id]);

                    const remainingPlayers = await Room.getPlayers(player.room_id);

                    io.to(room.code).emit('player-removed', {
                      playerId: player.id,
                      nickname: player.nickname,
                      players: remainingPlayers,
                      message: `${player.nickname} fue eliminado por inactividad`
                    });

                    // Si no quedan jugadores, eliminar sala
                    if (remainingPlayers.length === 0) {
                      await Room.delete(player.room_id);
                      console.log(`🗑️ Sala ${room.code} eliminada (sin jugadores)`);
                    }
                  }
                } catch (error) {
                  console.error('Error en timeout de desconexión:', error);
                }
              }, 120000); // 2 minutos

            } else {
              // Si el juego NO ha comenzado, eliminar inmediatamente
              await Player.delete(socket.id);

              const remainingPlayers = await Room.getPlayers(player.room_id);

              // Notificar a los demás
              io.to(room.code).emit('player-left', {
                playerId: player.id,
                nickname: player.nickname,
                players: remainingPlayers
              });

              // Si era el host y quedan jugadores, asignar nuevo host
              if (player.is_host && remainingPlayers.length > 0) {
                const newHost = remainingPlayers[0];
                await pool.query(
                  'UPDATE players SET is_host = TRUE WHERE id = $1', 
                  [newHost.id]
                );
                
                io.to(room.code).emit('new-host', {
                  hostId: newHost.id,
                  hostNickname: newHost.nickname
                });
                
                console.log(`👑 Nuevo host: ${newHost.nickname}`);
              }

              // Si no quedan jugadores, eliminar sala
              if (remainingPlayers.length === 0) {
                await Room.delete(player.room_id);
                console.log(`🗑️ Sala ${room.code} eliminada (sin jugadores)`);
              }

              console.log(`👋 ${player.nickname} desconectado y eliminado`);
            }
          }
        }
      } catch (error) {
        console.error('💥 Error en disconnect:', error);
      }
    });
  });
}

// Función para auto-completar respuestas de jugadores que no respondieron
async function autoCompleteAnswers(roomCode, roomId, roundId, io) {
  try {
    console.log(`⏰ Timeout alcanzado para ronda ${roundId} en sala ${roomCode}`);

    // Verificar si la ronda sigue en estado 'answering'
    const currentRound = await Round.getCurrentRound(roomId);
    
    if (!currentRound || currentRound.id !== roundId || currentRound.status !== 'answering') {
      console.log('⏭️ La ronda ya avanzó o cambió de estado, ignorando timeout');
      return;
    }

    // Obtener todos los jugadores de la sala
    const players = await Room.getPlayers(roomId);
    
    // Respuestas predeterminadas aleatorias
    const defaultAnswers = [
      '¯\\_(ツ)_/¯',
      'Sin comentarios...',
      'Paso de esta ronda',
      '404 - Respuesta no encontrada',
      'Error: Creatividad no disponible',
      'Me quedé sin ideas',
      '...',
      'Pregúntale a ChatGPT',
      'No sé qué decir',
      'Silencio incómodo',
      '*Conexión perdida*',
      'La respuesta está en tu corazón',
      'Zzz...',
      'Estaba escribiendo algo pero...',
      'Next question please',
      '🤷',
      'No tengo nada que ver con esto',
      'Abstención',
      'Mejor no opino',
      'Loading...'
    ];

    // Para cada jugador, verificar si respondió
    let autoAnswersCount = 0;
    for (const player of players) {
      const hasAnswered = await Answer.hasAnswered(roundId, player.id);
      
      if (!hasAnswered) {
        // Asignar respuesta automática aleatoria
        const randomAnswer = defaultAnswers[Math.floor(Math.random() * defaultAnswers.length)];
        await Answer.create(roundId, player.id, randomAnswer);
        autoAnswersCount++;
        
        console.log(`🤖 Auto-respuesta para ${player.nickname}: "${randomAnswer}"`);
        
        // Notificar que el jugador "respondió"
        io.to(roomCode).emit('player-answered', {
          playerId: player.id,
          nickname: player.nickname
        });
      }
    }

    if (autoAnswersCount > 0) {
      console.log(`🤖 Se agregaron ${autoAnswersCount} respuestas automáticas`);
    }

    // Verificar si todos respondieron (ahora debería ser true)
    const totalPlayers = await Player.countInRoom(roomId);
    const totalAnswers = await Round.countAnswers(roundId);

    console.log(`📊 Respuestas totales: ${totalAnswers}/${totalPlayers}`);

    if (totalAnswers === totalPlayers) {
      // Todos respondieron (incluyendo auto-respuestas), pasar a votación
      await Round.updateStatus(roundId, 'voting');
      
      const room = await Room.findByCode(roomCode);
      const answers = await Round.getAnswers(roundId);
      
      io.to(roomCode).emit('start-voting', {
        round: currentRound,
        answers: answers.map(a => ({
          id: a.id,
          text: a.answer_text,
        })),
        allowSelfVote: room.allow_self_vote
      });

      console.log(`🗳️ Iniciando votación automáticamente en sala ${roomCode}`);
    }
  } catch (error) {
    console.error('💥 Error en autoCompleteAnswers:', error);
  }
}

module.exports = setupSocketHandlers;