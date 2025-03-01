const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected as:', socket.id);
  // Emit a joinGame event
  socket.emit('joinGame', { x: 100, y: 100, radius: 20 });
  
  // Simulate periodic movement
  setInterval(() => {
    socket.emit('move', { vx: Math.random() * 2 - 1, vy: Math.random() * 2 - 1 });
  }, 1000);
});

socket.on('gameState', (data) => {
  console.log('Game State:', data);
});

socket.on('absorbed', () => {
  console.log('You have been absorbed!');
});