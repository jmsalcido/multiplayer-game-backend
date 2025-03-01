const io = require('socket.io-client');

// Configuration: Number of simulated players and movement interval (ms)
const NUM_PLAYERS = 10;
const MOVE_INTERVAL = 1000; // Each player sends a move command every second
const SERVER_URL = 'http://localhost:3000'; // Change if your server URL differs

// Create an array to store simulated player sockets
const players = [];

// Function to simulate a single player's behavior
function simulatePlayer() {
  const socket = io(SERVER_URL);

  socket.on('connect', () => {
    console.log(`Simulated player connected: ${socket.id}`);

    // Emit joinGame event with a random starting position and a fixed radius
    socket.emit('joinGame', { 
      x: Math.random() * 800, 
      y: Math.random() * 600, 
      radius: 20 
    });

    // Periodically send random move commands
    setInterval(() => {
      // Random velocities between -5 and 5
      const vx = Math.random() * 10 - 5;
      const vy = Math.random() * 10 - 5;
      socket.emit('move', { vx, vy });
    }, MOVE_INTERVAL);
  });

  // Listen for game state updates (optional logging)
  socket.on('gameState', (state) => {
    // Uncomment the next line to log game state updates for this player
    // console.log(`Player ${socket.id} sees game state:`, state);
  });

  // Listen for collision/absorption notifications
  socket.on('absorbed', () => {
    console.log(`Simulated player ${socket.id} was absorbed!`);
  });

  return socket;
}

// Create multiple simulated players
for (let i = 0; i < NUM_PLAYERS; i++) {
  const playerSocket = simulatePlayer();
  players.push(playerSocket);
}