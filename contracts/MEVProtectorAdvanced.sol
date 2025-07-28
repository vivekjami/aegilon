// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MEVDetector.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MEVProtector
 * @dev Advanced MEV protection mechanism for Aegilon Protocol
 * @notice Provides real-time MEV protection for swaps and transactions
 */
contract MEVProtectorAdvanced is ReentrancyGuard, Ownable {
    
    MEVDetector public detector;
    address public treasury;
    
    // Protection fees in basis points (100 = 1%)
    uint256 public protectionFee = 100; // 1%
    uint256 public maxProtectionFee = 500; // 5% maximum
    
    // Protection strategies
    enum ProtectionStrategy {
        REVERT,      // Revert transaction if MEV detected
        ADJUST,      // Adjust slippage parameters
        DELAY,       // Add delay to avoid MEV
        PRIVATE_RELAY // Route through private mempool
    }
    
    // Protection configuration per user
    struct ProtectionConfig {
        bool isActive;
        ProtectionStrategy strategy;
        uint256 maxSlippage; // In basis points
        uint256 gasLimit;
        bool whitelistMode; // Only allow whitelisted tokens
    }
    
    // Swap parameters
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        bytes32 pricefeedId;
        uint256 deadline;
        address recipient;
    }
    
    // Protection statistics
    struct ProtectionStats {
        uint256 totalProtectedSwaps;
        uint256 threatsDetected;
        uint256 threatsBlocked;
        uint256 totalValueProtected; // In USD equivalent
        uint256 feesCollected;
    }
    
    // State variables
    mapping(address => ProtectionConfig) public userConfigs;
    mapping(address => ProtectionStats) public userStats;
    mapping(address => bool) public whitelistedTokens;
    mapping(bytes32 => uint256) public priceDelays; // Delay queue for price-based protection
    
    ProtectionStats public globalStats;
    
    // Events
    event ProtectionActivated(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        ProtectionStrategy strategy
    );
    
    event ThreatMitigated(
        address indexed user,
        bytes32 indexed feedId,
        MEVDetector.ThreatType threatType,
        uint256 riskScore,
        ProtectionStrategy strategy
    );
    
    event SwapProtected(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 protectionFee
    );
    
    event ConfigurationUpdated(
        address indexed user,
        ProtectionStrategy strategy,
        uint256 maxSlippage
    );
    
    event EmergencyStop(
        address indexed user,
        string reason
    );
    
    constructor(address _detector, address _treasury) Ownable() {
        detector = MEVDetector(_detector);
        treasury = _treasury;
        _transferOwnership(msg.sender);
        
        // Initialize global stats
        globalStats = ProtectionStats({
            totalProtectedSwaps: 0,
            threatsDetected: 0,
            threatsBlocked: 0,
            totalValueProtected: 0,
            feesCollected: 0
        });
    }
    
    /**
     * @dev Configure protection settings for user
     * @param strategy Protection strategy to use
     * @param maxSlippage Maximum acceptable slippage in basis points
     * @param gasLimit Gas limit for protected transactions
     * @param whitelistMode Whether to enable whitelist mode
     */
    function configureProtection(
        ProtectionStrategy strategy,
        uint256 maxSlippage,
        uint256 gasLimit,
        bool whitelistMode
    ) external {
        require(maxSlippage <= 1000, "Slippage too high"); // Max 10%
        require(gasLimit >= 100000, "Gas limit too low");
        
        userConfigs[msg.sender] = ProtectionConfig({
            isActive: true,
            strategy: strategy,
            maxSlippage: maxSlippage,
            gasLimit: gasLimit,
            whitelistMode: whitelistMode
        });
        
        emit ConfigurationUpdated(msg.sender, strategy, maxSlippage);
    }
    
    /**
     * @dev Main protection function for swaps
     * @param params Swap parameters including tokens, amounts, and feeds
     * @return success Whether swap was successful
     * @return amountOut Amount of tokens received
     */
    function protectSwap(SwapParams calldata params) 
        external 
        payable 
        nonReentrant 
        returns (bool success, uint256 amountOut) 
    {
        require(params.deadline >= block.timestamp, "Swap expired");
        require(params.amountIn > 0, "Invalid amount");
        
        ProtectionConfig storage config = userConfigs[msg.sender];
        require(config.isActive, "Protection not configured");
        
        // Check whitelist if enabled
        if (config.whitelistMode) {
            require(whitelistedTokens[params.tokenIn], "Token not whitelisted");
            require(whitelistedTokens[params.tokenOut], "Token not whitelisted");
        }
        
        // Calculate expected price and current gas
        uint256 expectedPrice = _calculateExpectedPrice(params);
        uint256 currentGasPrice = tx.gasprice;
        
        // Run MEV detection
        (
            bool isThreat,
            MEVDetector.ThreatType threatType,
            uint256 riskScore
        ) = detector.detectMEV(params.pricefeedId, expectedPrice, currentGasPrice);
        
        // Update statistics
        globalStats.totalProtectedSwaps++;
        userStats[msg.sender].totalProtectedSwaps++;
        
        if (isThreat) {
            globalStats.threatsDetected++;
            userStats[msg.sender].threatsDetected++;
            
            // Apply protection strategy
            bool blocked = _applyProtectionStrategy(
                config.strategy,
                params,
                threatType,
                riskScore
            );
            
            if (blocked) {
                globalStats.threatsBlocked++;
                userStats[msg.sender].threatsBlocked++;
                
                emit ThreatMitigated(
                    msg.sender,
                    params.pricefeedId,
                    threatType,
                    riskScore,
                    config.strategy
                );
                
                return (false, 0); // Swap blocked
            }
        }
        
        // Execute protected swap
        (success, amountOut) = _executeSwap(params, config);
        
        if (success) {
            // Collect protection fee
            uint256 feeAmount = _collectProtectionFee(params.amountIn);
            
            // Update statistics
            globalStats.totalValueProtected += _estimateUSDValue(params.tokenIn, params.amountIn);
            globalStats.feesCollected += feeAmount;
            userStats[msg.sender].totalValueProtected += _estimateUSDValue(params.tokenIn, params.amountIn);
            userStats[msg.sender].feesCollected += feeAmount;
            
            emit SwapProtected(
                msg.sender,
                params.tokenIn,
                params.tokenOut,
                params.amountIn,
                amountOut,
                feeAmount
            );
        }
        
        emit ProtectionActivated(
            msg.sender,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            config.strategy
        );
        
        return (success, amountOut);
    }
    
    /**
     * @dev Apply specific protection strategy based on threat detection
     * @param strategy Protection strategy to apply
     * @param params Swap parameters
     * @param threatType Type of MEV threat detected
     * @param riskScore Risk score from detector
     * @return blocked Whether the transaction was blocked
     */
    function _applyProtectionStrategy(
        ProtectionStrategy strategy,
        SwapParams calldata params,
        MEVDetector.ThreatType threatType,
        uint256 riskScore
    ) internal returns (bool blocked) {
        
        if (strategy == ProtectionStrategy.REVERT) {
            // Always block if strategy is REVERT
            return true;
            
        } else if (strategy == ProtectionStrategy.ADJUST) {
            // Adjust slippage based on risk score
            // Higher risk = more conservative slippage
            // This doesn't block, but modifies the swap
            return false;
            
        } else if (strategy == ProtectionStrategy.DELAY) {
            // Add delay based on threat type
            uint256 delayTime = _calculateDelay(threatType, riskScore);
            priceDelays[params.pricefeedId] = block.timestamp + delayTime;
            return true; // Block for now, user can retry after delay
            
        } else if (strategy == ProtectionStrategy.PRIVATE_RELAY) {
            // Route through private mempool (simulated)
            // In production, this would integrate with Flashbots or similar
            return false; // Allow but with different routing
        }
        
        return false;
    }
    
    /**
     * @dev Execute the actual swap with protection
     * @param params Swap parameters
     * @param config User protection configuration
     * @return success Whether swap was successful
     * @return amountOut Amount received from swap
     */
    function _executeSwap(
        SwapParams calldata params,
        ProtectionConfig storage config
    ) internal returns (bool success, uint256 amountOut) {
        
        // Transfer tokens from user
        IERC20(params.tokenIn).transferFrom(
            msg.sender,
            address(this),
            params.amountIn
        );
        
        // Simulate swap execution (in production, integrate with DEX)
        // For testnet, we'll simulate the swap with oracle prices
        uint256 currentPrice = detector.getCurrentPrice(params.pricefeedId);
        amountOut = (params.amountIn * currentPrice) / 1e18;
        
        // Apply slippage protection
        if (amountOut < params.minAmountOut) {
            // Refund if slippage too high
            IERC20(params.tokenIn).transfer(msg.sender, params.amountIn);
            return (false, 0);
        }
        
        // Check against user's max slippage
        uint256 expectedOut = (params.amountIn * currentPrice) / 1e18;
        uint256 slippage = expectedOut > amountOut ? 
            ((expectedOut - amountOut) * 10000) / expectedOut : 0;
            
        if (slippage > config.maxSlippage) {
            // Refund if exceeds user's slippage tolerance
            IERC20(params.tokenIn).transfer(msg.sender, params.amountIn);
            return (false, 0);
        }
        
        // Transfer output tokens to recipient
        // In real implementation, this would come from DEX
        // For testing, we simulate with a mock ERC20
        address recipient = params.recipient == address(0) ? msg.sender : params.recipient;
        
        // Simulate successful swap
        return (true, amountOut);
    }
    
    /**
     * @dev Calculate protection fee and transfer to treasury
     * @param amountIn Input amount for fee calculation
     * @return feeAmount Fee collected
     */
    function _collectProtectionFee(uint256 amountIn) internal returns (uint256 feeAmount) {
        feeAmount = (amountIn * protectionFee) / 10000;
        
        // Collect fee in ETH/XTZ
        if (msg.value >= feeAmount) {
            payable(treasury).transfer(feeAmount);
        }
        
        return feeAmount;
    }
    
    /**
     * @dev Calculate expected price for swap
     * @param params Swap parameters
     * @return expectedPrice Expected price from oracle
     */
    function _calculateExpectedPrice(SwapParams calldata params) 
        internal 
        view 
        returns (uint256 expectedPrice) 
    {
        return detector.getCurrentPrice(params.pricefeedId);
    }
    
    /**
     * @dev Calculate delay time based on threat type and risk score
     * @param threatType Type of MEV threat
     * @param riskScore Risk score (0-10000)
     * @return delayTime Delay in seconds
     */
    function _calculateDelay(
        MEVDetector.ThreatType threatType,
        uint256 riskScore
    ) internal pure returns (uint256 delayTime) {
        if (threatType == MEVDetector.ThreatType.SANDWICH) {
            return 30 + (riskScore / 100); // 30s base + risk-based
        } else if (threatType == MEVDetector.ThreatType.FRONTRUN) {
            return 15 + (riskScore / 200); // 15s base + risk-based
        } else if (threatType == MEVDetector.ThreatType.ARBITRAGE) {
            return 5 + (riskScore / 500); // 5s base + risk-based
        }
        return 10; // Default delay
    }
    
    /**
     * @dev Estimate USD value of token amount (simplified)
     * @param token Token address
     * @param amount Token amount
     * @return usdValue Estimated USD value
     */
    function _estimateUSDValue(address token, uint256 amount) 
        internal 
        pure 
        returns (uint256 usdValue) 
    {
        // Simplified USD estimation (in production, use proper price feeds)
        return amount; // 1:1 for testing
    }
    
    // Admin functions
    function setProtectionFee(uint256 newFee) external onlyOwner {
        require(newFee <= maxProtectionFee, "Fee too high");
        protectionFee = newFee;
    }
    
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }
    
    function addWhitelistedToken(address token) external onlyOwner {
        whitelistedTokens[token] = true;
    }
    
    function removeWhitelistedToken(address token) external onlyOwner {
        whitelistedTokens[token] = false;
    }
    
    function updateDetector(address newDetector) external onlyOwner {
        require(newDetector != address(0), "Invalid detector");
        detector = MEVDetector(newDetector);
    }
    
    // Emergency functions
    function emergencyStop(address user, string calldata reason) external onlyOwner {
        userConfigs[user].isActive = false;
        emit EmergencyStop(user, reason);
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }
    
    // View functions
    function getUserConfig(address user) external view returns (ProtectionConfig memory) {
        return userConfigs[user];
    }
    
    function getUserStats(address user) external view returns (ProtectionStats memory) {
        return userStats[user];
    }
    
    function getGlobalStats() external view returns (ProtectionStats memory) {
        return globalStats;
    }
    
    function isTokenWhitelisted(address token) external view returns (bool) {
        return whitelistedTokens[token];
    }
    
    function getPriceDelay(bytes32 feedId) external view returns (uint256) {
        return priceDelays[feedId];
    }
    
    // Fallback functions
    receive() external payable {}
    
    fallback() external payable {}
}
