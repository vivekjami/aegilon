const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    const [signer] = await ethers.getSigners();
    const balance = await signer.getBalance();
    const network = await ethers.provider.getNetwork();
    
    console.log("🏦 Wallet Balance Check");
    console.log("======================");
    console.log("Address:", signer.address);
    console.log("Network:", network.name, "| Chain ID:", network.chainId);
    console.log("Balance:", ethers.utils.formatEther(balance), "XTZ");
    
    if (balance.lt(ethers.utils.parseEther("5"))) {
        console.log("⚠️  WARNING: Balance below 5 XTZ");
        console.log("💡 Get testnet XTZ from: https://faucet.etherlink.com");
        return false;
    } else {
        console.log("✅ Sufficient balance for testing");
        return true;
    }
}

main()
    .then((sufficient) => process.exit(sufficient ? 0 : 1))
    .catch((error) => {
        console.error("❌ Balance check failed:", error);
        process.exit(1);
    });
