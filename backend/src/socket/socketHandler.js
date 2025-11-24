const Room = require('../models/Room');
const Player = require('../models/Player');
const Round = require('../models/Round');
const Answer = require('../models/Answer');
const Vote = require('../models/Vote');
const pool = require('../config/database');

const activeTimeouts = new Map();

module.exports = (io) => {
  console.log('🎯 Socket handler inicializado');
  
  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);

    socket.onAny((eventName, ...args) => {
      console.log(`📨 [DEBUG] Evento: "${eventName}"`, args);
    });

    // === CREAR SALA ===
    socket.on('create-room', async (data) => {
      try {
        console.log('🎯 [CREATE-ROOM]:', data);
        
        const { nickname, totalRounds = 3, allowSelfVote = false } = data;

        if (!nickname) {
          socket.emit('error', { message: 'Nombre requerido' });
          return;
        }

        // Verificar si este socket ya tiene un jugador
        const existingPlayer = await Player.findBySocketId(socket.id);
        if (existingPlayer) {
          const roomQuery = await pool.query(
            'SELECT * FROM rooms WHERE id = $1',
            [existingPlayer.room_id]
          );
          
          if (roomQuery.rows.length > 0) {
            const existingRoom = roomQuery.rows[0];
            
            // Si la sala está FINALIZADA o no existe, eliminar el jugador antiguo
            if (existingRoom.status === 'finished') {
              console.log('🗑️ Sala anterior finalizada, eliminando jugador antiguo...');
              await Player.delete(existingPlayer.id);
              
              // Verificar si quedan jugadores en esa sala
              const remainingPlayers = await pool.query(
                'SELECT COUNT(*) as count FROM players WHERE room_id = $1',
                [existingRoom.id]
              );
              
              // Si no quedan jugadores, eliminar la sala
              if (parseInt(remainingPlayers.rows[0].count) === 0) {
                await Room.delete(existingRoom.id);
                console.log(`🗑️ Sala ${existingRoom.code} eliminada`);
              }
            } else {
              // La sala aún está activa, reutilizar
              console.log('⚠️ Socket ya tiene jugador en sala activa, reutilizando');
              const players = await Player.findByRoom(existingRoom.id);
              
              socket.join(existingRoom.code);
              socket.emit('room-created', { 
                roomCode: existingRoom.code,
                playerId: existingPlayer.id,
                isHost: existingPlayer.is_host
              });
              socket.emit('player-joined', {
                players: players.map(p => ({ id: p.id, nickname: p.nickname, is_host: p.is_host, score: p.score }))
              });
              return;
            }
          } else {
            // Sala no existe, eliminar jugador huérfano
            console.log('🗑️ Jugador huérfano encontrado, eliminando...');
            await Player.delete(existingPlayer.id);
          }
        }

        // Crear nueva sala
        const room = await Room.create(socket.id, totalRounds, allowSelfVote);
        const player = await Player.create(room.id, socket.id, nickname, true);

        socket.join(room.code);

        socket.emit('room-created', { 
          roomCode: room.code,
          playerId: player.id,
          isHost: true
        });

        socket.emit('player-joined', {
          players: [{ id: player.id, nickname: player.nickname, is_host: true, score: 0 }]
        });

        console.log('✅ Sala creada:', room.code);
      } catch (error) {
        console.error('💥 Error en create-room:', error);
        socket.emit('error', { message: 'Error al crear sala' });
      }
    });

    // === UNIRSE A SALA ===
    socket.on('join-room', async (data) => {
      try {
        console.log('📥 [JOIN-ROOM]:', data);
        
        const { roomCode, nickname } = data;

        if (!roomCode || !nickname) {
          socket.emit('error', { message: 'Código de sala y nombre requeridos' });
          return;
        }

        const room = await Room.findByCode(roomCode);
        if (!room) {
          socket.emit('error', { message: 'Sala no encontrada' });
          return;
        }

        // Verificar si YA existe un jugador con este socket_id
        let player = await Player.findBySocketId(socket.id);
        
        if (player) {
          if (player.room_id === room.id) {
            console.log('🔄 Jugador ya existe en sala, actualizando');
          } else {
            console.log('⚠️ Jugador en otra sala, eliminando');
            await Player.delete(player.id);
            player = null;
          }
        }

        // Verificar si hay un jugador con el mismo nickname en esta sala (reconexión)
        if (!player) {
          const existingByName = await pool.query(
            'SELECT * FROM players WHERE room_id = $1 AND nickname = $2',
            [room.id, nickname]
          );

          if (existingByName.rows.length > 0) {
            // Jugador encontrado por nickname, actualizar socket_id
            player = existingByName.rows[0];
            console.log(`🔄 Reconectando jugador ${nickname}, actualizando socket...`);
            await Player.updateSocketId(player.id, socket.id);
            console.log(`✅ Socket actualizado: ${player.socket_id} -> ${socket.id}`);
          }
        }

        const currentPlayers = await Player.findByRoom(room.id);
        
        if (currentPlayers.length >= 8 && !player) {
          socket.emit('error', { message: 'La sala está llena' });
          return;
        }

        if (!player) {
          player = await Player.create(room.id, socket.id, nickname, false);
          console.log('👤 Nuevo jugador creado:', player.nickname);
        }

        socket.join(roomCode);

        const players = await Player.findByRoom(room.id);

        io.to(roomCode).emit('player-joined', {
          players: players.map(p => ({ id: p.id, nickname: p.nickname, is_host: p.is_host, score: p.score }))
        });

        // === OBTENER ESTADO ACTUAL DEL JUEGO ===
        let gameState = {
          playerId: player.id,
          isHost: player.is_host,
          roomCode: room.code,
          status: room.status,
          players: players.map(p => ({ id: p.id, nickname: p.nickname, is_host: p.is_host, score: p.score })),
          totalRounds: room.total_rounds,
          allowSelfVote: room.allow_self_vote
        };

        // Si el juego está en curso, obtener ronda actual
        if (room.status === 'playing') {
          const currentRound = await pool.query(`
            SELECT r.*, p.prompt_text as prompt, p.category
            FROM rounds r
            JOIN prompts p ON r.prompt_id = p.id
            WHERE r.room_id = $1 AND r.status IN ('answering', 'voting', 'results')
            ORDER BY r.round_number DESC
            LIMIT 1
          `, [room.id]);

          if (currentRound.rows.length > 0) {
            const roundData = currentRound.rows[0];
            
            gameState.gameStarted = true;
            gameState.currentRound = {
              id: roundData.id,
              round_number: roundData.round_number,
              prompt: roundData.prompt,
              category: roundData.category,
              status: roundData.status
            };
            gameState.roundNumber = roundData.round_number;

            // Si está en voting o results, obtener respuestas
            if (roundData.status === 'voting' || roundData.status === 'results') {
              const answersResult = await pool.query(
                `SELECT a.id, a.answer_text, a.player_id, a.votes, p.nickname as player_nickname
                FROM answers a
                JOIN players p ON a.player_id = p.id
                WHERE a.round_id = $1
                ORDER BY a.id`,
                [roundData.id]
              );

              gameState.answers = answersResult.rows.map(a => ({
                id: a.id,
                text: a.answer_text,
                playerId: a.player_id,
                playerNickname: a.player_nickname,
                votes: a.votes || 0
              }));
            }
          }
        }

        socket.emit('joined-successfully', gameState);

        console.log('✅ Jugador unido:', nickname, '- Estado:', room.status);
      } catch (error) {
        console.error('💥 Error en join-room:', error);
        socket.emit('error', { message: 'Error al unirse a la sala' });
      }
    });

    // === SALIR DE SALA ===
    socket.on('leave-room', async (data) => {
      try {
        const { roomCode } = data;
        console.log('🚪 [LEAVE-ROOM] Solicitud de salida:', roomCode);

        const player = await Player.findBySocketId(socket.id);

        if (!player) {
          console.log('⚠️ Jugador no encontrado para salir');
          return;
        }

        const room = await Room.findByCode(roomCode);

        if (!room) {
          console.log('⚠️ Sala no encontrada para salir');
          return;
        }

        // Eliminar jugador
        await Player.delete(player.id);
        console.log(`👋 ${player.nickname} salió de la sala ${roomCode}`);

        // Obtener jugadores restantes
        const remainingPlayers = await Room.getPlayers(room.id);

        // Notificar a los demás
        io.to(roomCode).emit('player-left', {
          playerId: player.id,
          nickname: player.nickname,
          players: remainingPlayers
        });

        // Si era el host y quedan jugadores, promover a nuevo host
        if (player.is_host && remainingPlayers.length > 0) {
          const newHost = remainingPlayers[0];
          await Player.promoteToHost(newHost.id);
          
          io.to(roomCode).emit('new-host', {
            hostId: newHost.id,
            hostNickname: newHost.nickname
          });
          
          console.log(`👑 Nuevo host: ${newHost.nickname}`);
        }

        // Si no quedan jugadores, eliminar la sala
        if (remainingPlayers.length === 0) {
          await Room.delete(room.id);
          console.log(`🗑️ Sala ${roomCode} eliminada (sin jugadores)`);
        }

        // Salir de la sala de Socket.IO
        socket.leave(roomCode);

        socket.emit('left-room-successfully');

      } catch (error) {
        console.error('💥 Error en leave-room:', error);
        socket.emit('error', { message: 'Error al salir de la sala' });
      }
    });

// === INICIAR JUEGO ===
    socket.on('start-game', async (data) => {
      try {
        const { roomCode } = data;
        console.log(`🎮 Iniciando juego en sala: ${roomCode}`);
        
        const player = await Player.findBySocketId(socket.id);

        if (!player || !player.is_host) {
          socket.emit('error', { message: 'Solo el host puede iniciar el juego' });
          return;
        }

        const room = await Room.findByCode(roomCode);
        const playerCount = await Player.countInRoom(room.id);

        if (playerCount < 3) {
          socket.emit('error', { message: 'Se necesitan al menos 3 jugadores para iniciar' });
          return;
        }

        await Room.updateStatus(room.id, 'playing');

        const randomPrompt = await Round.getRandomPrompt();
        const firstRound = await Round.create(room.id, 1, randomPrompt.id);

        io.to(roomCode).emit('game-started', {
          message: 'El juego ha comenzado!',
          round: firstRound,
          roundNumber: 1,
          totalRounds: room.total_rounds,
          allowSelfVote: room.allow_self_vote
        });

        console.log(`🎮 Juego iniciado en ${roomCode}`);

        const timeoutId = setTimeout(async () => {
          await autoCompleteAnswers(roomCode, room.id, firstRound.id, io);
          activeTimeouts.delete(`${room.id}_${firstRound.id}`);
        }, 60000);
        
        activeTimeouts.set(`${room.id}_${firstRound.id}`, timeoutId);

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

        const hasAnswered = await Answer.hasAnswered(currentRound.id, player.id);
        if (hasAnswered) {
          socket.emit('error', { message: 'Ya enviaste tu respuesta' });
          return;
        }

        await Answer.create(currentRound.id, player.id, answer.trim());

        io.to(roomCode).emit('player-answered', {
          playerId: player.id,
          nickname: player.nickname
        });

        const totalPlayers = await Player.countInRoom(room.id);
        const totalAnswers = await Round.countAnswers(currentRound.id);

        console.log(`📝 ${player.nickname} respondió. ${totalAnswers}/${totalPlayers}`);

        if (totalAnswers === totalPlayers) {
          if (activeTimeouts.has(`${room.id}_${currentRound.id}`)) {
            clearTimeout(activeTimeouts.get(`${room.id}_${currentRound.id}`));
            activeTimeouts.delete(`${room.id}_${currentRound.id}`);
          }

          await Round.updateStatus(currentRound.id, 'voting');
          
          const answersResult = await pool.query(
            `SELECT a.id, a.answer_text, a.player_id, p.nickname as player_nickname
             FROM answers a
             JOIN players p ON a.player_id = p.id
             WHERE a.round_id = $1
             ORDER BY a.id`,
            [currentRound.id]
          );
          
          io.to(roomCode).emit('start-voting', {
            round: currentRound,
            answers: answersResult.rows.map(a => ({
              id: a.id,
              text: a.answer_text,
              playerId: a.player_id,
              playerNickname: a.player_nickname
            })),
            allowSelfVote: room.allow_self_vote
          });

          console.log(`🗳️ Votación iniciada`);
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

        if (!player) return;

        const room = await Room.findByCode(roomCode);
        const currentRound = await Round.getCurrentRound(room.id);

        if (!currentRound) return;

        const myAnswer = await pool.query(
          'SELECT id FROM answers WHERE round_id = $1 AND player_id = $2',
          [currentRound.id, player.id]
        );

        if (myAnswer.rows.length > 0) {
          socket.emit('my-answer-id', { answerId: myAnswer.rows[0].id });
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

        const hasVoted = await Vote.hasVoted(currentRound.id, player.id);
        if (hasVoted) {
          socket.emit('error', { message: 'Ya has votado' });
          return;
        }

        await Answer.vote(answerId, player.id, room.allow_self_vote);
        await Vote.create(answerId, player.id);

        socket.emit('vote-registered', { answerId });

        io.to(roomCode).emit('player-voted', {
          playerId: player.id,
          nickname: player.nickname
        });

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
          await Round.updateStatus(currentRound.id, 'results');
          
          const answers = await pool.query(
            `SELECT a.*, p.nickname as player_nickname
             FROM answers a
             JOIN players p ON a.player_id = p.id
             WHERE a.round_id = $1
             ORDER BY a.votes DESC, a.id ASC`,
            [currentRound.id]
          );
          
          for (const answer of answers.rows) {
            if (answer.votes > 0) {
              await Player.updateScore(answer.player_id, answer.votes * 100);
            }
          }

          const players = await Room.getPlayers(room.id);

          io.to(roomCode).emit('show-results', {
            round: currentRound,
            answers: answers.rows.map(a => ({
              id: a.id,
              text: a.answer_text,
              playerNickname: a.player_nickname,
              playerId: a.player_id,
              votes: a.votes
            })),
            players: players.map(p => ({
              id: p.id,
              nickname: p.nickname,
              score: p.score,
              is_host: p.is_host
            }))
          });

          console.log(`🏆 Resultados mostrados`);
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
          const players = await Room.getPlayers(room.id);
          const winner = players.reduce((prev, current) => 
            (prev.score > current.score) ? prev : current
          );

          // MARCAR LA SALA COMO FINALIZADA
          await pool.query(
            'UPDATE rooms SET status = $1 WHERE id = $2',
            ['finished', room.id]
          );

          io.to(roomCode).emit('game-ended', {
            players: players,
            winner: winner
          });

          console.log(`🎉 Juego terminado. Ganador: ${winner.nickname}`);
        } else {
          const randomPrompt = await Round.getRandomPrompt();
          const newRound = await Round.create(room.id, nextRoundNumber, randomPrompt.id);

          io.to(roomCode).emit('new-round', {
            round: newRound,
            roundNumber: nextRoundNumber,
            totalRounds: maxRounds
          });

          console.log(`▶️ Ronda ${nextRoundNumber} iniciada`);

          const timeoutId = setTimeout(async () => {
            await autoCompleteAnswers(roomCode, room.id, newRound.id, io);
            activeTimeouts.delete(`${room.id}_${newRound.id}`);
          }, 60000);
          
          activeTimeouts.set(`${room.id}_${newRound.id}`, timeoutId);
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
        
        for (const [key, timeoutId] of activeTimeouts.entries()) {
          if (key.startsWith(`${room.id}_`)) {
            clearTimeout(timeoutId);
            activeTimeouts.delete(key);
          }
        }

        await Room.restart(room.id);

        const players = await Room.getPlayers(room.id);

        io.to(roomCode).emit('game-restarted', {
          message: 'El juego se ha reiniciado',
          players: players.map(p => ({
            id: p.id,
            nickname: p.nickname,
            is_host: p.is_host,
            score: p.score
          })),
          roomCode: roomCode
        });

        console.log(`🔄 Juego reiniciado`);
      } catch (error) {
        console.error('💥 Error en restart-game:', error);
        socket.emit('error', { message: 'Error al reiniciar el juego' });
      }
    });

    // === FORZAR RESULTADOS ===
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

        await Round.updateStatus(currentRound.id, 'results');
        
        const answers = await Round.getAnswers(currentRound.id);
        
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

        console.log('🏆 Resultados forzados');
      } catch (error) {
        console.error('💥 Error en force-results:', error);
      }
    });

    // === CHAT ===
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

        const chatMessage = {
          id: Date.now(),
          playerId: player.id,
          playerNickname: player.nickname,
          message: message.trim(),
          timestamp: new Date().toISOString()
        };

        try {
          await pool.query(
            'INSERT INTO chat_messages (room_id, player_id, message) VALUES ($1, $2, $3)',
            [room.id, player.id, message.trim()]
          );
        } catch (err) {
          console.log('Chat BD no disponible');
        }

        io.to(roomCode).emit('new-message', chatMessage);
      } catch (error) {
        console.error('💥 Error en send-message:', error);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });

    // === DESCONEXIÓN ===
    socket.on('disconnect', async () => {
      try {
        const player = await Player.findBySocketId(socket.id);
        
        if (player) {
          console.log(`👋 Desconexión: ${player.nickname}`);
          
          const roomQuery = await pool.query(
            'SELECT code, status FROM rooms WHERE id = $1', 
            [player.room_id]
          );
          
          const room = roomQuery.rows[0];

          if (room) {
            if (room.status === 'playing') {
              // Durante el juego: esperar 2 minutos antes de eliminar
              io.to(room.code).emit('player-disconnected', {
                playerId: player.id,
                nickname: player.nickname,
                message: `${player.nickname} se desconectó`
              });

              const disconnectedSocketId = socket.id;

              setTimeout(async () => {
                try {
                  const checkPlayer = await pool.query(
                    'SELECT socket_id FROM players WHERE id = $1',
                    [player.id]
                  );

                  if (checkPlayer.rows.length > 0 && checkPlayer.rows[0].socket_id === disconnectedSocketId) {
                    await pool.query('DELETE FROM players WHERE id = $1', [player.id]);

                    const remainingPlayers = await Room.getPlayers(player.room_id);

                    io.to(room.code).emit('player-removed', {
                      playerId: player.id,
                      nickname: player.nickname,
                      players: remainingPlayers.map(p => ({
                        id: p.id,
                        nickname: p.nickname,
                        is_host: p.is_host,
                        score: p.score
                      })),
                      message: `${player.nickname} eliminado por inactividad`
                    });

                    if (remainingPlayers.length === 0) {
                      await Room.delete(player.room_id);
                    }
                    
                    console.log(`❌ ${player.nickname} eliminado por timeout`);
                  } else {
                    console.log(`✅ ${player.nickname} se reconectó`);
                  }
                } catch (error) {
                  console.error('Error en timeout:', error);
                }
              }, 120000);

            } else {
              // Fuera del juego: eliminar inmediatamente
              await Player.delete(player.id);

              const remainingPlayers = await Room.getPlayers(player.room_id);

              io.to(room.code).emit('player-left', {
                playerId: player.id,
                nickname: player.nickname,
                players: remainingPlayers
              });

              if (player.is_host && remainingPlayers.length > 0) {
                const newHost = remainingPlayers[0];
                await Player.promoteToHost(newHost.id);
                
                io.to(room.code).emit('new-host', {
                  hostId: newHost.id,
                  hostNickname: newHost.nickname
                });
                
                console.log(`👑 Nuevo host: ${newHost.nickname}`);
              }

              if (remainingPlayers.length === 0) {
                await Room.delete(player.room_id);
              }

              console.log(`👋 ${player.nickname} eliminado`);
            }
          }
        }
      } catch (error) {
        console.error('💥 Error en disconnect:', error);
      }
    });
  });
};

// Auto-completar respuestas
async function autoCompleteAnswers(roomCode, roomId, roundId, io) {
  try {
    const Room = require('../models/Room');
    const Round = require('../models/Round');
    const Answer = require('../models/Answer');
    const pool = require('../config/database');

    const currentRound = await Round.getCurrentRound(roomId);
    
    if (!currentRound || currentRound.id !== roundId || currentRound.status !== 'answering') {
      return;
    }

    const players = await Room.getPlayers(roomId);
    
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
      'Zzz...',
      'Next question please',
      '🤷'
    ];

    for (const player of players) {
      const hasAnswered = await Answer.hasAnswered(roundId, player.id);
      
      if (!hasAnswered) {
        const randomAnswer = defaultAnswers[Math.floor(Math.random() * defaultAnswers.length)];
        await Answer.create(roundId, player.id, randomAnswer);
        
        io.to(roomCode).emit('player-answered', {
          playerId: player.id,
          nickname: player.nickname
        });
      }
    }

    await Round.updateStatus(roundId, 'voting');
    
    const room = await Room.findByCode(roomCode);
    
    const answersResult = await pool.query(
      `SELECT a.id, a.answer_text, a.player_id, p.nickname as player_nickname
       FROM answers a
       JOIN players p ON a.player_id = p.id
       WHERE a.round_id = $1
       ORDER BY a.id`,
      [roundId]
    );

    io.to(roomCode).emit('start-voting', {
      round: currentRound,
      answers: answersResult.rows.map(a => ({
        id: a.id,
        text: a.answer_text,
        playerId: a.player_id,
        playerNickname: a.player_nickname
      })),
      allowSelfVote: room.allow_self_vote
    });

    console.log(`🗳️ Votación iniciada automáticamente`);
  } catch (error) {
    console.error('💥 Error en autoCompleteAnswers:', error);
  }
}