// Aegilon Token Event Handlers - Minimal Version
// Real-time processing of staking, rewards, and protection events

import {
  TokensStaked,
  TokensUnstaked,
  RewardsClaimed,
  Transfer
} from "../generated/AegilonToken/AegilonToken"

import {
  User,
  StakingEvent,
  ProtocolStats,
  TokenTransfer
} from "../generated/schema"

import { BigInt, Address, log } from "@graphprotocol/graph-ts"

// Helper function to load or create user
function loadOrCreateUser(address: Address, timestamp: BigInt): User {
  let user = User.load(address.toHexString())
  
  if (user == null) {
    user = new User(address.toHexString())
    user.address = address
    user.stakedBalance = BigInt.fromI32(0)
    user.protectionLevel = 0
    user.isProtected = false
    user.stakingRewards = BigInt.fromI32(0)
    user.lastStakeTime = BigInt.fromI32(0)
    user.threatsDetected = 0
    user.threatsPrevented = 0
    user.totalSavedAmount = BigInt.fromI32(0)
    user.aegBalance = BigInt.fromI32(0)
    user.totalStaked = BigInt.fromI32(0)
    user.totalUnstaked = BigInt.fromI32(0)
    user.totalRewardsClaimed = BigInt.fromI32(0)
    user.firstStakeTime = null
    user.createdAt = timestamp
    user.updatedAt = timestamp
    
    // Update protocol stats
    updateProtocolStats()
  }
  
  return user
}

// Helper function to load or create protocol stats
function loadOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load("1")
  
  if (stats == null) {
    stats = new ProtocolStats("1")
    stats.totalSupply = BigInt.fromI32(0)
    stats.totalStaked = BigInt.fromI32(0)
    stats.totalUsers = 0
    stats.totalProtectedUsers = 0
    stats.totalThreatsDetected = 0
    stats.totalThreatsPrevented = 0
    stats.totalAmountSaved = BigInt.fromI32(0)
    stats.totalRewardsDistributed = BigInt.fromI32(0)
    stats.totalThreatReports = 0
    stats.level1Users = 0
    stats.level2Users = 0
    stats.level3Users = 0
    stats.level4Users = 0
    stats.level5Users = 0
    stats.lastUpdated = BigInt.fromI32(0)
  }
  
  return stats
}

// Update protocol statistics
function updateProtocolStats(): void {
  let stats = loadOrCreateProtocolStats()
  stats.lastUpdated = BigInt.fromI32(Date.now())
  stats.save()
}

// Handle tokens staked event
export function handleTokensStaked(event: TokensStaked): void {
  log.info("Tokens staked: user {} amount {}", [
    event.params.user.toHexString(),
    event.params.amount.toString()
  ])
  
  let user = loadOrCreateUser(event.params.user, event.block.timestamp)
  
  // Update user staking balance
  user.stakedBalance = user.stakedBalance.plus(event.params.amount)
  user.totalStaked = user.totalStaked.plus(event.params.amount)
  user.lastStakeTime = event.block.timestamp
  user.updatedAt = event.block.timestamp
  
  // Set first stake time if this is the first stake
  if (user.firstStakeTime == null) {
    user.firstStakeTime = event.block.timestamp
  }
  
  // Update protection level based on staking amount
  updateProtectionLevel(user)
  
  user.save()
  
  // Create staking event
  let stakingEventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let stakingEvent = new StakingEvent(stakingEventId)
  stakingEvent.user = user.id
  stakingEvent.type = "STAKE"
  stakingEvent.amount = event.params.amount
  stakingEvent.newStakedBalance = user.stakedBalance
  stakingEvent.newProtectionLevel = user.protectionLevel
  stakingEvent.transactionHash = event.transaction.hash
  stakingEvent.blockNumber = event.block.number
  stakingEvent.blockTimestamp = event.block.timestamp
  stakingEvent.gasUsed = event.transaction.gasLimit
  stakingEvent.save()
  
  // Update protocol stats
  let stats = loadOrCreateProtocolStats()
  stats.totalStaked = stats.totalStaked.plus(event.params.amount)
  if (user.protectionLevel > 0 && !user.isProtected) {
    stats.totalProtectedUsers += 1
    user.isProtected = true
    user.save()
  }
  stats.lastUpdated = event.block.timestamp
  stats.save()
}

// Handle tokens unstaked event
export function handleTokensUnstaked(event: TokensUnstaked): void {
  log.info("Tokens unstaked: user {} amount {}", [
    event.params.user.toHexString(),
    event.params.amount.toString()
  ])
  
  let user = loadOrCreateUser(event.params.user, event.block.timestamp)
  
  // Update user staking balance
  user.stakedBalance = user.stakedBalance.minus(event.params.amount)
  user.totalUnstaked = user.totalUnstaked.plus(event.params.amount)
  user.updatedAt = event.block.timestamp
  
  // Update protection level based on remaining stake
  updateProtectionLevel(user)
  
  user.save()
  
  // Create staking event
  let stakingEventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let stakingEvent = new StakingEvent(stakingEventId)
  stakingEvent.user = user.id
  stakingEvent.type = "UNSTAKE"
  stakingEvent.amount = event.params.amount
  stakingEvent.newStakedBalance = user.stakedBalance
  stakingEvent.newProtectionLevel = user.protectionLevel
  stakingEvent.transactionHash = event.transaction.hash
  stakingEvent.blockNumber = event.block.number
  stakingEvent.blockTimestamp = event.block.timestamp
  stakingEvent.gasUsed = event.transaction.gasLimit
  stakingEvent.save()
  
  // Update protocol stats
  let stats = loadOrCreateProtocolStats()
  stats.totalStaked = stats.totalStaked.minus(event.params.amount)
  if (user.protectionLevel == 0 && user.isProtected) {
    stats.totalProtectedUsers -= 1
    user.isProtected = false
    user.save()
  }
  stats.lastUpdated = event.block.timestamp
  stats.save()
}

// Handle rewards claimed event
export function handleRewardsClaimed(event: RewardsClaimed): void {
  log.info("Rewards claimed: user {} amount {}", [
    event.params.user.toHexString(),
    event.params.amount.toString()
  ])
  
  let user = loadOrCreateUser(event.params.user, event.block.timestamp)
  
  // Update user rewards
  user.stakingRewards = user.stakingRewards.plus(event.params.amount)
  user.totalRewardsClaimed = user.totalRewardsClaimed.plus(event.params.amount)
  user.updatedAt = event.block.timestamp
  user.save()
  
  // Create staking event
  let stakingEventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let stakingEvent = new StakingEvent(stakingEventId)
  stakingEvent.user = user.id
  stakingEvent.type = "REWARDS_CLAIMED"
  stakingEvent.amount = event.params.amount
  stakingEvent.newStakedBalance = user.stakedBalance
  stakingEvent.newProtectionLevel = user.protectionLevel
  stakingEvent.transactionHash = event.transaction.hash
  stakingEvent.blockNumber = event.block.number
  stakingEvent.blockTimestamp = event.block.timestamp
  stakingEvent.gasUsed = event.transaction.gasLimit
  stakingEvent.save()
  
  // Update protocol stats
  let stats = loadOrCreateProtocolStats()
  stats.totalRewardsDistributed = stats.totalRewardsDistributed.plus(event.params.amount)
  stats.lastUpdated = event.block.timestamp
  stats.save()
}

// Handle transfer events for balance tracking
export function handleTransfer(event: Transfer): void {
  log.info("Transfer: from {} to {} amount {}", [
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.value.toString()
  ])
  
  // Create transfer record
  let transferId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let transfer = new TokenTransfer(transferId)
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.amount = event.params.value
  transfer.transactionHash = event.transaction.hash
  transfer.blockNumber = event.block.number
  transfer.blockTimestamp = event.block.timestamp
  transfer.save()
  
  // Update balances for non-zero addresses
  if (!event.params.from.equals(Address.zero())) {
    let fromUser = loadOrCreateUser(event.params.from, event.block.timestamp)
    fromUser.aegBalance = fromUser.aegBalance.minus(event.params.value)
    fromUser.updatedAt = event.block.timestamp
    fromUser.save()
  }
  
  if (!event.params.to.equals(Address.zero())) {
    let toUser = loadOrCreateUser(event.params.to, event.block.timestamp)
    toUser.aegBalance = toUser.aegBalance.plus(event.params.value)
    toUser.updatedAt = event.block.timestamp
    toUser.save()
  }
}

// Update user protection level based on staked amount
function updateProtectionLevel(user: User): void {
  let stakedAmount = user.stakedBalance
  
  if (stakedAmount.ge(BigInt.fromString("100000000000000000000000"))) { // 100,000 AEG
    user.protectionLevel = 5
  } else if (stakedAmount.ge(BigInt.fromString("50000000000000000000000"))) { // 50,000 AEG
    user.protectionLevel = 4
  } else if (stakedAmount.ge(BigInt.fromString("10000000000000000000000"))) { // 10,000 AEG
    user.protectionLevel = 3
  } else if (stakedAmount.ge(BigInt.fromString("5000000000000000000000"))) { // 5,000 AEG
    user.protectionLevel = 2
  } else if (stakedAmount.ge(BigInt.fromString("1000000000000000000000"))) { // 1,000 AEG
    user.protectionLevel = 1
  } else {
    user.protectionLevel = 0
  }
  
  user.isProtected = user.protectionLevel > 0
}
