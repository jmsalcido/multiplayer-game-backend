// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

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
  cors: { origin: "*" }, // Adjust CORS settings as needed for production
  pingTimeout: 30000,    // Reduced ping timeout for faster reconnections
  pingInterval: 10000,   // More frequent pings to detect disconnections faster
  transports: ['websocket', 'polling'], // Prefer websocket for better performance
  maxHttpBufferSize: 1e6 // 1MB max buffer size
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '/')));

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

// Track which players need DB updates
const playersNeedingUpdate = new Set();

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
      // Continue even if DynamoDB fails - don't block the game
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
      score: 0,
      username: data.username || 'Player',
      lastUpdate: Date.now(),   // Track last update time
      viewportWidth: data.viewportWidth || 1920,  // Store viewport width
      viewportHeight: data.viewportHeight || 1080 // Store viewport height
    };
    
    // Mark player for DB update
    playersNeedingUpdate.add(socket.id);
    
    // Send immediate game state update to the new player
    sendGameStateToPlayer(socket.id);
  });

  // Handle viewport size updates
  socket.on('updateViewport', (data) => {
    if (players[socket.id]) {
      // Update the player's viewport size
      players[socket.id].viewportWidth = data.width || players[socket.id].viewportWidth;
      players[socket.id].viewportHeight = data.height || players[socket.id].viewportHeight;
      console.log(`Player ${socket.id} updated viewport: ${data.width}x${data.height}`);
    }
  });

  // Listen for movement commands
  socket.on('move', (data) => {
    if (players[socket.id]) {
      // Update the player's velocity based on the input data
      players[socket.id].vx = data.vx;
      players[socket.id].vy = data.vy;
      players[socket.id].lastUpdate = Date.now();
      
      // Mark for DB update if significant change
      if (Math.abs(data.vx) > 0.1 || Math.abs(data.vy) > 0.1) {
        playersNeedingUpdate.add(socket.id);
      }
    }
  });

  // Handle disconnection: remove player from in-memory state.
  socket.on('disconnect', async () => {
    console.log(`Player disconnected: ${socket.id}`);
    if (players[socket.id]) {
      try {
        await updatePlayerSession(players[socket.id]);
        playersNeedingUpdate.delete(socket.id);
      } catch (err) {
        console.error(`Error updating session for disconnected player ${socket.id}:`, err);
      }
      delete players[socket.id];
    }
  });
});

// In-memory store for food pellets
const foodPellets = [];

// Maximum number of food pellets in the game world
const MAX_FOOD = 100;

// Define game boundaries (match the client's world size)
const GAME_BOUNDARY = { width: 2000, height: 2000 };

// Grid size for spatial partitioning
const GRID_SIZE = 200;
const grid = {};

// Initialize spatial grid
function initGrid() {
  for (let x = 0; x < GAME_BOUNDARY.width; x += GRID_SIZE) {
    for (let y = 0; y < GAME_BOUNDARY.height; y += GRID_SIZE) {
      const cellKey = `${Math.floor(x/GRID_SIZE)},${Math.floor(y/GRID_SIZE)}`;
      grid[cellKey] = { players: new Set(), food: new Set() };
    }
  }
}

// Initialize grid
initGrid();

// Get cell key for a position
function getCellKey(x, y) {
  return `${Math.floor(x/GRID_SIZE)},${Math.floor(y/GRID_SIZE)}`;
}

// Get neighboring cells
function getNeighboringCells(x, y) {
  const cellX = Math.floor(x/GRID_SIZE);
  const cellY = Math.floor(y/GRID_SIZE);
  const neighbors = [];
  
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const neighborKey = `${cellX + i},${cellY + j}`;
      if (grid[neighborKey]) {
        neighbors.push(neighborKey);
      }
    }
  }
  
  return neighbors;
}

// Update entity position in grid
function updateEntityInGrid(id, oldX, oldY, newX, newY, isPlayer) {
  // Remove from old cell
  if (oldX !== undefined && oldY !== undefined) {
    const oldCellKey = getCellKey(oldX, oldY);
    if (grid[oldCellKey]) {
      if (isPlayer) {
        grid[oldCellKey].players.delete(id);
      } else {
        grid[oldCellKey].food.delete(id);
      }
    }
  }
  
  // Add to new cell
  const newCellKey = getCellKey(newX, newY);
  if (grid[newCellKey]) {
    if (isPlayer) {
      grid[newCellKey].players.add(id);
    } else {
      grid[newCellKey].food.add(id);
    }
  }
}

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
    
    // Add to spatial grid
    updateEntityInGrid(newFood.id, undefined, undefined, newFood.x, newFood.y, false);
  }
}

// Check collisions between a player and food
function checkFoodCollisions() {
  for (let pid in players) {
    let player = players[pid];
    
    // Get neighboring cells for this player
    const neighborCells = getNeighboringCells(player.x, player.y);
    const nearbyFoodIds = new Set();
    
    // Collect food IDs from neighboring cells
    neighborCells.forEach(cellKey => {
      if (grid[cellKey]) {
        grid[cellKey].food.forEach(foodId => {
          nearbyFoodIds.add(foodId);
        });
      }
    });
    
    // Check collisions only with nearby food
    for (let i = foodPellets.length - 1; i >= 0; i--) {
      const pellet = foodPellets[i];
      
      // Skip if not in nearby cells
      if (!nearbyFoodIds.has(pellet.id)) continue;
      
      const dx = player.x - pellet.x;
      const dy = player.y - pellet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < player.radius + pellet.radius) {
        // Consume food: Increase player's area by a small percentage
        const playerArea = Math.PI * player.radius * player.radius;
        const pelletArea = Math.PI * pellet.radius * pellet.radius;
        const newArea = playerArea + pelletArea * 0.5; // 50% of pellet's area
        player.radius = Math.sqrt(newArea / Math.PI);
        player.score += 1;
        
        // Mark player for DB update
        playersNeedingUpdate.add(pid);
        
        // Remove from grid
        updateEntityInGrid(pellet.id, pellet.x, pellet.y, undefined, undefined, false);
        
        // Remove the food pellet
        foodPellets.splice(i, 1);
      }
    }
  }
}

// Send game state to a specific player
function sendGameStateToPlayer(playerId) {
  const player = players[playerId];
  if (!player) return;
  
  // Get viewport size from player data (default to reasonable values if not provided)
  const viewportWidth = player.viewportWidth || 1920;
  const viewportHeight = player.viewportHeight || 1080;
  
  // Calculate how many grid cells should be visible based on viewport size
  // Add a buffer of 1 cell to ensure smooth transitions
  const visibleCellsX = Math.ceil(viewportWidth / GRID_SIZE) + 2;
  const visibleCellsY = Math.ceil(viewportHeight / GRID_SIZE) + 2;
  const maxVisibleDistance = Math.max(visibleCellsX, visibleCellsY);
  
  // Get player's current cell
  const playerCellX = Math.floor(player.x / GRID_SIZE);
  const playerCellY = Math.floor(player.y / GRID_SIZE);
  
  // Collect nearby cells based on viewport size
  const neighborCells = [];
  const nearbyPlayerIds = new Set();
  const nearbyFoodIds = new Set();
  
  // Expand search radius based on viewport size
  for (let i = -maxVisibleDistance; i <= maxVisibleDistance; i++) {
    for (let j = -maxVisibleDistance; j <= maxVisibleDistance; j++) {
      // Skip cells that are too far (outside the visible area)
      if (Math.abs(i) > visibleCellsX || Math.abs(j) > visibleCellsY) continue;
      
      const neighborKey = `${playerCellX + i},${playerCellY + j}`;
      if (grid[neighborKey]) {
        neighborCells.push(neighborKey);
        
        // Collect entity IDs from this cell
        grid[neighborKey].players.forEach(id => {
          nearbyPlayerIds.add(id);
        });
        grid[neighborKey].food.forEach(id => {
          nearbyFoodIds.add(id);
        });
      }
    }
  }
  
  // Always include the player themselves
  nearbyPlayerIds.add(playerId);
  
  // Filter players and food to only those nearby
  const nearbyPlayers = {};
  nearbyPlayerIds.forEach(id => {
    if (players[id]) {
      nearbyPlayers[id] = players[id];
    }
  });
  
  const nearbyFood = foodPellets.filter(food => nearbyFoodIds.has(food.id));
  
  // Create grid cell information for visualization
  const visibleGridCells = {};
  neighborCells.forEach(cellKey => {
    if (grid[cellKey]) {
      const [cellX, cellY] = cellKey.split(',').map(Number);
      visibleGridCells[cellKey] = {
        x: cellX * GRID_SIZE,
        y: cellY * GRID_SIZE,
        width: GRID_SIZE,
        height: GRID_SIZE,
        playerCount: grid[cellKey].players.size,
        foodCount: grid[cellKey].food.size
      };
    }
  });
  
  // Create global leaderboard data (top 10 players by score)
  const allPlayers = Object.values(players);
  const leaderboardPlayers = allPlayers
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(p => ({
      id: p.id,
      username: p.username,
      score: p.score,
      isCurrentPlayer: p.id === playerId
    }));
  
  // Send filtered game state to this player
  io.to(playerId).emit('gameState', { 
    players: nearbyPlayers, 
    food: nearbyFood,
    fullPlayerCount: Object.keys(players).length, // Send total player count for UI
    gridCells: visibleGridCells,
    gridSize: GRID_SIZE,
    visibleCellsX: visibleCellsX,
    visibleCellsY: visibleCellsY,
    leaderboard: leaderboardPlayers // Add global leaderboard data
  });
}

// Update the game loop to include food spawning and collisions
const TICK_RATE = 1000 / 30;
setInterval(() => {
  try {
    spawnFood();          // Spawn food pellets if below MAX_FOOD
    updateGameState();    // Update player positions and collisions (players colliding with players)
    checkFoodCollisions(); // Check and handle collisions between players and food
    
    // Log spatial partitioning stats every 5 seconds
    const now = Date.now();
    if (!global.lastStatsTime || now - global.lastStatsTime > 5000) {
      global.lastStatsTime = now;
      
      // Count entities in grid
      let totalPlayersInGrid = 0;
      let totalFoodInGrid = 0;
      let nonEmptyCells = 0;
      
      for (const cellKey in grid) {
        const cell = grid[cellKey];
        if (cell.players.size > 0 || cell.food.size > 0) {
          nonEmptyCells++;
          totalPlayersInGrid += cell.players.size;
          totalFoodInGrid += cell.food.size;
        }
      }
      
      console.log(`--- Spatial Partitioning Stats ---`);
      console.log(`Total players: ${Object.keys(players).length}, In grid: ${totalPlayersInGrid}`);
      console.log(`Total food: ${foodPellets.length}, In grid: ${totalFoodInGrid}`);
      console.log(`Non-empty cells: ${nonEmptyCells} of ${Object.keys(grid).length}`);
      console.log(`----------------------------------`);
    }
    
    // Update each player's grid position and send them relevant game state
    for (let id in players) {
      sendGameStateToPlayer(id);
    }
  } catch (error) {
    console.error('Error in game loop:', error);
  }
}, TICK_RATE);

// Update positions and handle collisions with boundaries and obstacles
function updateGameState() {
  // Update each player's position based on their velocity
  for (let id in players) {
    let p = players[id];
    const oldX = p.x;
    const oldY = p.y;
    
    p.x += p.vx;
    p.y += p.vy;
    
    // Add boundary checks
    p.x = Math.max(p.radius, Math.min(GAME_BOUNDARY.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(GAME_BOUNDARY.height - p.radius, p.y));
    
    // Update grid position if moved
    if (oldX !== p.x || oldY !== p.y) {
      updateEntityInGrid(id, oldX, oldY, p.x, p.y, true);
    }
  }

  // Collision detection using spatial partitioning
  for (let id in players) {
    const p1 = players[id];
    if (!p1) continue;
    
    // Get neighboring cells for this player
    const neighborCells = getNeighboringCells(p1.x, p1.y);
    const nearbyPlayerIds = new Set();
    
    // Collect player IDs from neighboring cells
    neighborCells.forEach(cellKey => {
      if (grid[cellKey]) {
        grid[cellKey].players.forEach(pid => {
          if (pid !== id) { // Don't include self
            nearbyPlayerIds.add(pid);
          }
        });
      }
    });
    
    // Check collisions only with nearby players
    for (const otherId of nearbyPlayerIds) {
      const p2 = players[otherId];
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
            
            // Remove from grid
            updateEntityInGrid(p2.id, p2.x, p2.y, undefined, undefined, true);
            
            delete players[p2.id];
            playersNeedingUpdate.add(id); // Mark absorber for update
          } else {
            absorb(p2, p1);
            io.to(p1.id).emit('absorbed');
            
            // Remove from grid
            updateEntityInGrid(p1.id, p1.x, p1.y, undefined, undefined, true);
            
            delete players[p1.id];
            playersNeedingUpdate.add(otherId); // Mark absorber for update
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

// Batch update players to DynamoDB less frequently
setInterval(async () => {
  // Process players that need updates in batches
  const batchSize = 5;
  const playerIds = Array.from(playersNeedingUpdate);
  
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize);
    
    // Process batch in parallel
    await Promise.all(batch.map(async (id) => {
      const player = players[id];
      if (player) {
        try {
          await updatePlayerSession(player);
          playersNeedingUpdate.delete(id);
        } catch (err) {
          console.error(`Error in batch update for player ${id}:`, err);
        }
      } else {
        playersNeedingUpdate.delete(id);
      }
    }));
  }
}, 10000); // Update every 10 seconds

// Start the server on a given port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});