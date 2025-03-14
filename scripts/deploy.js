// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying MinesweeperChallenge contract...");

  // Get the ContractFactory for MinesweeperChallenge
  const MinesweeperChallenge = await ethers.getContractFactory(
    "MinesweeperChallenge"
  );

  // Deploy the contract
  const minesweeperChallenge = await MinesweeperChallenge.deploy();

  // Wait for deployment to complete
  await minesweeperChallenge.deployed();

  console.log(
    "MinesweeperChallenge deployed to:",
    minesweeperChallenge.address
  );

  // Create an initial contest (starts now, ends in 7 days, 0.01 ETH entry fee)
  const now = Math.floor(Date.now() / 1000);
  const oneWeekFromNow = now + 7 * 24 * 60 * 60;
  const entryFee = ethers.utils.parseEther("0.01");

  console.log("Creating initial weekly contest...");
  const tx = await minesweeperChallenge.createWeeklyContest(
    now,
    oneWeekFromNow,
    entryFee
  );

  // Wait for transaction to be mined
  await tx.wait();

  console.log("Weekly contest created successfully!");
  console.log("  Start time:", new Date(now * 1000).toLocaleString());
  console.log("  End time:", new Date(oneWeekFromNow * 1000).toLocaleString());
  console.log("  Entry fee:", ethers.utils.formatEther(entryFee), "ETH");

  console.log("\nVerifying contract on Etherscan...");
  try {
    await run("verify:verify", {
      address: minesweeperChallenge.address,
      constructorArguments: [],
    });
    console.log("Contract verified on Etherscan!");
  } catch (error) {
    console.log("Error verifying contract:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
