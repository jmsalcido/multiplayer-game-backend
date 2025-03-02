# Agar.io Clone

A multiplayer web-based game inspired by Agar.io, built with Node.js, Socket.IO, and Phaser.js.

## Features

- Real-time multiplayer gameplay
- Smooth animations with Phaser.js
- Player growth mechanics
- Leaderboard system
- Responsive design
- Mouse and keyboard controls

## Technologies Used

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript, Phaser.js
- **Database**: AWS DynamoDB (for leaderboard and player sessions)
- **Deployment**: Terraform for infrastructure

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/multiplayer-game-backend.git
   cd multiplayer-game-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   node server.js
   ```

4. Open the client in your browser:
   - For the basic client: `http://localhost:3000/client.html`
   - For the Phaser.js client: `http://localhost:3000/phaser-client.html`

## How to Play

1. Enter your username and click "Start Game"
2. Control your player using:
   - Arrow keys for keyboard movement
   - Mouse click and hold for mouse movement
3. Eat food pellets to grow larger
4. Absorb smaller players to grow even faster
5. Avoid larger players who can absorb you

## Development

### Running the Test Client

To simulate multiple players for testing:

```
node test-client.js
```

### Project Structure

- `server.js` - Main server file with game logic
- `simulation.js` - Test client for simulating multiple players
- `client.html` - Basic HTML5 Canvas client
- `phaser-client.html` - Advanced Phaser.js client
- `assets/` - Game assets (images, sounds)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by the original [Agar.io](https://agar.io/) game
- Built with [Phaser.js](https://phaser.io/) - HTML5 game framework
- Real-time communication with [Socket.IO](https://socket.io/) 