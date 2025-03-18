const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying MinesweeperChallenge contract...");

  // Get the ContractFactory (Vyper contracts need to be compiled differently)
  const MinesweeperChallenge = await ethers.getContractFactory(
    "MinesweeperChallenge",
    {
      // Specify that this is a Vyper contract
      vyper: true,
    }
  );

  // Deploy the contract
  const minesweeperChallenge = await MinesweeperChallenge.deploy();
  await minesweeperChallenge.deployed();

  console.log(
    "MinesweeperChallenge deployed to:",
    minesweeperChallenge.address
  );

  // Create an initial contest
  const now = Math.floor(Date.now() / 1000);
  const oneWeekFromNow = now + 7 * 24 * 60 * 60;
  const entryFee = ethers.utils.parseEther("0.01");

  console.log("Creating initial weekly contest...");
  const tx = await minesweeperChallenge.createWeeklyContest(
    now,
    oneWeekFromNow,
    entryFee
  );
  await tx.wait();

  console.log("Weekly contest created successfully!");
  console.log("  Start time:", new Date(now * 1000).toLocaleString());
  console.log("  End time:", new Date(oneWeekFromNow * 1000).toLocaleString());
  console.log("  Entry fee:", ethers.utils.formatEther(entryFee), "ETH");

  console.log("\nVerifying contract on Etherscan...");
  try {
    await hre.run("verify:verify", {
      address: minesweeperChallenge.address,
      constructorArguments: [],
      contract: "MinesweeperChallenge.vy:MinesweeperChallenge", // Adjust for Vyper
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
