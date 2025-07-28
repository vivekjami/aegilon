// Aegilon Token Event Handlers
// Real-time processing of staking, rewards, and protection events

import {
  TokensStaked,
  TokensUnstaked,
  RewardsClaimed,
  ProtectionActivated,
  Transfer
} from "../generated/AegilonToken/AegilonToken"

import {
  User,
  StakingEvent,
  ProtocolStats,
  DailyStats,
  TokenTransfer
} from "../generated/schema"

import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"

// Helper function to load or create user
function loadOrCreateUser(address: Address): User {
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
    user.createdAt = event.block.timestamp
    user.updatedAt = event.block.timestamp
    
    // Update protocol stats
    updateProtocolStats()
  }
  
  return user
}

// Helper function to update protocol statistics
function updateProtocolStats(): void {
  let stats = ProtocolStats.load("1")
  
  if (stats == null) {
    stats = new ProtocolStats("1")
    stats.totalSupply = BigInt.fromString("10000000000000000000000000") // 10M tokens
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
  }
  
  stats.totalUsers = stats.totalUsers + 1
  stats.lastUpdated = BigInt.fromI32(Date.now())
  stats.save()
}

// Helper function to determine protection level from staked amount
function getProtectionLevel(stakedAmount: BigInt): i32 {
  let tenK = BigInt.fromString("10000000000000000000000") // 10,000 AEG
  let fiveK = BigInt.fromString("5000000000000000000000") // 5,000 AEG
  let oneK = BigInt.fromString("1000000000000000000000") // 1,000 AEG
  let hundred = BigInt.fromString("100000000000000000000") // 100 AEG
  let ten = BigInt.fromString("10000000000000000000") // 10 AEG
  
  if (stakedAmount.ge(tenK)) return 5
  if (stakedAmount.ge(fiveK)) return 4
  if (stakedAmount.ge(oneK)) return 3
  if (stakedAmount.ge(hundred)) return 2
  if (stakedAmount.ge(ten)) return 1
  
  return 0
}

export function handleTokensStaked(event: TokensStaked): void {
  let user = loadOrCreateUser(event.params.user)
  
  // Update user staking information
  user.stakedBalance = user.stakedBalance.plus(event.params.amount)
  user.totalStaked = user.totalStaked.plus(event.params.amount)
  user.lastStakeTime = event.block.timestamp
  user.protectionLevel = getProtectionLevel(user.stakedBalance)
  user.updatedAt = event.block.timestamp
  
  if (user.firstStakeTime == null) {
    user.firstStakeTime = event.block.timestamp
  }
  
  user.save()
  
  // Create staking event
  let stakingEvent = new StakingEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  stakingEvent.user = user.id
  stakingEvent.type = "STAKE"
  stakingEvent.amount = event.params.amount
  stakingEvent.newStakedBalance = user.stakedBalance
  stakingEvent.newProtectionLevel = user.protectionLevel
  stakingEvent.transactionHash = event.transaction.hash
  stakingEvent.blockNumber = event.block.number
  stakingEvent.blockTimestamp = event.block.timestamp
  stakingEvent.gasUsed = event.transaction.gasUsed
  stakingEvent.save()
  
  // Update protocol stats
  let stats = ProtocolStats.load("1")!
  stats.totalStaked = stats.totalStaked.plus(event.params.amount)
  stats.lastUpdated = event.block.timestamp
  stats.save()
}

export function handleTokensUnstaked(event: TokensUnstaked): void {
  let user = loadOrCreateUser(event.params.user)
  
  // Update user staking information
  user.stakedBalance = user.stakedBalance.minus(event.params.amount)
  user.totalUnstaked = user.totalUnstaked.plus(event.params.amount)
  user.lastStakeTime = event.block.timestamp
  user.protectionLevel = getProtectionLevel(user.stakedBalance)
  user.updatedAt = event.block.timestamp
  user.save()
  
  // Create staking event
  let stakingEvent = new StakingEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  stakingEvent.user = user.id
  stakingEvent.type = "UNSTAKE"
  stakingEvent.amount = event.params.amount
  stakingEvent.newStakedBalance = user.stakedBalance
  stakingEvent.newProtectionLevel = user.protectionLevel
  stakingEvent.transactionHash = event.transaction.hash
  stakingEvent.blockNumber = event.block.number
  stakingEvent.blockTimestamp = event.block.timestamp
  stakingEvent.gasUsed = event.transaction.gasUsed
  stakingEvent.save()
  
  // Update protocol stats
  let stats = ProtocolStats.load("1")!
  stats.totalStaked = stats.totalStaked.minus(event.params.amount)
  stats.lastUpdated = event.block.timestamp
  stats.save()
}

export function handleRewardsClaimed(event: RewardsClaimed): void {
  let user = loadOrCreateUser(event.params.user)
  
  // Update user rewards information
  user.totalRewardsClaimed = user.totalRewardsClaimed.plus(event.params.amount)
  user.updatedAt = event.block.timestamp
  user.save()
  
  // Create staking event
  let stakingEvent = new StakingEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  stakingEvent.user = user.id
  stakingEvent.type = "REWARDS_CLAIMED"
  stakingEvent.amount = event.params.amount
  stakingEvent.newStakedBalance = user.stakedBalance
  stakingEvent.newProtectionLevel = user.protectionLevel
  stakingEvent.transactionHash = event.transaction.hash
  stakingEvent.blockNumber = event.block.number
  stakingEvent.blockTimestamp = event.block.timestamp
  stakingEvent.gasUsed = event.transaction.gasUsed
  stakingEvent.save()
  
  // Update protocol stats
  let stats = ProtocolStats.load("1")!
  stats.totalRewardsDistributed = stats.totalRewardsDistributed.plus(event.params.amount)
  stats.lastUpdated = event.block.timestamp
  stats.save()
}

export function handleProtectionActivated(event: ProtectionActivated): void {
  let user = loadOrCreateUser(event.params.user)
  
  // Update protection status
  user.isProtected = true
  user.protectionLevel = event.params.level.toI32()
  user.updatedAt = event.block.timestamp
  user.save()
  
  // Update protocol stats
  let stats = ProtocolStats.load("1")!
  stats.totalProtectedUsers = stats.totalProtectedUsers + 1
  
  // Update protection level distribution
  if (user.protectionLevel == 1) stats.level1Users = stats.level1Users + 1
  else if (user.protectionLevel == 2) stats.level2Users = stats.level2Users + 1
  else if (user.protectionLevel == 3) stats.level3Users = stats.level3Users + 1
  else if (user.protectionLevel == 4) stats.level4Users = stats.level4Users + 1
  else if (user.protectionLevel == 5) stats.level5Users = stats.level5Users + 1
  
  stats.lastUpdated = event.block.timestamp
  stats.save()
}

export function handleTransfer(event: Transfer): void {
  // Create transfer record for analytics
  let transfer = new TokenTransfer(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.amount = event.params.value
  transfer.transactionHash = event.transaction.hash
  transfer.blockNumber = event.block.number
  transfer.blockTimestamp = event.block.timestamp
  transfer.save()
  
  // Update user balances if not zero address
  let zeroAddress = Address.fromString("0x0000000000000000000000000000000000000000")
  
  if (event.params.from != zeroAddress) {
    let fromUser = loadOrCreateUser(event.params.from)
    fromUser.aegBalance = fromUser.aegBalance.minus(event.params.value)
    fromUser.updatedAt = event.block.timestamp
    fromUser.save()
  }
  
  if (event.params.to != zeroAddress) {
    let toUser = loadOrCreateUser(event.params.to)
    toUser.aegBalance = toUser.aegBalance.plus(event.params.value)
    toUser.updatedAt = event.block.timestamp
    toUser.save()
  }
}
