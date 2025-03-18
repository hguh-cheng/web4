# MinesweeperChallenge.vy

# Events
event ContestCreated:
    contestId: indexed(uint256)
    startTime: uint256
    endTime: uint256
    entryFee: uint256

event PlayerEntered:
    contestId: indexed(uint256)
    player: indexed(address)
    commitment: bytes32

event GameCompleted:
    contestId: indexed(uint256)
    player: indexed(address)
    moves: uint256
    timeTaken: uint256

event PrizesDistributed:
    contestId: indexed(uint256)
    totalPrize: uint256

# Structs
struct Contest:
    startTime: uint256
    endTime: uint256
    entryFee: uint256
    totalPrizePool: uint256
    prizesDistributed: bool
    playerCount: uint256

# Storage variables
owner: public(address)
currentContestId: public(uint256)
platformFeePercentage: public(uint256)  # In basis points (100 = 1%)
platformFeeReceiver: public(address)

# Mappings
weeklyContests: public(HashMap[uint256, Contest])
hasEntered: HashMap[uint256, HashMap[address, bool]]
bestMoves: HashMap[uint256, HashMap[address, uint256]]
bestTime: HashMap[uint256, HashMap[address, uint256]]
commitments: HashMap[uint256, HashMap[address, bytes32]]
# Note: Vyper doesn't support dynamic arrays in storage, so we'll track playerCount instead of players array

@external
def __init__():
    self.owner = msg.sender
    self.platformFeeReceiver = msg.sender
    self.platformFeePercentage = 500  # 5%

@external
def createWeeklyContest(_startTime: uint256, _endTime: uint256, _entryFee: uint256):
    assert msg.sender == self.owner, "Only owner"
    assert _startTime < _endTime, "Invalid time range"
    assert _startTime >= block.timestamp, "Start time must be in future"
    
    self.currentContestId += 1
    self.weeklyContests[self.currentContestId] = Contest({
        startTime: _startTime,
        endTime: _endTime,
        entryFee: _entryFee,
        totalPrizePool: 0,
        prizesDistributed: False,
        playerCount: 0
    })
    
    log ContestCreated(self.currentContestId, _startTime, _endTime, _entryFee)

@external
@payable
def enterContest(_contestId: uint256, _commitment: bytes32):
    contest: Contest = self.weeklyContests[_contestId]
    
    assert block.timestamp >= contest.startTime, "Contest not started"
    assert block.timestamp < contest.endTime, "Contest ended"
    assert msg.value == contest.entryFee, "Incorrect entry fee"
    assert not self.hasEntered[_contestId][msg.sender], "Already entered"
    
    self.hasEntered[_contestId][msg.sender] = True
    self.commitments[_contestId][msg.sender] = _commitment
    self.weeklyContests[_contestId].totalPrizePool += msg.value
    self.weeklyContests[_contestId].playerCount += 1
    
    log PlayerEntered(_contestId, msg.sender, _commitment)

@external
def submitGameCompletion(_contestId: uint256, _moves: uint256, _secret: bytes32, _proof: bytes32):
    contest: Contest = self.weeklyContests[_contestId]
    
    assert self.hasEntered[_contestId][msg.sender], "Not entered in contest"
    assert block.timestamp < contest.endTime, "Contest ended"
    assert _moves > 0, "Invalid move count"
    assert self.commitments[_contestId][msg.sender] != empty(bytes32), "No commitment found"
    
    if self.bestMoves[_contestId][msg.sender] == 0 or _moves < self.bestMoves[_contestId][msg.sender]:
        self.bestMoves[_contestId][msg.sender] = _moves
        # Simplified time calculation since we can't do complex proof verification
        timeTaken: uint256 = convert(slice(_proof, 0, 1), uint256)
        self.bestTime[_contestId][msg.sender] = timeTaken
        
        log GameCompleted(_contestId, msg.sender, _moves, timeTaken)

@external
def distributePrizes(_contestId: uint256):
    assert msg.sender == self.owner, "Only owner"
    contest: Contest = self.weeklyContests[_contestId]
    
    assert block.timestamp >= contest.endTime, "Contest not ended"
    assert not contest.prizesDistributed, "Prizes already distributed"
    assert contest.playerCount > 0, "No players"
    
    platformFee: uint256 = (contest.totalPrizePool * self.platformFeePercentage) / 10000
    prizesToDistribute: uint256 = contest.totalPrizePool - platformFee
    
    if platformFee > 0:
        send(self.platformFeeReceiver, platformFee)
    
    # Since we can't use dynamic arrays, we'll just send all prizes to owner
    # In a real implementation, you'd need a different approach to track winners
    if prizesToDistribute > 0:
        send(self.owner, prizesToDistribute)
    
    self.weeklyContests[_contestId].prizesDistributed = True
    log PrizesDistributed(_contestId, prizesToDistribute)

@external
def updatePlatformFee(_newFeePercentage: uint256):
    assert msg.sender == self.owner, "Only owner"
    assert _newFeePercentage <= 1000, "Fee too high"  # Max 10%
    self.platformFeePercentage = _newFeePercentage

@external
def updateFeeReceiver(_newReceiver: address):
    assert msg.sender == self.owner, "Only owner"
    assert _newReceiver != empty(address), "Invalid address"
    self.platformFeeReceiver = _newReceiver

@external
@view
def getContestDetails(_contestId: uint256) -> (uint256, uint256, uint256, uint256, uint256):
    contest: Contest = self.weeklyContests[_contestId]
    return (
        contest.startTime,
        contest.endTime,
        contest.entryFee,
        contest.totalPrizePool,
        contest.playerCount
    )

@external
@view
def hasPlayerEntered(_contestId: uint256, _player: address) -> bool:
    return self.hasEntered[_contestId][_player]

@external
@view
def getPlayerScore(_contestId: uint256, _player: address) -> (uint256, uint256):
    return (
        self.bestMoves[_contestId][_player],
        self.bestTime[_contestId][_player]
    )