const { spawn } = require('child_process');
const open = require('open');
const path = require('path');
const http = require('http');

console.log('Starting multiplayer game server...');

// Start the server
const server = spawn('node', ['server.js'], {
  stdio: 'inherit'
});

// Function to check if server is running
function checkServerRunning(retries = 0, maxRetries = 10) {
  if (retries >= maxRetries) {
    console.error('Server did not start after maximum retries');
    return;
  }

  http.get('http://localhost:3000', (res) => {
    if (res.statusCode === 200) {
      console.log('Server is running. Opening game client...');
      // Open the Phaser client in the default browser
      const clientPath = path.join('http://localhost:3000', 'phaser-client.html');
      open(clientPath);
    }
  }).on('error', (err) => {
    console.log(`Server not ready yet, retrying in 1 second... (${retries + 1}/${maxRetries})`);
    setTimeout(() => checkServerRunning(retries + 1, maxRetries), 1000);
  });
}

// Wait a bit for the server to start, then check if it's running
setTimeout(() => checkServerRunning(), 2000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Stopping server...');
  server.kill();
  process.exit();
});

console.log('To stop the server, press Ctrl+C'); 