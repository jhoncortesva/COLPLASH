const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const roomRoutes = require('./routes/roomRoutes');
const setupSocketHandlers = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*', // Permitir todos los orígenes (para desarrollo con Ngrok)
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middlewares
app.use(cors({
  origin: '*', // Permitir todos los orígenes
  credentials: true
}));

app.use(express.json());

// Agregar headers adicionales para Ngrok
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, ngrok-skip-browser-warning');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Rutas
app.use('/api/rooms', roomRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'COLPLASH API funcionando' });
});

// Ruta raíz para Ngrok
app.get('/', (req, res) => {
  res.json({ 
    message: 'COLPLASH Backend API',
    status: 'online',
    endpoints: {
      health: '/api/health',
      rooms: '/api/rooms'
    }
  });
});

// Configurar Socket.IO
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
});