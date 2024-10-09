import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const games = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinGame', (gameId) => {
    let game = games.get(gameId);
    if (!game) {
      game = {
        id: gameId,
        board: Array(9).fill(null),
        players: [],
        currentPlayer: 'X',
      };
      games.set(gameId, game);
    }

    if (game.players.length < 2) {
      const player = game.players.length === 0 ? 'X' : 'O';
      game.players.push({ id: socket.id, symbol: player });
      socket.join(gameId);
      socket.emit('playerAssigned', player);
      io.to(gameId).emit('gameState', game);

      if (game.players.length === 2) {
        io.to(gameId).emit('gameReady');
      }
    } else {
      socket.emit('gameFull');
    }
  });

  socket.on('move', ({ gameId, index }) => {
    const game = games.get(gameId);
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player || player.symbol !== game.currentPlayer || game.board[index] !== null) return;

    game.board[index] = player.symbol;
    game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';

    const winner = checkWinner(game.board);
    if (winner) {
      io.to(gameId).emit('gameOver', { winner });
    } else if (game.board.every(cell => cell !== null)) {
      io.to(gameId).emit('gameOver', { winner: 'Draw' });
    } else {
      io.to(gameId).emit('gameState', game);
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    games.forEach((game, gameId) => {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        game.players.splice(playerIndex, 1);
        if (game.players.length === 0) {
          games.delete(gameId);
        } else {
          io.to(gameId).emit('playerDisconnected');
        }
      }
    });
  });
});

function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});