# Blockchain Minesweeper Challenge

A competitive Minesweeper game where players stake ETH to play, with prizes distributed based on completion time. This project demonstrates the integration of Web2 and Web3 technologies, using blockchain for secure financial transactions while keeping gameplay private.

## Architecture Overview

This project uses a hybrid architecture:

1. **Smart Contract (Blockchain)**: Handles entry fees, game commitments, and prize distribution
2. **Backend Server**: Generates mine fields and verifies game completion
3. **Frontend**: User interface for playing the game, connecting to both the blockchain and server

### Key Security Feature: Commit-Reveal Pattern

The project solves the blockchain "transparency problem" (where all data is public) by using a cryptographic commit-reveal pattern:

1. The server generates a minefield and creates a cryptographic commitment (hash)
2. Only the commitment is stored on the blockchain, not the actual minefield
3. Players interact with the server to play the game
4. Upon completion, cryptographic proofs verify the game was played legitimately

This prevents cheating while maintaining game integrity.

## Contract Features

- Weekly contests with configurable start/end times and entry fees
- Secure board commitments using cryptographic techniques
- Prize distribution based on completion time
- Event emission for game tracking

## How to Play

1. Connect your MetaMask wallet
2. Pay the entry fee to join the current contest
3. Play Minesweeper - complete the game as quickly as possible
4. Upon completion, your performance is verified and recorded on the blockchain
5. After the contest ends, prizes are distributed to players based on performance

## Technical Components

### Smart Contract

- Written in Solidity 0.8.x
- Uses OpenZeppelin libraries for security
- Handles entry fees and prize distribution
- Stores cryptographic commitments of game boards

### Backend Server

- Node.js with Express
- Generates random minefields
- Creates cryptographic commitments
- Verifies game completion

### Frontend

- React-based UI
- Web3.js for blockchain connectivity
- Classic Minesweeper gameplay
- Metamask integration

## Security Considerations

- **Prevent Board Exposure**: Mine positions are never stored on the blockchain
- **Cryptographic Verification**: Ensures game completion is legitimate
- **Server-side Validation**: Prevents client-side manipulation
- **Rate Limiting**: Prevents automation/bot abuse

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure environment variables in `.env`:
   ```
   REACT_APP_CONTRACT_ADDRESS=your_deployed_contract_address
   REACT_APP_SERVER_URL=your_backend_server_url
   ```
4. Start the development server:
   ```
   npm start
   ```

## Deployment

1. Deploy the smart contract:
   ```
   npx hardhat run scripts/deploy.js --network sepolia
   ```
2. Deploy the backend server (Node.js/Express)
3. Deploy the frontend application

## Smart Contract Deployment Information

- Network: Sepolia Test Network
- Contract Address: 0x... (fill in after deployment)
- Block Explorer Link: https://sepolia.etherscan.io/address/0x... (fill in after deployment)

## How Prize Distribution Works

1. Entry fees form the prize pool for each weekly contest
2. When the contest ends, prizes are distributed based on a weighted formula:
   - 60% of the pool goes to the fastest completions
   - 30% to the players with the fewest moves
   - 10% distributed equally among all participants who completed the game

## Future Enhancements

- Mobile-responsive design
- Multiple difficulty levels with different stake amounts
- Tournament mode with brackets
- NFT rewards for champions
- Decentralized board generation using VRF (Verifiable Random Function)

## References

This project was inspired by the Web3VoteExample and extends its concepts into a gaming context.

## License

MIT License
