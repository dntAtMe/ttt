import { useState, useEffect, ChangeEvent } from 'react';
import { X, Circle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

type Player = 'X' | 'O';
type BoardState = (Player | null)[];

interface GameState {
  board: BoardState;
  currentPlayer: Player;
}

interface GameOverPayload {
  winner: Player | 'Draw';
}

const useSocket = (url: string): Socket | null => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(url);
    setSocket(newSocket);
    return () => { newSocket.disconnect(); }
  }, [url]);

  return socket;
};

interface UseGameReturn {
  player: Player | null;
  gameState: GameState | null;
  winner: Player | 'Draw' | null;
  error: string | null;
  joinGame: () => void;
  makeMove: (index: number) => void;
}

const useGame = (socket: Socket | null, gameId: string): UseGameReturn => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handlers: { [key: string]: (...args: any[]) => void } = {
      playerAssigned: (assignedPlayer: Player) => {
        setPlayer(assignedPlayer);
        setError(null);
      },
      gameState: (newGameState: GameState) => {
        setGameState(newGameState);
        setWinner(null);
      },
      gameReady: () => setError(null),
      gameFull: () => setError('This game is full. Please try another game ID.'),
      gameOver: ({ winner }: GameOverPayload) => setWinner(winner),
      playerDisconnected: () => setError('The other player has disconnected. Please start a new game.'),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach((event) => {
        socket.off(event);
      });
    };
  }, [socket]);

  const joinGame = () => {
    if (socket && gameId) socket.emit('joinGame', gameId);
  };

  const makeMove = (index: number) => {
    if (socket && gameState && player === gameState.currentPlayer && !gameState.board[index]) {
      socket.emit('move', { gameId, index });
    }
  };

  return { player, gameState, winner, error, joinGame, makeMove };
};

interface CellProps {
  value: Player | null;
  onClick: () => void;
  disabled: boolean;
}

const Cell = ({ value, onClick, disabled }: CellProps) => (
  <button
    className="w-20 h-20 bg-white border border-gray-300 flex items-center justify-center text-4xl font-bold"
    onClick={onClick}
    disabled={disabled}
  >
    {value === 'X' && <X className="w-12 h-12 text-blue-500" />}
    {value === 'O' && <Circle className="w-12 h-12 text-red-500" />}
  </button>
);

const App = () => {
  const socket = useSocket(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000');
  const [gameId, setGameId] = useState<string>('');
  const { player, gameState, winner, error, joinGame, makeMove } = useGame(socket, gameId);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setGameId(e.target.value);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-8">Multiplayer Tic-Tac-Toe</h1>
      {!player ? (
        <div className="mb-4">
          <input
            type="text"
            value={gameId}
            onChange={handleInputChange}
            placeholder="Enter game ID"
            className="border border-gray-300 rounded px-2 py-1 mr-2"
          />
          <button
            onClick={joinGame}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Join Game
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 text-xl">You are player: {player}</div>
          <div className="grid grid-cols-3 gap-2 mb-8">
            {gameState?.board.map((cell, index) => (
              <Cell
                key={index}
                value={cell}
                onClick={() => makeMove(index)}
                disabled={!gameState || player !== gameState.currentPlayer || !!winner}
              />
            ))}
          </div>
          {winner ? (
            <div className="text-2xl font-bold mb-4">
              {winner === 'Draw' ? "It's a draw!" : `Player ${winner} wins!`}
            </div>
          ) : gameState ? (
            <div className="text-2xl font-bold mb-4">
              Current player: {gameState.currentPlayer}
            </div>
          ) : null}
        </>
      )}
      {error && <div className="text-red-500 mt-4">{error}</div>}
    </div>
  );
};

export default App;
