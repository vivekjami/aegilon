const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    console.log("🚀 Starting Aegilon deployment to Etherlink...");
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    
    // Check deployer balance
    const balance = await deployer.getBalance();
    console.log("💰 Account balance:", ethers.utils.formatEther(balance), "ETH");
    
    if (balance.lt(ethers.utils.parseEther("0.01"))) {
        console.error("❌ Insufficient balance for deployment. Need at least 0.01 ETH");
        process.exit(1);
    }
    
    // Define deployment addresses
    const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
    const liquidityRewardsAddress = process.env.LIQUIDITY_REWARDS_ADDRESS || deployer.address;
    
    console.log("🏛️  Treasury Address:", treasuryAddress);
    console.log("💧 Liquidity Rewards Address:", liquidityRewardsAddress);
    
    // 1. Deploy Aegilon Token ($AEG)
    console.log("\n📊 Deploying Aegilon Token ($AEG)...");
    const AegilonToken = await ethers.getContractFactory("AegilonToken");
    const aegilonToken = await AegilonToken.deploy(
        treasuryAddress,
        liquidityRewardsAddress,
        {
            gasLimit: 3000000,
            gasPrice: ethers.utils.parseUnits("10", "gwei")
        }
    );
    
    await aegilonToken.deployed();
    console.log("✅ AegilonToken deployed to:", aegilonToken.address);
    
    // 2. Deploy MEV Protector
    console.log("\n🛡️  Deploying MEV Protector...");
    const MEVProtector = await ethers.getContractFactory("MEVProtector");
    const mevProtector = await MEVProtector.deploy(
        aegilonToken.address,
        {
            gasLimit: 4000000,
            gasPrice: ethers.utils.parseUnits("10", "gwei")
        }
    );
    
    await mevProtector.deployed();
    console.log("✅ MEVProtector deployed to:", mevProtector.address);
    
    // 3. Configure Token-Protector Integration
    console.log("\n🔗 Configuring contract integration...");
    
    // Set MEV Protector contract in token
    const setProtectorTx = await aegilonToken.setMEVProtectorContract(mevProtector.address);
    await setProtectorTx.wait();
    console.log("✅ MEV Protector contract set in AegilonToken");
    
    // Set authorized indexer (deployer for now, will be Goldsky in production)
    const setIndexerTx = await mevProtector.setAuthorizedIndexer(deployer.address);
    await setIndexerTx.wait();
    console.log("✅ Authorized indexer set in MEVProtector");
    
    // 4. Verify deployments
    console.log("\n🔍 Verifying deployments...");
    
    // Check token total supply
    const totalSupply = await aegilonToken.totalSupply();
    console.log("📊 Total AEG Supply:", ethers.utils.formatEther(totalSupply));
    
    // Check initial balances
    const treasuryBalance = await aegilonToken.balanceOf(treasuryAddress);
    const liquidityBalance = await aegilonToken.balanceOf(liquidityRewardsAddress);
    const deployerBalance = await aegilonToken.balanceOf(deployer.address);
    
    console.log("🏛️  Treasury Balance:", ethers.utils.formatEther(treasuryBalance), "AEG");
    console.log("💧 Liquidity Balance:", ethers.utils.formatEther(liquidityBalance), "AEG");
    console.log("👤 Deployer Balance:", ethers.utils.formatEther(deployerBalance), "AEG");
    
    // Check MEV Protector configuration
    const protectorTokenAddress = await mevProtector.aegilonToken();
    console.log("🛡️  MEV Protector Token Address:", protectorTokenAddress);
    console.log("🔗 Integration Check:", protectorTokenAddress === aegilonToken.address ? "✅ Success" : "❌ Failed");
    
    // 5. Save deployment info
    const deploymentInfo = {
        network: network.name,
        chainId: network.config.chainId,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            aegilonToken: {
                address: aegilonToken.address,
                deploymentHash: aegilonToken.deployTransaction.hash
            },
            mevProtector: {
                address: mevProtector.address,
                deploymentHash: mevProtector.deployTransaction.hash
            }
        },
        configuration: {
            treasuryAddress,
            liquidityRewardsAddress,
            totalSupply: ethers.utils.formatEther(totalSupply),
            initialDistribution: {
                treasury: ethers.utils.formatEther(treasuryBalance),
                liquidity: ethers.utils.formatEther(liquidityBalance),
                deployer: ethers.utils.formatEther(deployerBalance)
            }
        }
    };
    
    console.log("\n📄 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // Save to file
    const fs = require("fs");
    const path = require("path");
    
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentsDir, `${network.name}-deployment.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("💾 Deployment info saved to:", deploymentFile);
    
    // 6. Next steps
    console.log("\n🎯 Next Steps:");
    console.log("1. 🔍 Verify contracts on block explorer");
    console.log("2. 🏗️  Configure Goldsky subgraph with these addresses");
    console.log("3. 🔗 Update frontend with contract addresses");
    console.log("4. 💧 Add liquidity to DEX pools");
    console.log("5. 🎉 Launch Aegilon MEV Protection!");
    
    console.log("\n🚀 Deployment completed successfully!");
    
    return deploymentInfo;
}

// Execute deployment
main()
    .then((deploymentInfo) => {
        console.log("✅ Deployment script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
