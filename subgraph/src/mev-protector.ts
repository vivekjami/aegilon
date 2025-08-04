// MEV Protector Event Handlers
// Handles events from MEVProtector and MEVProtectorAdvanced contracts

import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts"
import {
  MEVThreatDetected as MEVThreatDetectedEvent,
  MEVThreatPrevented as MEVThreatPreventedEvent,
  ProtectionActivated as ProtectionActivatedEvent,
  ProtectionDeactivated as ProtectionDeactivatedEvent,
  ThreatReported as ThreatReportedEvent,
  OraclePriceUpdated as OraclePriceUpdatedEvent
} from "../generated/MEVProtector/MEVProtector"

import {
  User,
  MEVThreat,
  ProtectionEvent,
  ThreatReport,
  OracleUpdate,
  MEVAlert,
  ProtocolStats
} from "../generated/schema"

import { calculateRiskScore } from "./mev-detection"

/**
 * Handle MEV threat detection events
 */
export function handleMEVThreatDetected(event: MEVThreatDetectedEvent): void {
  log.info("MEV Threat detected: {} targeting {}", [
    event.params.threatId.toHexString(),
    event.params.target.toHexString()
  ])
  
  // Create or load MEV threat entity
  let threat = new MEVThreat(event.params.threatId.toHexString())
  threat.threatId = event.params.threatId
  threat.targetUser = event.params.target
  threat.attacker = event.params.attacker
  threat.potentialLoss = BigInt.fromI32(0) // Will be calculated
  threat.gasPrice = event.transaction.gasPrice
  threat.detected = true
  threat.prevented = false
  threat.transactionHash = event.transaction.hash
  threat.blockNumber = event.block.number
  threat.timestamp = event.block.timestamp
  threat.gasCost = event.transaction.gasPrice.times(BigInt.fromI32(21000)) // Estimate
  threat.mevThreatId = event.params.threatId.toHexString()
  threat.save()
  
  // Update user statistics
  updateUserThreatStats(event.params.target, true, false)
  
  // Create MEV alert
  createMEVAlertFromThreat(threat, event.params.threatType.toString())
  
  // Update protocol stats
  updateProtocolStats(true, false, BigInt.fromI32(0))
}

/**
 * Handle MEV threat prevention events
 */
export function handleMEVThreatPrevented(event: MEVThreatPreventedEvent): void {
  log.info("MEV Threat prevented: {} for user {}", [
    event.params.threatId.toHexString(),
    event.params.protectedUser.toHexString()
  ])
  
  // Update existing threat
  let threat = MEVThreat.load(event.params.threatId.toHexString())
  if (!threat) {
    log.warning("Threat prevention event for unknown threat: {}", [
      event.params.threatId.toHexString()
    ])
    return
  }
  
  threat.prevented = true
  threat.save()
  
  // Create protection event
  let protectionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let protection = new ProtectionEvent(protectionId)
  protection.threatId = event.params.threatId
  protection.targetUser = event.params.protectedUser
  protection.gasCost = event.transaction.gasPrice.times(BigInt.fromI32(21000))
  protection.successful = true
  protection.transactionHash = event.transaction.hash
  protection.blockNumber = event.block.number
  protection.timestamp = event.block.timestamp
  protection.save()
  
  // Update user statistics
  updateUserThreatStats(event.params.protectedUser, false, true)
  
  // Update protocol stats
  updateProtocolStats(false, true, event.params.savedAmount)
}

/**
 * Handle protection activation events
 */
export function handleProtectionActivated(event: ProtectionActivatedEvent): void {
  log.info("Protection activated for user {} at level {}", [
    event.params.user.toHexString(),
    event.params.level.toString()
  ])
  
  // Load or create user
  let user = User.load(event.params.user.toHexString())
  if (!user) {
    user = new User(event.params.user.toHexString())
    user.address = event.params.user
    user.stakedBalance = BigInt.fromI32(0)
    user.aegBalance = BigInt.fromI32(0)
    user.totalStaked = BigInt.fromI32(0)
    user.totalUnstaked = BigInt.fromI32(0)
    user.totalRewardsClaimed = BigInt.fromI32(0)
    user.threatsDetected = 0
    user.threatsPrevented = 0
    user.totalSavedAmount = BigInt.fromI32(0)
    user.firstStakeTime = null
    user.createdAt = event.block.timestamp
    user.updatedAt = event.block.timestamp
  }
  
  user.protectionLevel = event.params.level.toI32()
  user.isProtected = true
  user.updatedAt = event.block.timestamp
  user.save()
}

/**
 * Handle protection deactivation events
 */
export function handleProtectionDeactivated(event: ProtectionDeactivatedEvent): void {
  log.info("Protection deactivated for user {}", [
    event.params.user.toHexString()
  ])
  
  let user = User.load(event.params.user.toHexString())
  if (user) {
    user.protectionLevel = 0
    user.isProtected = false
    user.updatedAt = event.block.timestamp
    user.save()
  }
}

/**
 * Handle threat reporting events
 */
export function handleThreatReported(event: ThreatReportedEvent): void {
  log.info("Threat reported by {} for threat {}", [
    event.params.reporter.toHexString(),
    event.params.threatId.toHexString()
  ])
  
  let reportId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let report = new ThreatReport(reportId)
  report.reporter = event.params.reporter
  report.threatId = event.params.threatId
  report.confidence = BigInt.fromI32(100) // Default confidence
  report.verified = false // Will be updated by verification process
  report.transactionHash = event.transaction.hash
  report.blockNumber = event.block.number
  report.timestamp = event.block.timestamp
  report.save()
  
  // Update user threat reports count
  let user = User.load(event.params.reporter.toHexString())
  if (user) {
    user.threatsDetected += 1
    user.updatedAt = event.block.timestamp
    user.save()
  }
}

/**
 * Handle oracle price update events
 */
export function handleOraclePriceUpdated(event: OraclePriceUpdatedEvent): void {
  log.info("Oracle price updated for {} to {}", [
    event.params.symbol.toString(),
    event.params.price.toString()
  ])
  
  let updateId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let update = new OracleUpdate(updateId)
  update.asset = event.params.symbol.toString()
  update.newPrice = event.params.price
  update.previousPrice = BigInt.fromI32(0) // Would need to track previous prices
  update.priceChangePercent = null
  update.transactionHash = event.transaction.hash
  update.blockNumber = event.block.number
  update.timestamp = event.block.timestamp
  update.save()
}

/**
 * Update user threat statistics
 */
function updateUserThreatStats(
  userAddress: Address,
  threatDetected: boolean,
  threatPrevented: boolean
): void {
  let user = User.load(userAddress.toHexString())
  if (!user) {
    return
  }
  
  if (threatDetected) {
    user.threatsDetected += 1
  }
  
  if (threatPrevented) {
    user.threatsPrevented += 1
  }
  
  user.updatedAt = BigInt.fromI32(Date.now())
  user.save()
}

/**
 * Create MEV alert from threat detection
 */
function createMEVAlertFromThreat(threat: MEVThreat, threatType: string): MEVAlert {
  let alertId = threat.threatId.toHexString() + "-alert"
  let alert = new MEVAlert(alertId)
  
  alert.threatType = threatType
  alert.severity = "HIGH" // Default for detected threats
  alert.targetAddress = threat.targetUser
  alert.attackerAddress = threat.attacker
  alert.potentialLoss = threat.potentialLoss
  alert.gasPrice = threat.gasPrice
  alert.gasCost = threat.gasCost
  alert.riskScore = BigInt.fromI32(75) // Default high risk
  alert.detected = true
  alert.prevented = threat.prevented
  alert.blockNumber = threat.blockNumber
  alert.timestamp = threat.timestamp
  alert.transactionHash = threat.transactionHash
  alert.save()
  
  return alert
}

/**
 * Update protocol-wide statistics
 */
function updateProtocolStats(
  threatDetected: boolean,
  threatPrevented: boolean,
  savedAmount: BigInt
): void {
  let stats = ProtocolStats.load("1")
  if (!stats) {
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
  
  if (threatDetected) {
    stats.totalThreatsDetected += 1
  }
  
  if (threatPrevented) {
    stats.totalThreatsPrevented += 1
    stats.totalAmountSaved = stats.totalAmountSaved.plus(savedAmount)
  }
  
  stats.lastUpdated = BigInt.fromI32(Date.now())
  stats.save()
}
