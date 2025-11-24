import { useEffect, useRef, useState } from 'react';

export const useGameAudio = () => {
  const lobbyMusicRef = useRef(null);
  const answeringMusicRef = useRef(null);
  const votingMusicRef = useRef(null);
  const resultsMusicRef = useRef(null);
  const messageNotificationRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const currentTrackRef = useRef(null);

  // Inicializar audios
  useEffect(() => {
    lobbyMusicRef.current = new Audio('/sounds/lobby-music.mp3');
    answeringMusicRef.current = new Audio('/sounds/game-music.mp3');
    votingMusicRef.current = new Audio('/sounds/votos.mp3');
    resultsMusicRef.current = new Audio('/sounds/resultados.mp3');
    messageNotificationRef.current = new Audio('/sounds/message-notification.mp3');

    // Configurar loops
    lobbyMusicRef.current.loop = true;
    answeringMusicRef.current.loop = true;
    votingMusicRef.current.loop = true;
    resultsMusicRef.current.loop = true;
    
    // Volúmenes por defecto
    lobbyMusicRef.current.volume = 0.3;
    answeringMusicRef.current.volume = 0.3;
    votingMusicRef.current.volume = 0.5;
    resultsMusicRef.current.volume = 0.3;
    messageNotificationRef.current.volume = 0.5;

    // Cleanup
    return () => {
      [lobbyMusicRef, answeringMusicRef, votingMusicRef, resultsMusicRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current = null;
        }
      });
      messageNotificationRef.current = null;
    };
  }, []);

  // Controlar mute
  useEffect(() => {
    const volume = isMuted ? 0 : 0.3;
    const notificationVolume = isMuted ? 0 : 0.5;

    if (lobbyMusicRef.current) lobbyMusicRef.current.volume = volume;
    if (answeringMusicRef.current) answeringMusicRef.current.volume = volume;
    if (votingMusicRef.current) votingMusicRef.current.volume = volume;
    if (resultsMusicRef.current) resultsMusicRef.current.volume = volume;
    if (messageNotificationRef.current) messageNotificationRef.current.volume = notificationVolume;
  }, [isMuted]);

  const stopAllExcept = (exceptTrack) => {
    const tracks = {
      lobby: lobbyMusicRef,
      answering: answeringMusicRef,
      voting: votingMusicRef,
      results: resultsMusicRef
    };

    Object.entries(tracks).forEach(([key, ref]) => {
      if (key !== exceptTrack && ref.current && !ref.current.paused) {
        ref.current.pause();
        ref.current.currentTime = 0;
      }
    });
  };

  const playTrack = (trackRef, trackName) => {
    if (!trackRef.current) return;

    // Si ya es la música activa y está sonando, no hacer nada
    if (currentTrackRef.current === trackName && !trackRef.current.paused) {
      return;
    }

    // Detener todas las demás músicas
    stopAllExcept(trackName);

    // Reproducir si está pausada
    if (trackRef.current.paused) {
      trackRef.current.play().catch(err => {
        console.log(`No se pudo reproducir ${trackName}:`, err);
      });
    }

    currentTrackRef.current = trackName;
  };

  const playLobbyMusic = () => playTrack(lobbyMusicRef, 'lobby');
  const playAnsweringMusic = () => playTrack(answeringMusicRef, 'answering');
  const playVotingMusic = () => playTrack(votingMusicRef, 'voting');
  const playResultsMusic = () => playTrack(resultsMusicRef, 'results');

  const stopAllMusic = () => {
    stopAllExcept(null);
    currentTrackRef.current = null;
  };

  const playMessageNotification = () => {
    if (!messageNotificationRef.current) return;
    
    messageNotificationRef.current.currentTime = 0;
    messageNotificationRef.current.play().catch(err => {
      console.log('No se pudo reproducir notificación:', err);
    });
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  return {
    playLobbyMusic,
    playAnsweringMusic,
    playVotingMusic,
    playResultsMusic,
    stopAllMusic,
    playMessageNotification,
    toggleMute,
    isMuted
  };
};