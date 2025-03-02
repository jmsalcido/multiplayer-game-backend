// Script to open the Phaser client in the browser
const { exec } = require('child_process');
const os = require('os');

const url = 'http://localhost:3000/phaser-client.html';

// Determine the command based on the operating system
let command;
switch (os.platform()) {
  case 'darwin':  // macOS
    command = `open "${url}"`;
    break;
  case 'win32':   // Windows
    command = `start "${url}"`;
    break;
  default:        // Linux and others
    command = `xdg-open "${url}"`;
    break;
}

console.log(`Opening ${url} in your default browser...`);
exec(command, (error) => {
  if (error) {
    console.error(`Failed to open browser: ${error}`);
    return;
  }
  console.log('Browser opened successfully!');
}); 