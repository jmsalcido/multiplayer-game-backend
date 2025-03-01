// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Import AWS SDK v3 clients
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Configure the AWS SDK v3 for DynamoDB
const REGION = "us-west-2";
const ddbClient = new DynamoDBClient({ region: REGION });
const dynamoDB = DynamoDBDocumentClient.from(ddbClient);

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Setup Socket.io for real-time communication
const io = socketIo(server, {
  cors: { origin: "*" } // Adjust CORS settings as needed for production
});

// Basic route to verify that the server is running
app.get('/', (req, res) => {
  res.send('Multiplayer Game Server is Running');
});

// In-memory store for active players in the game
const players = {};

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // When a player joins the game
  socket.on('joinGame', async (data) => {
    console.log(`Player ${socket.id} joined the game with data:`, data);
    
    // Determine table name based on environment
    const environment = process.env.NODE_ENV || 'dev'; // Default to 'dev' if not set
    const tableName = environment === 'prod' ? 'PlayerSessions-prod' : 'PlayerSessions-dev';

    // Prepare parameters to save the player's session in DynamoDB
    const params = {
      TableName: tableName,
      Item: {
        sessionId: socket.id,
        joinedAt: Date.now(),
        ...data, // Additional player data (e.g., username)
      },
    };

    try {
      // Save the session in DynamoDB
      const result = await dynamoDB.send(new PutCommand(params));
      console.log("Player session saved:", result);
    } catch (err) {
      console.error("Error saving session:", err);
    }

    // Initialize the player's game state in memory.
    // You can extend this with additional properties as needed.
    players[socket.id] = {
      id: socket.id,
      x: data.x || 100,         // Starting x position
      y: data.y || 100,         // Starting y position
      vx: 0,                    // Velocity x
      vy: 0,                    // Velocity y
      radius: data.radius || 20, // Player size
      score: 0
    };
  });

  // Listen for movement commands
  socket.on('move', (data) => {
    if (players[socket.id]) {
      // Update the player's velocity based on the input data
      players[socket.id].vx = data.vx;
      players[socket.id].vy = data.vy;
    }
  });

  // Handle disconnection: remove player from in-memory state.
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    // Optionally, you can also remove their session from DynamoDB here.
  });
});

// Game loop: update game state periodically (e.g., 30 times per second)
const TICK_RATE = 1000 / 30;
setInterval(() => {
  updateGameState();
  // Broadcast the updated game state to all clients
  io.sockets.emit('gameState', players);
}, TICK_RATE);

// Update positions and handle collisions
function updateGameState() {
  // Update each player's position based on their velocity
  for (let id in players) {
    let p = players[id];
    p.x += p.vx;
    p.y += p.vy;
    // Optionally add boundary checks here
  }

  // Get a snapshot of player IDs
  const ids = Object.keys(players);

  // Collision detection: Check every pair of players
  for (let i = 0; i < ids.length; i++) {
    const p1 = players[ids[i]];
    if (!p1) continue;  // Check that p1 exists

    for (let j = i + 1; j < ids.length; j++) {
      const p2 = players[ids[j]];
      if (!p2) continue;  // Check that p2 exists

      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < p1.radius + p2.radius) {
        // Determine which player will absorb the other.
        if (p1.radius >= p2.radius) {
          absorb(p1, p2);
          io.to(p2.id).emit('absorbed');
          // Remove p2 from the players object
          delete players[p2.id];
        } else {
          absorb(p2, p1);
          io.to(p1.id).emit('absorbed');
          delete players[p1.id];
          break; // Break out of inner loop if p1 is removed
        }
      }
    }
  }
}

// Helper function that makes 'larger' absorb 'smaller'
function absorb(larger, smaller) {
  const largerArea = Math.PI * larger.radius * larger.radius;
  const smallerArea = Math.PI * smaller.radius * smaller.radius;
  // Absorb 50% of the smaller player's area (adjust factor as needed)
  const newArea = largerArea + (smallerArea * 0.5);
  larger.radius = Math.sqrt(newArea / Math.PI);
  larger.score += 1;
}

// Start the server on a given port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});