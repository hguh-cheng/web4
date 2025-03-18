// server.js
const express = require("express");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const dotenv = require("dotenv");
const app = express();

dotenv.config();
app.use(express.json());
app.use(cors());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
});
app.use("/api/", apiLimiter);

const uri =
  process.env.MONGODB_URI || "mongodb://localhost:27017/minesweeperChallenge";
const client = new MongoClient(uri);
let db;

async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db("minesweeperChallenge");
    console.log("Connected to MongoDB");
    await db.collection("games").createIndex({ gameId: 1 }, { unique: true });
    await db.collection("games").createIndex({ playerAddress: 1 });
    await db
      .collection("games")
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  }
}

function generateMinefield(width, height, mineCount) {
  const safeX = Math.floor(width / 2);
  const safeY = Math.floor(height / 2);
  const board = Array(height)
    .fill()
    .map(() => Array(width).fill(0));
  let mines = 0;

  while (mines < mineCount) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    if (Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1) continue;
    if (board[y][x] !== "X") {
      board[y][x] = "X";
      mines++;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (board[y][x] === "X") continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (
            nx >= 0 &&
            nx < width &&
            ny >= 0 &&
            ny < height &&
            board[ny][nx] === "X"
          )
            count++;
        }
      }
      board[y][x] = count;
    }
  }
  return board;
}

app.post("/api/new-game", async (req, res) => {
  try {
    const { playerAddress, contestId } = req.body;
    if (!playerAddress || !playerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: "Invalid player address" });
    }

    const existingGame = await db
      .collection("games")
      .findOne({ playerAddress, contestId, completed: false });
    if (existingGame) {
      return res.json({
        gameId: existingGame.gameId,
        commitment: existingGame.commitment,
      });
    }

    const gameId = crypto.randomBytes(16).toString("hex");
    const difficulty = Math.min(3 + Math.floor(contestId / 10), 10);
    const width = 8 + difficulty;
    const height = 8 + difficulty;
    const mineCount = Math.floor(width * height * (0.12 + difficulty * 0.01));

    const board = generateMinefield(width, height, mineCount);
    const secret = crypto.randomBytes(32).toString("hex");
    const boardString = JSON.stringify(board);
    const dataToHash = boardString + secret + playerAddress;
    const commitment =
      "0x" + crypto.createHash("sha256").update(dataToHash).digest("hex");

    await db.collection("games").insertOne({
      gameId,
      playerAddress,
      contestId,
      board,
      secret,
      commitment,
      createdAt: new Date(),
      completed: false,
      moves: 0,
      timeTaken: 0,
    });

    res.json({ gameId, commitment });
  } catch (error) {
    console.error("Error creating new game:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/game/:gameId", async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerAddress } = req.query;
    if (!gameId || !playerAddress)
      return res.status(400).json({ error: "Missing required parameters" });

    const game = await db
      .collection("games")
      .findOne({ gameId, playerAddress });
    if (!game)
      return res.status(403).json({ error: "Game not found or unauthorized" });

    res.json({
      board: game.board,
      difficulty: game.board.length - 8,
      contestId: game.contestId,
    });
  } catch (error) {
    console.error("Error retrieving game:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/verify", async (req, res) => {
  try {
    const { gameId, moves, timeTaken, playerAddress } = req.body;
    if (!gameId || !moves || !timeTaken || !playerAddress) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const game = await db
      .collection("games")
      .findOne({ gameId, playerAddress });
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.completed)
      return res.status(400).json({ error: "Game already completed" });

    const dataToHash = `${gameId}:${moves}:${timeTaken}:${playerAddress}:${game.secret}`;
    const proof =
      "0x" + crypto.createHash("sha256").update(dataToHash).digest("hex");

    await db
      .collection("games")
      .updateOne(
        { gameId },
        { $set: { completed: true, moves, timeTaken, completedAt: new Date() } }
      );

    await db.collection("leaderboard").insertOne({
      gameId,
      playerAddress,
      contestId: game.contestId,
      moves,
      timeTaken,
      completedAt: new Date(),
      boardSize: `${game.board.length}x${game.board[0].length}`,
      mineCount: countMines(game.board),
    });

    res.json({ secret: "0x" + game.secret, proof, isValid: true });
  } catch (error) {
    console.error("Error verifying game:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/leaderboard/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;
    const limit = parseInt(req.query.limit) || 3; // Top 3 for prize distribution

    const leaderboard = await db
      .collection("leaderboard")
      .find({ contestId: parseInt(contestId) })
      .sort({ moves: 1, timeTaken: 1 })
      .limit(limit)
      .project({
        playerAddress: 1,
        moves: 1,
        timeTaken: 1,
        completedAt: 1,
        _id: 0,
      })
      .toArray();

    res.json({ leaderboard });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Server error" });
  }
});

function countMines(board) {
  return board.flat().filter((cell) => cell === "X").length;
}

async function startServer() {
  await connectToDatabase();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch(console.error);

process.on("SIGINT", async () => {
  try {
    await client.close();
    console.log("MongoDB connection closed");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});
