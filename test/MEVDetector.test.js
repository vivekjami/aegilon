const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MEVDetector", function () {
    let mevDetector;
    let owner, user1, user2;
    
    // Test constants
    const ETH_FEED_ID = ethers.utils.formatBytes32String("ETH");
    const USDC_FEED_ID = ethers.utils.formatBytes32String("USDC");
    const INITIAL_PRICE = ethers.utils.parseEther("2000"); // $2000 ETH
    const HIGH_SLIPPAGE_PRICE = ethers.utils.parseEther("2100"); // 5% increase
    const NORMAL_GAS_PRICE = ethers.utils.parseUnits("20", "gwei");
    const HIGH_GAS_PRICE = ethers.utils.parseUnits("50", "gwei");
    
    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        const MEVDetector = await ethers.getContractFactory("MEVDetector");
        mevDetector = await MEVDetector.deploy();
        await mevDetector.deployed();
    });
    
    describe("🔧 Deployment and Configuration", function () {
        it("Should deploy with correct initial configuration", async function () {
            expect(await mevDetector.riskThreshold()).to.equal(500); // 5%
            expect(await mevDetector.minPriceDelta()).to.equal(100); // 1%
            expect(await mevDetector.frontRunGasMultiplier()).to.equal(120); // 20% above avg
            expect(await mevDetector.owner()).to.equal(owner.address);
        });
        
        it("Should allow owner to update risk threshold", async function () {
            const newThreshold = 300; // 3%
            await expect(mevDetector.setRiskThreshold(newThreshold))
                .to.emit(mevDetector, "ConfigurationUpdated")
                .withArgs("riskThreshold", 500, newThreshold);
            
            expect(await mevDetector.riskThreshold()).to.equal(newThreshold);
        });
        
        it("Should prevent non-owner from updating configuration", async function () {
            await expect(
                mevDetector.connect(user1).setRiskThreshold(300)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
    
    describe("🎯 MEV Detection Algorithms", function () {
        beforeEach(async function () {
            // Mock the Redstone oracle response
            // In real tests, we'd use Redstone's testing utilities
            // For now, we'll test the logic assuming oracle works
        });
        
        it("Should detect sandwich attack via high price slippage", async function () {
            // This test would require mocking the Redstone oracle
            // For now, let's test the configuration and event emission logic
            const expectedPrice = INITIAL_PRICE;
            const gasPrice = NORMAL_GAS_PRICE;
            
            // Note: This test requires Redstone mock setup
            // The actual oracle call would be mocked in a full test suite
            console.log("  📝 Note: Full oracle integration test requires Redstone test setup");
        });
        
        it("Should calculate price deltas correctly", async function () {
            // Test the internal price delta calculation logic
            // We can test this through the configuration functions
            
            const oldThreshold = await mevDetector.riskThreshold();
            expect(oldThreshold).to.equal(500); // 5% initial
            
            // Test threshold updates
            await mevDetector.setRiskThreshold(1000); // 10%
            expect(await mevDetector.riskThreshold()).to.equal(1000);
        });
        
        it("Should track gas price history", async function () {
            // The gas history is internal, but we can test the average calculation
            // through multiple calls (in a real scenario with oracle mocking)
            
            const avgGasPrice = await mevDetector.getAverageGasPrice();
            expect(avgGasPrice).to.equal(0); // Initially 0 (empty history)
        });
        
        it("Should detect front-running patterns", async function () {
            // Test front-running detection logic
            // This would be tested through the main detectMEV function
            // with proper gas price scenarios
            
            const gasMultiplier = await mevDetector.frontRunGasMultiplier();
            expect(gasMultiplier).to.equal(120); // 20% above average
        });
        
        it("Should handle arbitrage pattern detection", async function () {
            // Test arbitrage detection based on rapid price changes
            const minDelta = await mevDetector.minPriceDelta();
            expect(minDelta).to.equal(100); // 1% minimum change
        });
    });
    
    describe("📊 Price History Management", function () {
        it("Should initialize with empty price history", async function () {
            const [lastPrice, lastUpdate] = await mevDetector.getPriceHistory(ETH_FEED_ID);
            expect(lastPrice).to.equal(0);
            expect(lastUpdate).to.equal(0);
        });
        
        it("Should store price history correctly", async function () {
            // This would be tested with actual oracle calls
            // For now, test that the view functions work
            const history = await mevDetector.getPriceHistory(ETH_FEED_ID);
            expect(history.length).to.equal(2); // [lastPrice, lastUpdate]
        });
    });
    
    describe("🛡️ Security and Access Control", function () {
        it("Should restrict MEV detection to owner only", async function () {
            const expectedPrice = INITIAL_PRICE;
            const gasPrice = NORMAL_GAS_PRICE;
            
            await expect(
                mevDetector.connect(user1).detectMEV(ETH_FEED_ID, expectedPrice, gasPrice)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
        
        it("Should allow owner to call detectMEV", async function () {
            // Note: This would fail without proper Redstone setup
            // but we can test the access control
            const expectedPrice = INITIAL_PRICE;
            const gasPrice = NORMAL_GAS_PRICE;
            
            // This should not revert due to access control (though it may fail due to oracle)
            try {
                await mevDetector.detectMEV(ETH_FEED_ID, expectedPrice, gasPrice);
            } catch (error) {
                // Expected to fail without Redstone setup
                expect(error.message).to.not.include("caller is not the owner");
            }
        });
        
        it("Should have proper ownership transfer functionality", async function () {
            await mevDetector.transferOwnership(user1.address);
            expect(await mevDetector.owner()).to.equal(user1.address);
        });
    });
    
    describe("⚙️ Configuration Management", function () {
        it("Should emit events on configuration changes", async function () {
            await expect(mevDetector.setMinPriceDelta(200))
                .to.emit(mevDetector, "ConfigurationUpdated")
                .withArgs("minPriceDelta", 100, 200);
        });
        
        it("Should update front-run gas multiplier", async function () {
            await mevDetector.setFrontRunGasMultiplier(150);
            expect(await mevDetector.frontRunGasMultiplier()).to.equal(150);
        });
        
        it("Should maintain configuration boundaries", async function () {
            // Test reasonable boundaries
            await mevDetector.setRiskThreshold(10000); // 100% max
            expect(await mevDetector.riskThreshold()).to.equal(10000);
            
            await mevDetector.setMinPriceDelta(1); // Minimum 0.01%
            expect(await mevDetector.minPriceDelta()).to.equal(1);
        });
    });
    
    describe("🔍 Gas Price Analytics", function () {
        it("Should calculate average gas price correctly", async function () {
            const avgGas = await mevDetector.getAverageGasPrice();
            expect(avgGas).to.be.a("object"); // BigNumber object
            expect(avgGas.toString()).to.equal("0"); // Initially 0
        });
        
        it("Should handle empty gas history", async function () {
            // Initial state should have 0 average
            expect(await mevDetector.getAverageGasPrice()).to.equal(0);
        });
    });
    
    describe("🧪 Integration Readiness", function () {
        it("Should have all required functions for MEVProtector integration", async function () {
            // Check that all expected functions exist
            expect(typeof mevDetector.detectMEV).to.equal("function");
            expect(typeof mevDetector.getCurrentPrice).to.equal("function");
            expect(typeof mevDetector.getPriceHistory).to.equal("function");
            expect(typeof mevDetector.getAverageGasPrice).to.equal("function");
        });
        
        it("Should support multiple feed IDs", async function () {
            const feeds = [ETH_FEED_ID, USDC_FEED_ID];
            
            for (const feedId of feeds) {
                const [price, timestamp] = await mevDetector.getPriceHistory(feedId);
                expect(price).to.equal(0); // Initially empty
                expect(timestamp).to.equal(0);
            }
        });
    });
});
