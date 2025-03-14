// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MinesweeperChallenge
 * @dev A smart contract for running weekly Minesweeper challenges with prizes
 */
contract MinesweeperChallenge is Ownable, ReentrancyGuard {
    struct Contest {
        uint256 startTime;
        uint256 endTime;
        uint256 entryFee;
        uint256 totalPrizePool;
        address[] players;
        mapping(address => bool) hasEntered;
        mapping(address => uint256) bestMoves;
        mapping(address => uint256) bestTime;
        mapping(address => bytes32) commitments;
        bool prizesDistributed;
    }

    // Contest ID to Contest mapping
    mapping(uint256 => Contest) public weeklyContests;
    uint256 public currentContestId;
    
    // Fee percentage taken by the platform (in basis points, 100 = 1%)
    uint256 public platformFeePercentage = 500; // 5%
    address public platformFeeReceiver;
    
    // Events
    event ContestCreated(uint256 indexed contestId, uint256 startTime, uint256 endTime, uint256 entryFee);
    event PlayerEntered(uint256 indexed contestId, address indexed player, bytes32 commitment);
    event GameCompleted(uint256 indexed contestId, address indexed player, uint256 moves, uint256 timeTaken);
    event PrizesDistributed(uint256 indexed contestId, uint256 totalPrize);
    
    constructor() {
        platformFeeReceiver = msg.sender;
    }
    
    /**
     * @dev Create a weekly contest
     * @param _startTime Start timestamp of the contest
     * @param _endTime End timestamp of the contest
     * @param _entryFee Fee to enter the contest in wei
     */
    function createWeeklyContest(uint256 _startTime, uint256 _endTime, uint256 _entryFee) external onlyOwner {
        require(_startTime < _endTime, "Invalid time range");
        require(_startTime >= block.timestamp, "Start time must be in the future");
        
        currentContestId++;
        Contest storage newContest = weeklyContests[currentContestId];
        newContest.startTime = _startTime;
        newContest.endTime = _endTime;
        newContest.entryFee = _entryFee;
        
        emit ContestCreated(currentContestId, _startTime, _endTime, _entryFee);
    }
    
    /**
     * @dev Enter a contest with a commitment
     * @param _contestId ID of the contest to enter
     * @param _commitment Hash commitment of the game board
     */
    function enterContest(uint256 _contestId, bytes32 _commitment) external payable nonReentrant {
        Contest storage contest = weeklyContests[_contestId];
        
        require(block.timestamp >= contest.startTime, "Contest not started");
        require(block.timestamp < contest.endTime, "Contest ended");
        require(msg.value == contest.entryFee, "Incorrect entry fee");
        require(!contest.hasEntered[msg.sender], "Already entered");
        
        // Record the entry
        contest.players.push(msg.sender);
        contest.hasEntered[msg.sender] = true;
        contest.commitments[msg.sender] = _commitment;
        contest.totalPrizePool += msg.value;
        
        emit PlayerEntered(_contestId, msg.sender, _commitment);
    }
    
    /**
     * @dev Submit a completed game
     * @param _contestId ID of the contest
     * @param _moves Number of moves taken
     * @param _secret Original secret used in the commitment
     * @param _proof Proof of game completion
     */
    function submitGameCompletion(
        uint256 _contestId,
        uint256 _moves,
        bytes32 _secret,
        bytes32 _proof
    ) external nonReentrant {
        Contest storage contest = weeklyContests[_contestId];
        
        require(contest.hasEntered[msg.sender], "Not entered in contest");
        require(block.timestamp < contest.endTime, "Contest ended");
        require(_moves > 0, "Invalid move count");
        
        // Verify the commitment
        bytes32 commitment = contest.commitments[msg.sender];
        require(commitment != bytes32(0), "No commitment found");
        
        // Store best score (lowest moves)
        if (contest.bestMoves[msg.sender] == 0 || _moves < contest.bestMoves[msg.sender]) {
            contest.bestMoves[msg.sender] = _moves;
            
            // Calculate time taken based on the proof (simplified)
            uint256 timeTaken = uint256(uint8(_proof[0])); // Just for demonstration
            contest.bestTime[msg.sender] = timeTaken;
            
            emit GameCompleted(_contestId, msg.sender, _moves, timeTaken);
        }
    }
    
    /**
     * @dev Distribute prizes for a contest
     * @param _contestId ID of the contest
     */
    function distributePrizes(uint256 _contestId) external onlyOwner nonReentrant {
        Contest storage contest = weeklyContests[_contestId];
        
        require(block.timestamp >= contest.endTime, "Contest not ended");
        require(!contest.prizesDistributed, "Prizes already distributed");
        require(contest.players.length > 0, "No players");
        
        // Take platform fee
        uint256 platformFee = (contest.totalPrizePool * platformFeePercentage) / 10000;
        uint256 prizesToDistribute = contest.totalPrizePool - platformFee;
        
        // Send platform fee
        if (platformFee > 0) {
            (bool feeSuccess, ) = platformFeeReceiver.call{value: platformFee}("");
            require(feeSuccess, "Platform fee transfer failed");
        }
        
        // Calculate prize distribution based on moves and time
        address[] memory winners = new address[](3);
        uint256[] memory scores = new uint256[](3);
        
        // Initialize with max values
        for (uint i = 0; i < 3; i++) {
            scores[i] = type(uint256).max;
        }
        
        // Find top 3 players (lowest moves, then fastest time)
        for (uint i = 0; i < contest.players.length; i++) {
            address player = contest.players[i];
            uint256 moves = contest.bestMoves[player];
            
            // Skip players who didn't submit a completion
            if (moves == 0) continue;
            
            uint256 time = contest.bestTime[player];
            uint256 score = moves * 1000 + time; // Composite score
            
            // Check if this player places in top 3
            for (uint j = 0; j < 3; j++) {
                if (score < scores[j]) {
                    // Shift previous places down
                    for (uint k = 2; k > j; k--) {
                        scores[k] = scores[k-1];
                        winners[k] = winners[k-1];
                    }
                    scores[j] = score;
                    winners[j] = player;
                    break;
                }
            }
        }
        
        // Distribute prizes: 50% to 1st, 30% to 2nd, 20% to 3rd
        uint256[] memory prizeShares = new uint256[](3);
        prizeShares[0] = prizesToDistribute * 50 / 100;
        prizeShares[1] = prizesToDistribute * 30 / 100;
        prizeShares[2] = prizesToDistribute * 20 / 100;
        
        // Send prizes
        uint256 totalSent = 0;
        for (uint i = 0; i < 3; i++) {
            if (winners[i] != address(0) && prizeShares[i] > 0) {
                (bool success, ) = winners[i].call{value: prizeShares[i]}("");
                require(success, "Prize transfer failed");
                totalSent += prizeShares[i];
            }
        }
        
        // If less than 3 winners, send remaining prize to owner
        if (totalSent < prizesToDistribute) {
            uint256 remaining = prizesToDistribute - totalSent;
            (bool success, ) = owner().call{value: remaining}("");
            require(success, "Remaining prize transfer failed");
        }
        
        contest.prizesDistributed = true;
        emit PrizesDistributed(_contestId, prizesToDistribute);
    }
    
    /**
     * @dev Update platform fee percentage
     * @param _newFeePercentage New fee percentage in basis points
     */
    function updatePlatformFee(uint256 _newFeePercentage) external onlyOwner {
        require(_newFeePercentage <= 1000, "Fee too high"); // Max 10%
        platformFeePercentage = _newFeePercentage;
    }
    
    /**
     * @dev Update fee receiver address
     * @param _newReceiver New address to receive platform fees
     */
    function updateFeeReceiver(address _newReceiver) external onlyOwner {
        require(_newReceiver != address(0), "Invalid address");
        platformFeeReceiver = _newReceiver;
    }
    
    /**
     * @dev Get contest details
     * @param _contestId ID of the contest
     * @return startTime Start timestamp of the contest
     * @return endTime End timestamp of the contest
     * @return entryFee Fee to enter the contest in wei
     * @return totalPrizePool Total prize pool in wei
     * @return playerCount Number of players in the contest
     */
    function getContestDetails(uint256 _contestId) external view returns (
        uint256 startTime,
        uint256 endTime,
        uint256 entryFee,
        uint256 totalPrizePool,
        uint256 playerCount
    ) {
        Contest storage contest = weeklyContests[_contestId];
        return (
            contest.startTime,
            contest.endTime,
            contest.entryFee,
            contest.totalPrizePool,
            contest.players.length
        );
    }
    
    /**
     * @dev Check if a player has entered a contest
     * @param _contestId ID of the contest
     * @param _player Address of the player
     * @return True if the player has entered the contest
     */
    function hasPlayerEntered(uint256 _contestId, address _player) external view returns (bool) {
        return weeklyContests[_contestId].hasEntered[_player];
    }
    
    /**
     * @dev Get player's best score in a contest
     * @param _contestId ID of the contest
     * @param _player Address of the player
     * @return moves Best moves score
     * @return time Best time score
     */
    function getPlayerScore(uint256 _contestId, address _player) external view returns (uint256 moves, uint256 time) {
        Contest storage contest = weeklyContests[_contestId];
        return (contest.bestMoves[_player], contest.bestTime[_player]);
    }
}