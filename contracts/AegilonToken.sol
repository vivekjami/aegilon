// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AegilonToken
 * @dev $AEG - The governance and utility token for Aegilon MEV Protection Protocol
 * 
 * Tokenomics:
 * - Total Supply: 10,000,000 AEG
 * - Distribution:
 *   - 40% (4M) - Liquidity Rewards & User Incentives
 *   - 30% (3M) - Governance & DAO Treasury
 *   - 20% (2M) - Team & Development (24-month vesting)
 *   - 10% (1M) - Hackathon Airdrop & Community
 * 
 * Utility:
 * - Staking for enhanced MEV protection
 * - Governance voting on protocol parameters
 * - Rewards for threat detection and reporting
 * - Premium protection features access
 */
contract AegilonToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable, ReentrancyGuard {
    
    // Token distribution constants
    uint256 public constant TOTAL_SUPPLY = 10_000_000 * 10**18; // 10M tokens
    uint256 public constant LIQUIDITY_REWARDS = 4_000_000 * 10**18; // 40%
    uint256 public constant GOVERNANCE_TREASURY = 3_000_000 * 10**18; // 30%
    uint256 public constant TEAM_ALLOCATION = 2_000_000 * 10**18; // 20%
    uint256 public constant COMMUNITY_AIRDROP = 1_000_000 * 10**18; // 10%
    
    // Vesting and distribution tracking
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public stakingRewards;
    mapping(address => uint256) public lastStakeTime;
    
    // MEV protection staking rewards
    uint256 public stakingAPR = 500; // 5% base APR (in basis points)
    uint256 public protectionBoostMultiplier = 150; // 1.5x boost for active protection
    
    // Governance and treasury addresses
    address public treasuryAddress;
    address public liquidityRewardsAddress;
    address public mevProtectorContract;
    
    // Events
    event TokensStaked(address indexed user, uint256 amount);
    event TokensUnstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event MEVThreatReported(address indexed reporter, uint256 reward);
    event ProtectionActivated(address indexed user, uint256 stakedAmount);
    
    // Modifiers
    modifier onlyMEVProtector() {
        require(msg.sender == mevProtectorContract, "Only MEV Protector can call");
        _;
    }
    
    constructor(
        address _treasuryAddress,
        address _liquidityRewardsAddress
    ) ERC20("Aegilon Token", "AEG") {
        require(_treasuryAddress != address(0), "Invalid treasury address");
        require(_liquidityRewardsAddress != address(0), "Invalid liquidity address");
        
        treasuryAddress = _treasuryAddress;
        liquidityRewardsAddress = _liquidityRewardsAddress;
        
        // Initial token distribution
        _mint(_treasuryAddress, GOVERNANCE_TREASURY);
        _mint(_liquidityRewardsAddress, LIQUIDITY_REWARDS);
        _mint(msg.sender, TEAM_ALLOCATION + COMMUNITY_AIRDROP); // Deploy to owner for further distribution
    }
    
    /**
     * @dev Stake tokens for MEV protection and governance rights
     * @param amount Amount of tokens to stake
     */
    function stakeTokens(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Calculate and distribute pending rewards before staking more
        if (stakedBalance[msg.sender] > 0) {
            uint256 pendingRewards = calculateStakingRewards(msg.sender);
            if (pendingRewards > 0) {
                stakingRewards[msg.sender] += pendingRewards;
            }
        }
        
        // Transfer tokens to this contract
        _transfer(msg.sender, address(this), amount);
        
        // Update staking balance and timestamp
        stakedBalance[msg.sender] += amount;
        lastStakeTime[msg.sender] = block.timestamp;
        
        emit TokensStaked(msg.sender, amount);
        emit ProtectionActivated(msg.sender, stakedBalance[msg.sender]);
    }
    
    /**
     * @dev Unstake tokens and claim rewards
     * @param amount Amount of tokens to unstake
     */
    function unstakeTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(stakedBalance[msg.sender] >= amount, "Insufficient staked balance");
        
        // Calculate and add pending rewards
        uint256 pendingRewards = calculateStakingRewards(msg.sender);
        if (pendingRewards > 0) {
            stakingRewards[msg.sender] += pendingRewards;
        }
        
        // Update staking balance
        stakedBalance[msg.sender] -= amount;
        lastStakeTime[msg.sender] = block.timestamp;
        
        // Transfer tokens back to user
        _transfer(address(this), msg.sender, amount);
        
        emit TokensUnstaked(msg.sender, amount);
    }
    
    /**
     * @dev Claim accumulated staking rewards
     */
    function claimRewards() external nonReentrant {
        uint256 pendingRewards = calculateStakingRewards(msg.sender);
        uint256 totalRewards = stakingRewards[msg.sender] + pendingRewards;
        
        require(totalRewards > 0, "No rewards to claim");
        
        // Reset rewards and update timestamp
        stakingRewards[msg.sender] = 0;
        lastStakeTime[msg.sender] = block.timestamp;
        
        // Mint rewards (inflation controlled by governance)
        _mint(msg.sender, totalRewards);
        
        emit RewardsClaimed(msg.sender, totalRewards);
    }
    
    /**
     * @dev Calculate pending staking rewards for a user
     * @param user Address of the user
     * @return Pending rewards amount
     */
    function calculateStakingRewards(address user) public view returns (uint256) {
        if (stakedBalance[user] == 0) return 0;
        
        uint256 stakingDuration = block.timestamp - lastStakeTime[user];
        uint256 baseReward = (stakedBalance[user] * stakingAPR * stakingDuration) / (365 days * 10000);
        
        // Apply protection boost if user has active MEV protection
        if (mevProtectorContract != address(0)) {
            // This would be enhanced with actual protection status check
            baseReward = (baseReward * protectionBoostMultiplier) / 100;
        }
        
        return baseReward;
    }
    
    /**
     * @dev Reward user for reporting MEV threats (called by MEV Protector contract)
     * @param reporter Address of the threat reporter
     * @param rewardAmount Amount of tokens to reward
     */
    function rewardThreatReporter(address reporter, uint256 rewardAmount) external onlyMEVProtector {
        _mint(reporter, rewardAmount);
        emit MEVThreatReported(reporter, rewardAmount);
    }
    
    /**
     * @dev Get user's protection level based on staked amount
     * @param user Address of the user
     * @return Protection level (0-5, higher is better)
     */
    function getProtectionLevel(address user) external view returns (uint256) {
        uint256 staked = stakedBalance[user];
        
        if (staked >= 10000 * 10**18) return 5; // 10k+ AEG - Maximum protection
        if (staked >= 5000 * 10**18) return 4;  // 5k+ AEG - High protection
        if (staked >= 1000 * 10**18) return 3;  // 1k+ AEG - Medium protection
        if (staked >= 100 * 10**18) return 2;   // 100+ AEG - Basic protection
        if (staked >= 10 * 10**18) return 1;    // 10+ AEG - Minimal protection
        
        return 0; // No protection
    }
    
    // Admin functions
    function setMEVProtectorContract(address _mevProtectorContract) external onlyOwner {
        mevProtectorContract = _mevProtectorContract;
    }
    
    function setStakingAPR(uint256 _newAPR) external onlyOwner {
        require(_newAPR <= 2000, "APR cannot exceed 20%"); // Max 20% APR
        stakingAPR = _newAPR;
    }
    
    function setProtectionBoostMultiplier(uint256 _multiplier) external onlyOwner {
        require(_multiplier >= 100 && _multiplier <= 300, "Multiplier must be between 1x and 3x");
        protectionBoostMultiplier = _multiplier;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Override required by Solidity
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
