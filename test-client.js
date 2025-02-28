const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected as:', socket.id);
  // Emit the joinGame event with sample data
  socket.emit('joinGame', { playerName: 'TestPlayer', score: 0 });
});