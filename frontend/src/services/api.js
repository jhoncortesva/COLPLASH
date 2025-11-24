import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const roomAPI = {
  createRoom: (hostId, totalRounds = 3, allowSelfVote = false) => {
    return axios.post(`${API_URL}/rooms/create`, { 
      hostId,
      totalRounds,
      allowSelfVote
    }).then(res => res.data);
  },
  
  joinRoom: (roomCode) => {
    return axios.post(`${API_URL}/rooms/join`, { roomCode }).then(res => res.data);
  }
};