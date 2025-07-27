const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🛡️ Aegilon MEV Protection Suite", function () {
    let aegilonToken;
    let mevProtector;
    let owner;
    let treasury;
    let liquidityRewards;
    let user1;
    let user2;
    let attacker;
    let indexer;

    beforeEach(async function () {
        // Get signers
        [owner, treasury, liquidityRewards, user1, user2, attacker, indexer] = await ethers.getSigners();

        // Deploy AegilonToken
        const AegilonToken = await ethers.getContractFactory("AegilonToken");
        aegilonToken = await AegilonToken.deploy(treasury.address, liquidityRewards.address);
        await aegilonToken.deployed();

        // Deploy MEVProtector
        const MEVProtector = await ethers.getContractFactory("MEVProtector");
        mevProtector = await MEVProtector.deploy(aegilonToken.address);
        await mevProtector.deployed();

        // Configure integration
        await aegilonToken.setMEVProtectorContract(mevProtector.address);
        await mevProtector.setAuthorizedIndexer(indexer.address);

        // Transfer some tokens to users for testing
        const userAllocation = ethers.utils.parseEther("1000"); // 1000 AEG per user
        await aegilonToken.transfer(user1.address, userAllocation);
        await aegilonToken.transfer(user2.address, userAllocation);
    });

    describe("📊 AegilonToken ($AEG)", function () {
        it("Should have correct initial setup", async function () {
            expect(await aegilonToken.name()).to.equal("Aegilon Token");
            expect(await aegilonToken.symbol()).to.equal("AEG");
            expect(await aegilonToken.totalSupply()).to.equal(ethers.utils.parseEther("10000000"));
        });

        it("Should distribute tokens correctly", async function () {
            const treasuryBalance = await aegilonToken.balanceOf(treasury.address);
            const liquidityBalance = await aegilonToken.balanceOf(liquidityRewards.address);
            
            expect(treasuryBalance).to.equal(ethers.utils.parseEther("3000000")); // 30%
            expect(liquidityBalance).to.equal(ethers.utils.parseEther("4000000")); // 40%
        });

        it("Should allow users to stake tokens", async function () {
            const stakeAmount = ethers.utils.parseEther("100");
            
            await aegilonToken.connect(user1).stakeTokens(stakeAmount);
            
            expect(await aegilonToken.stakedBalance(user1.address)).to.equal(stakeAmount);
            expect(await aegilonToken.getProtectionLevel(user1.address)).to.equal(2); // 100 AEG = level 2
        });

        it("Should calculate staking rewards correctly", async function () {
            const stakeAmount = ethers.utils.parseEther("1000");
            
            await aegilonToken.connect(user1).stakeTokens(stakeAmount);
            
            // Fast forward time by 1 year
            await network.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
            await network.provider.send("evm_mine");
            
            const rewards = await aegilonToken.calculateStakingRewards(user1.address);
            
            // Should be approximately 5% APR (may have protection boost)
            expect(rewards).to.be.gt(ethers.utils.parseEther("40")); // At least 4% (considering boost)
        });

        it("Should allow users to unstake tokens", async function () {
            const stakeAmount = ethers.utils.parseEther("100");
            const unstakeAmount = ethers.utils.parseEther("50");
            
            await aegilonToken.connect(user1).stakeTokens(stakeAmount);
            await aegilonToken.connect(user1).unstakeTokens(unstakeAmount);
            
            expect(await aegilonToken.stakedBalance(user1.address)).to.equal(unstakeAmount);
        });
    });

    describe("🛡️ MEVProtector", function () {
        beforeEach(async function () {
            // Stake tokens for user1 to enable protection
            const stakeAmount = ethers.utils.parseEther("1000");
            await aegilonToken.connect(user1).stakeTokens(stakeAmount);
        });

        it("Should activate protection for staked users", async function () {
            await mevProtector.connect(user1).activateProtection();
            
            const protectionStatus = await mevProtector.getUserProtectionStatus(user1.address);
            expect(protectionStatus.protected).to.be.true;
            expect(protectionStatus.level).to.equal(3); // 1000 AEG = level 3
        });

        it("Should reject protection activation for unstaked users", async function () {
            await expect(
                mevProtector.connect(user2).activateProtection()
            ).to.be.revertedWith("Insufficient AEG tokens staked for protection");
        });

        it("Should detect MEV threats", async function () {
            await mevProtector.connect(user1).activateProtection();
            
            const threatType = 0; // SandwichAttack
            const transactionData = ethers.utils.hexlify(ethers.utils.randomBytes(32));
            
            const tx = await mevProtector.connect(indexer).detectMEVThreat(
                user1.address,
                attacker.address,
                threatType,
                transactionData
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "MEVThreatDetected");
            
            expect(event).to.not.be.undefined;
            expect(event.args.target).to.equal(user1.address);
            expect(event.args.attacker).to.equal(attacker.address);
        });

        it("Should prevent MEV attacks for protected users", async function () {
            await mevProtector.connect(user1).activateProtection();
            
            const threatType = 0; // SandwichAttack
            const transactionData = ethers.utils.hexlify(ethers.utils.randomBytes(32));
            
            const tx = await mevProtector.connect(indexer).detectMEVThreat(
                user1.address,
                attacker.address,
                threatType,
                transactionData
            );
            
            const receipt = await tx.wait();
            const preventedEvent = receipt.events.find(e => e.event === "MEVThreatPrevented");
            
            expect(preventedEvent).to.not.be.undefined;
            expect(preventedEvent.args.protectedUser).to.equal(user1.address);
        });

        it("Should reward threat reporters", async function () {
            const initialBalance = await aegilonToken.balanceOf(user2.address);
            
            // First, detect a threat
            const threatType = 1; // Frontrunning
            const transactionData = ethers.utils.hexlify(ethers.utils.randomBytes(32));
            
            const threatTx = await mevProtector.connect(indexer).detectMEVThreat(
                user1.address,
                attacker.address,
                threatType,
                transactionData
            );
            
            const threatReceipt = await threatTx.wait();
            const threatEvent = threatReceipt.events.find(e => e.event === "MEVThreatDetected");
            const threatId = threatEvent.args.threatId;
            
            // Now report the threat
            await mevProtector.connect(user2).reportThreat(threatId);
            
            const finalBalance = await aegilonToken.balanceOf(user2.address);
            const expectedReward = await mevProtector.threatReportReward();
            
            expect(finalBalance.sub(initialBalance)).to.equal(expectedReward);
        });

        it("Should update oracle prices", async function () {
            const symbol = "ETH";
            const price = ethers.utils.parseEther("2000"); // $2000 ETH
            
            await mevProtector.connect(indexer).updateOraclePrice(symbol, price);
            
            expect(await mevProtector.lastOraclePrices(symbol)).to.equal(price);
        });

        it("Should detect price anomalies", async function () {
            const symbol = "ETH";
            const oraclePrice = ethers.utils.parseEther("2000"); // $2000 ETH
            const anomalousPrice = ethers.utils.parseEther("2100"); // $2100 ETH (+5% deviation)
            
            await mevProtector.connect(indexer).updateOraclePrice(symbol, oraclePrice);
            
            const isAnomaly = await mevProtector.checkPriceAnomaly(symbol, anomalousPrice);
            expect(isAnomaly).to.be.true; // 5% deviation > 2% threshold
        });
    });

    describe("🔗 Integration Tests", function () {
        it("Should handle complete MEV protection flow", async function () {
            // 1. User stakes tokens
            const stakeAmount = ethers.utils.parseEther("5000");
            await aegilonToken.connect(user1).stakeTokens(stakeAmount);
            
            // 2. User activates protection
            await mevProtector.connect(user1).activateProtection();
            
            // 3. MEV threat is detected
            const threatType = 0; // SandwichAttack
            const transactionData = ethers.utils.hexlify(ethers.utils.randomBytes(32));
            
            const threatTx = await mevProtector.connect(indexer).detectMEVThreat(
                user1.address,
                attacker.address,
                threatType,
                transactionData
            );
            
            // 4. Verify protection occurred
            const receipt = await threatTx.wait();
            const preventedEvent = receipt.events.find(e => e.event === "MEVThreatPrevented");
            
            expect(preventedEvent).to.not.be.undefined;
            
            // 5. Check user received protection success reward
            const protectionStatus = await mevProtector.getUserProtectionStatus(user1.address);
            expect(protectionStatus.preventedCount).to.equal(1);
        });

        it("Should scale protection based on staked amount", async function () {
            // User with minimal stake (level 1)
            await aegilonToken.connect(user2).stakeTokens(ethers.utils.parseEther("10"));
            await mevProtector.connect(user2).activateProtection();
            
            // User with high stake (level 4)
            await aegilonToken.connect(user1).stakeTokens(ethers.utils.parseEther("5000"));
            await mevProtector.connect(user1).activateProtection();
            
            const user1Status = await mevProtector.getUserProtectionStatus(user1.address);
            const user2Status = await mevProtector.getUserProtectionStatus(user2.address);
            
            expect(user1Status.level).to.be.gt(user2Status.level);
            expect(user1Status.level).to.equal(4); // 5000 AEG = level 4
            expect(user2Status.level).to.equal(1); // 10 AEG = level 1
        });
    });

    describe("🔒 Security Tests", function () {
        it("Should prevent unauthorized threat detection", async function () {
            await expect(
                mevProtector.connect(attacker).detectMEVThreat(
                    user1.address,
                    attacker.address,
                    0,
                    "0x"
                )
            ).to.be.revertedWith("Only authorized indexer");
        });

        it("Should prevent unauthorized oracle updates", async function () {
            await expect(
                mevProtector.connect(attacker).updateOraclePrice("ETH", ethers.utils.parseEther("2000"))
            ).to.be.revertedWith("Only authorized indexer");
        });

        it("Should prevent double threat reporting", async function () {
            // Detect threat first
            const threatType = 0;
            const transactionData = ethers.utils.hexlify(ethers.utils.randomBytes(32));
            
            const threatTx = await mevProtector.connect(indexer).detectMEVThreat(
                user1.address,
                attacker.address,
                threatType,
                transactionData
            );
            
            const receipt = await threatTx.wait();
            const threatEvent = receipt.events.find(e => e.event === "MEVThreatDetected");
            const threatId = threatEvent.args.threatId;
            
            // First report should succeed
            await mevProtector.connect(user2).reportThreat(threatId);
            
            // Second report of same threat should fail
            await expect(
                mevProtector.connect(indexer).detectMEVThreat(
                    user1.address,
                    attacker.address,
                    threatType,
                    transactionData
                )
            ).to.be.revertedWith("Threat already detected");
        });
    });
});
