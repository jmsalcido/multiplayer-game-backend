// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Import AWS SDK v3 clients
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

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

// Leaderboard endpoint: return top 10 players based on score
app.get('/leaderboard', async (req, res) => {
  // Determine the appropriate table based on environment
  const environment = process.env.NODE_ENV || 'dev';
  const tableName = environment === 'prod' ? 'PlayerSessions-prod' : 'PlayerSessions-dev';

  try {
    // Scan the entire table (note: acceptable for small datasets)
    const command = new ScanCommand({ TableName: tableName });
    const data = await dynamoDB.send(command);
    const items = data.Items || [];

    // Sort players by score in descending order
    items.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Take the top 10 players
    const leaderboard = items.slice(0, 10);

    res.json({ leaderboard });
  } catch (err) {
    console.error('Error retrieving leaderboard:', err);
    res.status(500).json({ error: 'Could not retrieve leaderboard' });
  }
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
  socket.on('disconnect', async () => {
    console.log(`Player disconnected: ${socket.id}`);
    if (players[socket.id]) {
      await updatePlayerSession(players[socket.id]);
      delete players[socket.id];
    }
  });
});

// In-memory store for food pellets
const foodPellets = [];

// Maximum number of food pellets in the game world
const MAX_FOOD = 50;

// Define game boundaries (example: 800x600)
const GAME_BOUNDARY = { width: 800, height: 600 };

// Spawn food pellets randomly at intervals
function spawnFood() {
  if (foodPellets.length < MAX_FOOD) {
    const newFood = {
      id: `food-${Date.now()}-${Math.random()}`,
      x: Math.random() * GAME_BOUNDARY.width,
      y: Math.random() * GAME_BOUNDARY.height,
      radius: 5  // Small pellets
    };
    foodPellets.push(newFood);
  }
}

// Check collisions between a player and food
function checkFoodCollisions() {
  for (let pid in players) {
    let player = players[pid];
    for (let i = foodPellets.length - 1; i >= 0; i--) {
      const pellet = foodPellets[i];
      const dx = player.x - pellet.x;
      const dy = player.y - pellet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < player.radius + pellet.radius) {
        // Consume food: Increase player's area by a small percentage (e.g., 5%)
        const playerArea = Math.PI * player.radius * player.radius;
        const pelletArea = Math.PI * pellet.radius * pellet.radius;
        const newArea = playerArea + pelletArea * 0.5; // 50% of pellet's area
        player.radius = Math.sqrt(newArea / Math.PI);
        player.score += 1;
        // Remove the food pellet
        foodPellets.splice(i, 1);
      }
    }
  }
}

// Update the game loop to include food spawning and collisions
const TICK_RATE = 1000 / 30;
setInterval(() => {
  spawnFood();          // Spawn food pellets if below MAX_FOOD
  updateGameState();    // Update player positions and collisions (players colliding with players)
  checkFoodCollisions(); // Check and handle collisions between players and food
  // Broadcast updated state (players and food) to clients
  io.sockets.emit('gameState', { players, food: foodPellets });
}, TICK_RATE);

// Update positions and handle collisions with boundaries and obstacles
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
    if (!p1) continue;

    for (let j = i + 1; j < ids.length; j++) {
      const p2 = players[ids[j]];
      if (!p2) continue;

      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < p1.radius + p2.radius) {
        // Determine relative difference in size as a ratio
        const diff = Math.abs(p1.radius - p2.radius);
        const threshold = 0.05 * Math.min(p1.radius, p2.radius); // 5% threshold

        if (diff < threshold) {
          // Sizes are nearly equal (or exactly equal): do nothing
          continue;
        } else {
          // Otherwise, the larger player absorbs the smaller one.
          if (p1.radius > p2.radius) {
            absorb(p1, p2);
            io.to(p2.id).emit('absorbed');
            delete players[p2.id];
          } else {
            absorb(p2, p1);
            io.to(p1.id).emit('absorbed');
            delete players[p1.id];
            break;
          }
        }
      }
    }
  }
}

// Helper function: larger absorbs smaller
function absorb(larger, smaller) {
  const largerArea = Math.PI * larger.radius * larger.radius;
  const smallerArea = Math.PI * smaller.radius * smaller.radius;
  // Only absorb a fraction of the smaller player's area (here 50%)
  const newArea = largerArea + (smallerArea * 0.5);
  larger.radius = Math.sqrt(newArea / Math.PI);
  larger.score += 1;
}

async function updatePlayerSession(player) {
  const environment = process.env.NODE_ENV || 'dev';
  const tableName = environment === 'prod' ? 'PlayerSessions-prod' : 'PlayerSessions-dev';

  const params = {
    TableName: tableName,
    Key: { sessionId: player.id },
    UpdateExpression: "set score = :score, radius = :radius, x = :x, y = :y, updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ":score": player.score,
      ":radius": player.radius,
      ":x": player.x,
      ":y": player.y,
      ":updatedAt": Date.now()
    }
  };

  try {
    await dynamoDB.send(new UpdateCommand(params));
  } catch (err) {
    console.error(`Error updating session for player ${player.id}:`, err);
  }
}

setInterval(() => {
  const playerIDs = Object.keys(players);
  playerIDs.forEach(async (id) => {
    const player = players[id];
    if (player) {
      await updatePlayerSession(player);
    }
  });
}, 5000); // Update every 5 seconds (adjust as needed)

// Start the server on a given port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});