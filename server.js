// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Import AWS SDK v3 clients
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Configure the AWS SDK v3 for DynamoDB
const REGION = "us-east-1"; // Change this to your preferred region
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

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Example event: when a player sends a "joinGame" event
  socket.on('joinGame', async (data) => {
    console.log(`Player ${socket.id} joined the game with data:`, data);
    
    // Prepare parameters to save the player's session in DynamoDB
    const params = {
      TableName: 'PlayerSessions', // Ensure this table exists in DynamoDB
      Item: {
        sessionId: socket.id,
        joinedAt: Date.now(),
        ...data, // Additional player data
      },
    };

    try {
      // Save the session using the v3 SDK command
      const result = await dynamoDB.send(new PutCommand(params));
      console.log("Player session saved:", result);
    } catch (err) {
      console.error("Error saving session:", err);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Optionally, remove the player session from DynamoDB here
  });
});

// Start the server on a given port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});