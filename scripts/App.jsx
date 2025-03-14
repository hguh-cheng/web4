// App.jsx
import React, { useState, useEffect } from "react";
import Web3 from "web3";
import MinesweeperChallengeABI from "./MinesweeperChallengeABI.json";
import MinesweeperGame from "./MinesweeperGame";
import "./App.css";

const CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"; // Replace with your contract address

function App() {
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [contract, setContract] = useState(null);
  const [currentContest, setCurrentContest] = useState(null);
  const [gameState, setGameState] = useState("idle"); // 'idle', 'playing', 'completed'
  const [gameId, setGameId] = useState(null);
  const [gameBoard, setGameBoard] = useState(null);
  const [commitment, setCommitment] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [moves, setMoves] = useState(0);

  // Initialize Web3
  useEffect(() => {
    const initWeb3 = async () => {
      // Modern browsers with MetaMask
      if (window.ethereum) {
        try {
          // Request account access
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);

          // Get accounts
          const accts = await web3Instance.eth.getAccounts();
          setAccounts(accts);

          // Initialize contract
          const contractInstance = new web3Instance.eth.Contract(
            MinesweeperChallengeABI,
            CONTRACT_ADDRESS
          );
          setContract(contractInstance);

          // Get current contest info
          const contestId = await contractInstance.methods
            .currentContestId()
            .call();
          const contestInfo = await contractInstance.methods
            .weeklyContests(contestId)
            .call();
          setCurrentContest({
            id: contestId,
            ...contestInfo,
          });
        } catch (error) {
          console.error("User denied account access or error:", error);
        }
      }
      // Legacy dapp browsers
      else if (window.web3) {
        const web3Instance = new Web3(window.web3.currentProvider);
        setWeb3(web3Instance);
      }
      // Non-dapp browsers
      else {
        console.log(
          "Non-Ethereum browser detected. Consider installing MetaMask!"
        );
      }
    };

    initWeb3();
  }, []);

  // Start a new game
  const startGame = async () => {
    if (!contract || !accounts[0]) return;

    try {
      // Step 1: Get new game from server
      const response = await fetch("/api/new-game", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerAddress: accounts[0] }),
      });

      const data = await response.json();
      setGameId(data.gameId);
      setCommitment(data.commitment);

      // Step 2: Enter the blockchain contest with the commitment
      await contract.methods
        .enterContest(currentContest.id, data.commitment)
        .send({
          from: accounts[0],
          value: currentContest.entryFee,
        });

      // Step 3: Fetch the game board from server
      const boardResponse = await fetch(
        `/api/game/${data.gameId}?playerAddress=${accounts[0]}`
      );
      const boardData = await boardResponse.json();
      setGameBoard(boardData.board);

      // Step 4: Start the game
      setGameState("playing");
      setStartTime(Date.now());
      setMoves(0);
    } catch (error) {
      console.error("Error starting game:", error);
    }
  };

  // Handle game completion
  const handleGameComplete = async () => {
    if (!contract || !accounts[0] || !gameId) return;

    const endTime = Date.now();
    const timeTaken = Math.floor((endTime - startTime) / 1000); // in seconds

    try {
      // Step 1: Get verification data from server
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId,
          moves,
          timeTaken,
        }),
      });

      const data = await response.json();

      // Step 2: Submit completion to the blockchain
      await contract.methods
        .submitGameCompletion(currentContest.id, moves, data.secret, data.proof)
        .send({
          from: accounts[0],
        });

      setGameState("completed");
    } catch (error) {
      console.error("Error completing game:", error);
    }
  };

  // Handle move counter
  const handleMove = () => {
    setMoves(moves + 1);
  };

  return (
    <div className="app-container">
      <header>
        <h1>Blockchain Minesweeper Challenge</h1>
        {accounts[0] && (
          <div className="account-info">
            Connected: {accounts[0].substring(0, 6)}...
            {accounts[0].substring(38)}
          </div>
        )}
      </header>

      <main>
        {!web3 && (
          <div className="metamask-prompt">
            <p>Please install and connect MetaMask to play!</p>
          </div>
        )}

        {web3 && currentContest && gameState === "idle" && (
          <div className="contest-info">
            <h2>Weekly Minesweeper Challenge</h2>
            <p>
              Entry Fee: {web3.utils.fromWei(currentContest.entryFee, "ether")}{" "}
              ETH
            </p>
            <p>
              Prize Pool:{" "}
              {web3.utils.fromWei(currentContest.totalPrizePool, "ether")} ETH
            </p>
            <p>Players: {currentContest.players.length}</p>
            <button onClick={startGame} className="start-button">
              Enter Contest
            </button>
          </div>
        )}

        {gameState === "playing" && gameBoard && (
          <div className="game-container">
            <div className="game-info">
              <p>Moves: {moves}</p>
              <p>Time: {Math.floor((Date.now() - startTime) / 1000)}s</p>
            </div>
            <MinesweeperGame
              board={gameBoard}
              onMove={handleMove}
              onComplete={handleGameComplete}
            />
          </div>
        )}

        {gameState === "completed" && (
          <div className="completion-message">
            <h2>Game Completed!</h2>
            <p>You completed the game in {moves} moves.</p>
            <p>
              Time taken: {Math.floor((Date.now() - startTime) / 1000)} seconds
            </p>
            <p>Your score has been submitted to the blockchain!</p>
            <button onClick={() => setGameState("idle")}>Play Again</button>
          </div>
        )}
      </main>

      <footer>
        <p>Blockchain Minesweeper Challenge - Powered by Ethereum</p>
      </footer>
    </div>
  );
}

export default App;
