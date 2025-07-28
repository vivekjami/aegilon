// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@redstone-finance/evm-connector/contracts/data-services/MainDemoConsumerBase.sol";

/**
 * @title MEVDetector
 * @dev Core MEV detection algorithms for Aegilon Protocol
 * @notice Detects sandwich attacks, front-running, and arbitrage-based MEV
 */
contract MEVDetector is Ownable, MainDemoConsumerBase {
    
    // Risk threshold in basis points (500 = 5%)
    uint256 public riskThreshold = 500;
    
    // Minimum price delta to consider significant
    uint256 public minPriceDelta = 100; // 1% in basis points
    
    // Front-running gas threshold multiplier (120 = 20% above average)
    uint256 public frontRunGasMultiplier = 120;
    
    // Track last known prices for each feed
    mapping(bytes32 => uint256) public lastPrices;
    mapping(bytes32 => uint256) public lastUpdateTimestamp;
    
    // Track historical gas prices for baseline
    uint256[] private gasHistory;
    uint256 private gasHistoryIndex;
    uint256 public constant GAS_HISTORY_SIZE = 100;
    
    // MEV threat types
    enum ThreatType {
        SANDWICH,
        FRONTRUN,
        ARBITRAGE,
        UNKNOWN
    }
    
    // Events
    event MEVThreatDetected(
        address indexed user,
        bytes32 indexed feedId,
        ThreatType threatType,
        uint256 riskScore,
        uint256 timestamp
    );
    
    event PriceAnomalyDetected(
        bytes32 indexed feedId,
        uint256 expectedPrice,
        uint256 actualPrice,
        uint256 delta
    );
    
    event ConfigurationUpdated(
        string parameter,
        uint256 oldValue,
        uint256 newValue
    );
    
    constructor() Ownable() {
        // Initialize gas history array
        for (uint i = 0; i < GAS_HISTORY_SIZE; i++) {
            gasHistory.push(0);
        }
        // Transfer ownership to deployer
        _transferOwnership(msg.sender);
    }
    
    /**
     * @dev Main MEV detection function for price-based attacks
     * @param feedId The price feed identifier (e.g., "ETH", "USDC")
     * @param expectedPrice Expected price from user's perspective
     * @param txGasPrice Gas price of the current transaction
     * @return isThreat Whether MEV threat was detected
     * @return threatType Type of MEV threat detected
     * @return riskScore Risk score (0-10000 basis points)
     */
    function detectMEV(
        bytes32 feedId,
        uint256 expectedPrice,
        uint256 txGasPrice
    ) external onlyOwner returns (
        bool isThreat,
        ThreatType threatType,
        uint256 riskScore
    ) {
        // Get current oracle price
        uint256 currentPrice = getOracleNumericValueFromTxMsg(feedId);
        
        // Update price history
        lastPrices[feedId] = currentPrice;
        lastUpdateTimestamp[feedId] = block.timestamp;
        
        // Calculate price delta and slippage
        uint256 delta = currentPrice > expectedPrice ? 
            currentPrice - expectedPrice : 
            expectedPrice - currentPrice;
        uint256 slippagePercentage = (delta * 10000) / expectedPrice;
        
        // Update gas history
        _updateGasHistory(txGasPrice);
        
        // Detect sandwich attack (high slippage)
        if (slippagePercentage > riskThreshold) {
            riskScore = slippagePercentage;
            threatType = ThreatType.SANDWICH;
            isThreat = true;
            
            emit MEVThreatDetected(
                msg.sender,
                feedId,
                threatType,
                riskScore,
                block.timestamp
            );
            
            emit PriceAnomalyDetected(
                feedId,
                expectedPrice,
                currentPrice,
                delta
            );
            
            return (isThreat, threatType, riskScore);
        }
        
        // Detect front-running (abnormal gas price)
        uint256 avgGasPrice = _getAverageGasPrice();
        if (avgGasPrice > 0 && _detectFrontRunning(txGasPrice, avgGasPrice)) {
            riskScore = ((txGasPrice - avgGasPrice) * 10000) / avgGasPrice;
            threatType = ThreatType.FRONTRUN;
            isThreat = true;
            
            emit MEVThreatDetected(
                msg.sender,
                feedId,
                threatType,
                riskScore,
                block.timestamp
            );
            
            return (isThreat, threatType, riskScore);
        }
        
        // Detect arbitrage patterns (rapid price changes)
        if (_detectArbitragePattern(feedId, currentPrice)) {
            riskScore = 300; // Fixed score for arbitrage detection
            threatType = ThreatType.ARBITRAGE;
            isThreat = true;
            
            emit MEVThreatDetected(
                msg.sender,
                feedId,
                threatType,
                riskScore,
                block.timestamp
            );
            
            return (isThreat, threatType, riskScore);
        }
        
        return (false, ThreatType.UNKNOWN, 0);
    }
    
    /**
     * @dev Simplified front-running detection
     * @param txGasPrice Current transaction gas price
     * @param avgGasPrice Average historical gas price
     * @return Whether front-running is detected
     */
    function _detectFrontRunning(
        uint256 txGasPrice,
        uint256 avgGasPrice
    ) internal view returns (bool) {
        return txGasPrice > (avgGasPrice * frontRunGasMultiplier / 100);
    }
    
    /**
     * @dev Detect arbitrage patterns based on rapid price movements
     * @param feedId Price feed identifier
     * @param currentPrice Current price from oracle
     * @return Whether arbitrage pattern is detected
     */
    function _detectArbitragePattern(
        bytes32 feedId,
        uint256 currentPrice
    ) internal view returns (bool) {
        uint256 lastPrice = lastPrices[feedId];
        uint256 lastUpdate = lastUpdateTimestamp[feedId];
        
        // Skip if no historical data
        if (lastPrice == 0 || lastUpdate == 0) {
            return false;
        }
        
        // Check for rapid price change (within 30 seconds)
        if (block.timestamp - lastUpdate <= 30) {
            uint256 priceChange = currentPrice > lastPrice ?
                currentPrice - lastPrice :
                lastPrice - currentPrice;
            uint256 changePercentage = (priceChange * 10000) / lastPrice;
            
            // Flag if price changed more than minPriceDelta in short time
            return changePercentage > minPriceDelta;
        }
        
        return false;
    }
    
    /**
     * @dev Update gas price history for baseline calculation
     * @param gasPrice Current gas price to add to history
     */
    function _updateGasHistory(uint256 gasPrice) internal {
        gasHistory[gasHistoryIndex] = gasPrice;
        gasHistoryIndex = (gasHistoryIndex + 1) % GAS_HISTORY_SIZE;
    }
    
    /**
     * @dev Calculate average gas price from history
     * @return Average gas price
     */
    function _getAverageGasPrice() internal view returns (uint256) {
        uint256 sum = 0;
        uint256 count = 0;
        
        for (uint i = 0; i < GAS_HISTORY_SIZE; i++) {
            if (gasHistory[i] > 0) {
                sum += gasHistory[i];
                count++;
            }
        }
        
        return count > 0 ? sum / count : 0;
    }
    
    /**
     * @dev Get current price for a feed (external view function)
     * @param feedId Price feed identifier
     * @return Current price from oracle
     */
    function getCurrentPrice(bytes32 feedId) external view returns (uint256) {
        return getOracleNumericValueFromTxMsg(feedId);
    }
    
    /**
     * @dev Get historical price data
     * @param feedId Price feed identifier
     * @return lastPrice Last recorded price
     * @return lastUpdate Timestamp of last update
     */
    function getPriceHistory(bytes32 feedId) external view returns (
        uint256 lastPrice,
        uint256 lastUpdate
    ) {
        return (lastPrices[feedId], lastUpdateTimestamp[feedId]);
    }
    
    // Configuration functions
    function setRiskThreshold(uint256 newThreshold) external onlyOwner {
        uint256 oldThreshold = riskThreshold;
        riskThreshold = newThreshold;
        emit ConfigurationUpdated("riskThreshold", oldThreshold, newThreshold);
    }
    
    function setMinPriceDelta(uint256 newDelta) external onlyOwner {
        uint256 oldDelta = minPriceDelta;
        minPriceDelta = newDelta;
        emit ConfigurationUpdated("minPriceDelta", oldDelta, newDelta);
    }
    
    function setFrontRunGasMultiplier(uint256 newMultiplier) external onlyOwner {
        uint256 oldMultiplier = frontRunGasMultiplier;
        frontRunGasMultiplier = newMultiplier;
        emit ConfigurationUpdated("frontRunGasMultiplier", oldMultiplier, newMultiplier);
    }
    
    /**
     * @dev Emergency function to get average gas price (external view)
     * @return Current average gas price from history
     */
    function getAverageGasPrice() external view returns (uint256) {
        return _getAverageGasPrice();
    }
}
