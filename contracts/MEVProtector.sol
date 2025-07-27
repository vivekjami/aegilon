// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./AegilonToken.sol";

/**
 * @title MEVProtector
 * @dev Core contract for detecting and preventing MEV attacks on Etherlink
 * 
 * Features:
 * - Real-time MEV threat detection
 * - Automated protection mechanisms
 * - Integration with Redstone oracles for price validation
 * - Goldsky integration for transaction monitoring
 * - $AEG token rewards for threat reporting
 */
contract MEVProtector is Ownable, ReentrancyGuard, Pausable {
    
    // Core state variables
    AegilonToken public aegilonToken;
    
    // MEV detection parameters
    uint256 public priceDeviationThreshold = 200; // 2% in basis points
    uint256 public volumeAnomalyThreshold = 500; // 5% volume spike threshold
    uint256 public timeWindowForDetection = 5; // 5 seconds window for MEV detection
    uint256 public minimumLiquidityForProtection = 1000 * 10**18; // Minimum $1000 equivalent
    
    // Protection status tracking
    mapping(address => bool) public isProtected;
    mapping(address => uint256) public protectionLevel;
    mapping(address => uint256) public lastTransactionTime;
    mapping(address => uint256) public transactionCount;
    
    // MEV threat tracking
    mapping(bytes32 => bool) public detectedThreats;
    mapping(address => uint256) public threatReports;
    mapping(address => uint256) public successfulPrevented;
    
    // Oracle integration (Redstone)
    mapping(string => uint256) public lastOraclePrices;
    mapping(string => uint256) public lastOracleUpdate;
    
    // Goldsky integration endpoints
    string public goldkySubgraphURL;
    address public authorizedIndexer;
    
    // Reward parameters
    uint256 public threatReportReward = 10 * 10**18; // 10 AEG base reward
    uint256 public protectionSuccessReward = 5 * 10**18; // 5 AEG for successful protection
    
    // Events
    event ProtectionActivated(address indexed user, uint256 level);
    event ProtectionDeactivated(address indexed user);
    event MEVThreatDetected(
        bytes32 indexed threatId,
        address indexed target,
        address indexed attacker,
        uint256 threatType,
        uint256 timestamp
    );
    event MEVThreatPrevented(
        bytes32 indexed threatId,
        address indexed protectedUser,
        uint256 savedAmount,
        uint256 timestamp
    );
    event ThreatReported(address indexed reporter, bytes32 indexed threatId, uint256 reward);
    event OraclePriceUpdated(string indexed symbol, uint256 price, uint256 timestamp);
    
    // MEV threat types
    enum ThreatType {
        SandwichAttack,
        Frontrunning,
        Backrunning,
        JITLiquidity,
        Arbitrage,
        LiquidationMEV
    }
    
    // Threat detection structure
    struct ThreatData {
        address target;
        address attacker;
        ThreatType threatType;
        uint256 detectedAt;
        uint256 estimatedLoss;
        bool prevented;
        address reporter;
    }
    
    mapping(bytes32 => ThreatData) public threats;
    
    // Modifiers
    modifier onlyProtected() {
        require(isProtected[msg.sender], "User not protected");
        _;
    }
    
    modifier onlyIndexer() {
        require(msg.sender == authorizedIndexer, "Only authorized indexer");
        _;
    }
    
    constructor(address _aegilonToken) {
        require(_aegilonToken != address(0), "Invalid token address");
        aegilonToken = AegilonToken(_aegilonToken);
    }
    
    /**
     * @dev Activate MEV protection for the caller
     */
    function activateProtection() external nonReentrant whenNotPaused {
        uint256 userProtectionLevel = aegilonToken.getProtectionLevel(msg.sender);
        require(userProtectionLevel > 0, "Insufficient AEG tokens staked for protection");
        
        isProtected[msg.sender] = true;
        protectionLevel[msg.sender] = userProtectionLevel;
        
        emit ProtectionActivated(msg.sender, userProtectionLevel);
    }
    
    /**
     * @dev Deactivate MEV protection
     */
    function deactivateProtection() external {
        require(isProtected[msg.sender], "Protection not active");
        
        isProtected[msg.sender] = false;
        protectionLevel[msg.sender] = 0;
        
        emit ProtectionDeactivated(msg.sender);
    }
    
    /**
     * @dev Detect MEV threat based on transaction patterns (called by Goldsky indexer)
     * @param target Address being targeted
     * @param attacker Suspected attacker address
     * @param threatType Type of MEV attack
     * @param transactionData Encoded transaction data for analysis
     */
    function detectMEVThreat(
        address target,
        address attacker,
        uint8 threatType,
        bytes calldata transactionData
    ) external onlyIndexer returns (bytes32 threatId) {
        threatId = keccak256(abi.encodePacked(
            target,
            attacker,
            threatType,
            block.timestamp,
            transactionData
        ));
        
        require(!detectedThreats[threatId], "Threat already detected");
        
        // Analyze threat severity
        uint256 estimatedLoss = analyzeThreatSeverity(
            target,
            attacker,
            ThreatType(threatType),
            transactionData
        );
        
        // Store threat data
        threats[threatId] = ThreatData({
            target: target,
            attacker: attacker,
            threatType: ThreatType(threatType),
            detectedAt: block.timestamp,
            estimatedLoss: estimatedLoss,
            prevented: false,
            reporter: msg.sender
        });
        
        detectedThreats[threatId] = true;
        
        emit MEVThreatDetected(threatId, target, attacker, threatType, block.timestamp);
        
        // Attempt automatic protection if user is protected
        if (isProtected[target]) {
            bool prevented = executeProtection(threatId);
            if (prevented) {
                threats[threatId].prevented = true;
                successfulPrevented[target]++;
                
                // Reward protection success
                aegilonToken.rewardThreatReporter(target, protectionSuccessReward);
                
                emit MEVThreatPrevented(threatId, target, estimatedLoss, block.timestamp);
            }
        }
        
        return threatId;
    }
    
    /**
     * @dev Execute protection mechanism against detected threat
     * @param threatId ID of the detected threat
     * @return success Whether protection was successful
     */
    function executeProtection(bytes32 threatId) internal returns (bool success) {
        ThreatData storage threat = threats[threatId];
        require(threat.detectedAt > 0, "Threat not found");
        require(isProtected[threat.target], "Target not protected");
        
        // Protection logic based on threat type and user protection level
        uint256 userLevel = protectionLevel[threat.target];
        
        if (threat.threatType == ThreatType.SandwichAttack) {
            success = preventSandwichAttack(threat, userLevel);
        } else if (threat.threatType == ThreatType.Frontrunning) {
            success = preventFrontrunning(threat, userLevel);
        } else if (threat.threatType == ThreatType.JITLiquidity) {
            success = preventJITLiquidity(threat, userLevel);
        } else {
            // Generic protection for other threat types
            success = executeGenericProtection(threat, userLevel);
        }
        
        return success;
    }
    
    /**
     * @dev Prevent sandwich attacks by adjusting gas prices or delaying execution
     */
    function preventSandwichAttack(
        ThreatData memory threat,
        uint256 protectionLevel
    ) internal pure returns (bool) {
        // Implementation would include:
        // - Gas price adjustment to front-run the front-runner
        // - Transaction reordering through Etherlink's fast finality
        // - Slippage protection enhancement
        
        // For now, return success based on protection level
        return protectionLevel >= 2; // Requires at least level 2 protection
    }
    
    /**
     * @dev Prevent front-running attacks
     */
    function preventFrontrunning(
        ThreatData memory threat,
        uint256 protectionLevel
    ) internal pure returns (bool) {
        // Implementation would include:
        // - Private mempool submission
        // - Commit-reveal schemes
        // - Time-locked transactions
        
        return protectionLevel >= 1; // Basic protection sufficient
    }
    
    /**
     * @dev Prevent Just-In-Time liquidity attacks
     */
    function preventJITLiquidity(
        ThreatData memory threat,
        uint256 protectionLevel
    ) internal pure returns (bool) {
        // Implementation would include:
        // - Liquidity source verification
        // - Alternative routing
        // - Pool selection optimization
        
        return protectionLevel >= 3; // Requires higher protection level
    }
    
    /**
     * @dev Generic protection mechanism
     */
    function executeGenericProtection(
        ThreatData memory threat,
        uint256 protectionLevel
    ) internal pure returns (bool) {
        // Basic protection measures for unspecified threats
        return protectionLevel >= 1;
    }
    
    /**
     * @dev Analyze threat severity and estimate potential loss
     */
    function analyzeThreatSeverity(
        address target,
        address attacker,
        ThreatType threatType,
        bytes calldata transactionData
    ) internal view returns (uint256 estimatedLoss) {
        // Basic analysis - would be enhanced with actual transaction data parsing
        if (threatType == ThreatType.SandwichAttack) {
            estimatedLoss = 1000 * 10**18; // Placeholder: $1000 estimated loss
        } else if (threatType == ThreatType.Frontrunning) {
            estimatedLoss = 500 * 10**18; // Placeholder: $500 estimated loss
        } else {
            estimatedLoss = 100 * 10**18; // Placeholder: $100 estimated loss
        }
        
        return estimatedLoss;
    }
    
    /**
     * @dev Report a MEV threat manually (community reporting)
     * @param threatId ID of the threat to report
     */
    function reportThreat(bytes32 threatId) external nonReentrant {
        require(detectedThreats[threatId], "Threat not detected");
        require(threats[threatId].reporter != msg.sender, "Cannot report own detection");
        
        threatReports[msg.sender]++;
        
        // Reward the reporter
        aegilonToken.rewardThreatReporter(msg.sender, threatReportReward);
        
        emit ThreatReported(msg.sender, threatId, threatReportReward);
    }
    
    /**
     * @dev Update oracle price (called by authorized oracle)
     * @param symbol Token symbol (e.g., "ETH", "USDC")
     * @param price New price in wei (18 decimals)
     */
    function updateOraclePrice(string calldata symbol, uint256 price) external onlyIndexer {
        lastOraclePrices[symbol] = price;
        lastOracleUpdate[symbol] = block.timestamp;
        
        emit OraclePriceUpdated(symbol, price, block.timestamp);
    }
    
    /**
     * @dev Check if price deviation indicates potential MEV attack
     * @param symbol Token symbol
     * @param currentPrice Current market price
     * @return isAnomaly Whether price deviation is anomalous
     */
    function checkPriceAnomaly(
        string calldata symbol,
        uint256 currentPrice
    ) external view returns (bool isAnomaly) {
        uint256 oraclePrice = lastOraclePrices[symbol];
        require(oraclePrice > 0, "No oracle price available");
        require(block.timestamp - lastOracleUpdate[symbol] < 300, "Oracle price too old");
        
        uint256 deviation;
        if (currentPrice > oraclePrice) {
            deviation = ((currentPrice - oraclePrice) * 10000) / oraclePrice;
        } else {
            deviation = ((oraclePrice - currentPrice) * 10000) / oraclePrice;
        }
        
        return deviation > priceDeviationThreshold;
    }
    
    // Admin functions
    function setAuthorizedIndexer(address _indexer) external onlyOwner {
        authorizedIndexer = _indexer;
    }
    
    function setGoldskySubgraphURL(string calldata _url) external onlyOwner {
        goldkySubgraphURL = _url;
    }
    
    function setPriceDeviationThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold <= 1000, "Threshold cannot exceed 10%");
        priceDeviationThreshold = _threshold;
    }
    
    function setThreatReportReward(uint256 _reward) external onlyOwner {
        threatReportReward = _reward;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // View functions
    function getThreatData(bytes32 threatId) external view returns (ThreatData memory) {
        return threats[threatId];
    }
    
    function getUserProtectionStatus(address user) external view returns (
        bool protected,
        uint256 level,
        uint256 reportsCount,
        uint256 preventedCount
    ) {
        return (
            isProtected[user],
            protectionLevel[user],
            threatReports[user],
            successfulPrevented[user]
        );
    }
}
