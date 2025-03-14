// MinesweeperGame.jsx
import React, { useState, useEffect } from "react";
import "./MinesweeperGame.css";

const MinesweeperGame = ({ board, onMove, onComplete }) => {
  const [revealed, setRevealed] = useState(
    Array(board.length)
      .fill()
      .map(() => Array(board[0].length).fill(false))
  );
  const [flagged, setFlagged] = useState(
    Array(board.length)
      .fill()
      .map(() => Array(board[0].length).fill(false))
  );
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  // Start timer when component mounts
  useEffect(() => {
    const timer = setInterval(() => {
      if (!gameOver && !gameWon) {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver, gameWon, startTime]);

  // Calculate if the game is won
  const isGameWon = () => {
    for (let y = 0; y < board.length; y++) {
      for (let x = 0; x < board[0].length; x++) {
        // If a non-mine cell is not revealed, game is not won
        if (board[y][x] !== "X" && !revealed[y][x]) {
          return false;
        }
      }
    }
    return true;
  };

  // Handle cell click
  const handleCellClick = (x, y) => {
    if (gameOver || gameWon || revealed[y][x] || flagged[y][x]) return;

    // Clone the revealed array
    const newRevealed = revealed.map((row) => [...row]);

    // If it's a mine, game over
    if (board[y][x] === "X") {
      setGameOver(true);
      // Reveal all mines
      for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board[0].length; j++) {
          if (board[i][j] === "X") {
            newRevealed[i][j] = true;
          }
        }
      }
      setRevealed(newRevealed);
      return;
    }

    // Reveal the clicked cell
    newRevealed[y][x] = true;

    // If it's an empty cell, reveal neighbors recursively
    if (board[y][x] === 0) {
      revealEmptyCells(x, y, newRevealed);
    }

    setRevealed(newRevealed);
    onMove(); // Increment move counter

    // Check if the game is won
    if (isGameWon()) {
      setGameWon(true);
      setGameOver(true);
      onComplete(); // Notify parent component of game completion
    }
  };

  // Handle right-click to flag
  const handleContextMenu = (e, x, y) => {
    e.preventDefault();
    if (gameOver || gameWon || revealed[y][x]) return;

    // Toggle flag
    const newFlagged = flagged.map((row) => [...row]);
    newFlagged[y][x] = !newFlagged[y][x];
    setFlagged(newFlagged);
  };

  // Reveal empty cells recursively
  const revealEmptyCells = (x, y, newRevealed) => {
    // Check all 8 adjacent cells
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;

        // Check if the cell is within bounds and not revealed yet
        if (
          nx >= 0 &&
          nx < board[0].length &&
          ny >= 0 &&
          ny < board.length &&
          !newRevealed[ny][nx] &&
          !flagged[ny][nx]
        ) {
          newRevealed[ny][nx] = true;

          // If this is also an empty cell, recursively reveal its neighbors
          if (board[ny][nx] === 0) {
            revealEmptyCells(nx, ny, newRevealed);
          }
        }
      }
    }
  };

  // Cell content renderer
  const renderCell = (x, y) => {
    if (!revealed[y][x]) {
      return flagged[y][x] ? "🚩" : null;
    }

    if (board[y][x] === "X") {
      return "💣";
    }

    return board[y][x] === 0 ? null : board[y][x];
  };

  // Cell color based on number
  const getCellColor = (x, y) => {
    if (!revealed[y][x] || board[y][x] === "X" || board[y][x] === 0) {
      return "";
    }

    const colors = [
      "", // 0 is empty
      "blue", // 1
      "green", // 2
      "red", // 3
      "darkblue", // 4
      "brown", // 5
      "teal", // 6
      "black", // 7
      "gray", // 8
    ];

    return colors[board[y][x]] || "";
  };

  // Cell class name generator
  const getCellClassName = (x, y) => {
    let className = "cell";

    if (revealed[y][x]) {
      className += " revealed";

      if (board[y][x] === "X") {
        className += " mine";
      }
    }

    if (flagged[y][x]) {
      className += " flagged";
    }

    return className;
  };

  return (
    <div className="minesweeper-game">
      <div className="game-header">
        <div className="mine-counter">
          💣{" "}
          {board.flat().filter((cell) => cell === "X").length -
            flagged.flat().filter(Boolean).length}
        </div>
        <div className="timer">⏱️ {elapsedTime}</div>
      </div>

      <div className="game-board">
        {board.map((row, y) => (
          <div key={y} className="row">
            {row.map((_, x) => (
              <div
                key={`${x}-${y}`}
                className={getCellClassName(x, y)}
                onClick={() => handleCellClick(x, y)}
                onContextMenu={(e) => handleContextMenu(e, x, y)}
                style={{ color: getCellColor(x, y) }}
              >
                {renderCell(x, y)}
              </div>
            ))}
          </div>
        ))}
      </div>

      {gameOver && !gameWon && (
        <div className="game-message game-over">Game Over! 💥</div>
      )}

      {gameWon && <div className="game-message game-won">You Win! 🏆</div>}
    </div>
  );
};

export default MinesweeperGame;
