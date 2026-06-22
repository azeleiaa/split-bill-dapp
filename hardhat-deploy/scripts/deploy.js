const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying SplitBill contract...");

  const SplitBill = await ethers.getContractFactory("SplitBill");
  const contract = await SplitBill.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ SplitBill deployed to:", address);
  console.log("");
  console.log("👉 Copy this address into app.js → CONTRACT_ADDRESS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
