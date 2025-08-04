// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockDEXRouter
 * @dev Mock DEX router for MEV attack simulation and testing
 */
contract MockDEXRouter {
    mapping(string => uint256) public prices;
    mapping(address => bool) public mevProtected;
    
    event SwapExecuted(address indexed user, uint256 amountIn, uint256 amountOut, string[] path);
    event PriceUpdated(string indexed pair, uint256 newPrice);
    event MEVThreatDetected(address indexed user, uint256 riskScore);
    
    constructor() {
        // Initialize with some default prices
        prices["ETH/USDC"] = 2000e18; // $2000 ETH
        prices["USDC/ETH"] = 1e18 / 2000; // Reciprocal
    }
    
    modifier noMEVThreat(address user, uint256 amount, uint256 gasPrice) {
        uint256 riskScore = calculateMEVRisk(user, amount, gasPrice);
        if (riskScore > 25) { // Lower threshold for testing
            emit MEVThreatDetected(user, riskScore);
            revert("MEV_THREAT_DETECTED");
        }
        _;
    }
    
    function setPrice(string memory pair, uint256 price) external {
        prices[pair] = price;
        emit PriceUpdated(pair, price);
    }
    
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        string[] memory path,
        address to,
        uint deadline
    ) external noMEVThreat(msg.sender, amountIn, tx.gasprice) returns (uint[] memory amounts) {
        require(deadline >= block.timestamp, "EXPIRED");
        require(path.length >= 2, "INVALID_PATH");
        
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        
        // Calculate output based on mock price
        string memory pairKey = string(abi.encodePacked(path[0], "/", path[1]));
        uint256 price = prices[pairKey];
        require(price > 0, "PRICE_NOT_SET");
        
        amounts[1] = (amountIn * price) / 1e18;
        require(amounts[1] >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");
        
        emit SwapExecuted(to, amountIn, amounts[1], path);
        return amounts;
    }
    
    function arbitrageSwap(
        address otherDex,
        uint256 amount,
        string[] memory path
    ) external returns (bool) {
        // Mock arbitrage - check if profitable
        string memory pairKey = string(abi.encodePacked(path[0], "/", path[1]));
        uint256 price1 = prices[pairKey];
        
        // Simulate getting price from other DEX (assume 2.5% difference)
        uint256 price2 = (price1 * 1025) / 1000;
        
        require(price2 > price1, "NO_ARBITRAGE_OPPORTUNITY");
        
        // Execute arbitrage (simplified)
        emit SwapExecuted(msg.sender, amount, (amount * price2) / 1e18, path);
        return true;
    }
    
    function calculateMEVRisk(
        address user,
        uint256 amount,
        uint256 gasPrice
    ) public view returns (uint256 riskScore) {
        riskScore = 0;
        
        // High gas price check (30 points max)
        uint256 avgGasPrice = 20e9; // 20 gwei baseline
        if (gasPrice > avgGasPrice * 2) {
            riskScore += 30;
        } else if (gasPrice > avgGasPrice * 15 / 10) {
            riskScore += 20;
        } else if (gasPrice > avgGasPrice * 12 / 10) {
            riskScore += 10;
        }
        
        // Large transaction check (25 points max)
        if (amount > 1000e18) { // > 1000 tokens
            riskScore += 25;
        } else if (amount > 100e18) {
            riskScore += 15;
        } else if (amount > 10e18) {
            riskScore += 5;
        }
        
        // Time-based pattern detection (simplified - 20 points max)
        // In real scenario, would check recent transactions
        if (block.timestamp % 100 < 20) { // Mock pattern detection
            riskScore += 20;
        }
        
        return riskScore;
    }
    
    function setMEVProtection(address user, bool protected) external {
        mevProtected[user] = protected;
    }
    
    function getPrice(string memory pair) external view returns (uint256) {
        return prices[pair];
    }
}

/**
 * @title MockERC20
 * @dev Simple ERC20 mock for testing
 */
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    constructor(string memory _name, string memory _symbol, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply * 1e18;
        balanceOf[msg.sender] = totalSupply;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "INSUFFICIENT_BALANCE");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "INSUFFICIENT_ALLOWANCE");
        require(balanceOf[from] >= amount, "INSUFFICIENT_BALANCE");
        
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}
