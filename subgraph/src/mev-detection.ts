// MEV Detection Algorithms for Aegilon Subgraph
// Real-time analysis of transaction patterns on Etherlink

import { ethereum, BigInt, Address, Bytes, log, BigDecimal } from "@graphprotocol/graph-ts"
import {
  Transaction,
  MEVAlert,
  SandwichPattern,
  GasPriceAnalytics
} from "../generated/schema"

// Constants for MEV detection
const GAS_SPIKE_THRESHOLD = BigInt.fromI32(120) // 20% above average
const SANDWICH_TIME_WINDOW = BigInt.fromI32(5) // 5 seconds
const ARBITRAGE_PROFIT_THRESHOLD = BigInt.fromI32(50) // 0.5% profit
const FRONT_RUN_GAS_MULTIPLIER = BigInt.fromI32(115) // 15% above average

// Track recent transactions for pattern analysis
let recentTransactions: Transaction[] = []
const MAX_RECENT_TRANSACTIONS = 50

/**
 * Detect sandwich attack patterns
 * Looks for front-run, victim, back-run sequence within time window
 */
export function detectSandwich(
  transaction: Transaction,
  blockTimestamp: BigInt
): boolean {
  // Look for transactions with similar characteristics around this time
  for (let i = 0; i < recentTransactions.length; i++) {
    let recentTx = recentTransactions[i]
    
    // Check if within time window
    if (recentTx.to && transaction.to &&
        recentTx.to!.equals(transaction.to!) &&
        blockTimestamp.minus(recentTx.timestamp).le(SANDWICH_TIME_WINDOW)) {
      
      // Check gas price relationship (sandwich pattern)
      if (recentTx.gasPrice.gt(transaction.gasPrice)) {
        log.info("Potential sandwich pattern detected: front-run tx {} victim tx {}", 
          [recentTx.hash.toHexString(), transaction.hash.toHexString()])
        return true
      }
    }
  }
  
  return false
}

/**
 * Detect front-running patterns
 * High gas price + same target contract
 */
export function detectFrontRun(
  transaction: Transaction,
  avgGasPrice: BigInt
): boolean {
  // Check if gas price is significantly higher than average
  let gasThreshold = avgGasPrice.times(FRONT_RUN_GAS_MULTIPLIER).div(BigInt.fromI32(100))
  
  if (transaction.gasPrice.gt(gasThreshold)) {
    // Check if targeting same contract as recent transactions
    for (let i = 0; i < recentTransactions.length; i++) {
      let recentTx = recentTransactions[i]
      if (recentTx.to && transaction.to && recentTx.to!.equals(transaction.to!)) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Detect arbitrage opportunities
 * Price discrepancies and quick execution
 */
export function detectArbitrage(
  transaction: Transaction,
  blockTimestamp: BigInt
): boolean {
  // Simple heuristic: high value transaction with quick execution
  let threshold = BigInt.fromString("1000000000000000000") // 1 ETH equivalent
  
  if (transaction.value.gt(threshold) && transaction.gasPrice.gt(BigInt.fromI32(0))) {
    return true
  }
  
  return false
}

/**
 * Calculate comprehensive risk score for a transaction
 * Returns score from 0-100
 */
export function calculateRiskScore(
  transaction: Transaction,
  avgGasPrice: BigInt,
  blockTimestamp: BigInt
): BigInt {
  let score = 0.0
  
  // Gas price analysis (0-30 points)
  if (avgGasPrice.gt(BigInt.fromI32(0))) {
    let gasRatio = transaction.gasPrice.toBigDecimal().div(avgGasPrice.toBigDecimal())
    if (gasRatio.gt(BigDecimal.fromString("2.0"))) {
      score += 30.0
    } else if (gasRatio.gt(BigDecimal.fromString("1.5"))) {
      score += 20.0
    } else if (gasRatio.gt(BigDecimal.fromString("1.2"))) {
      score += 10.0
    }
  }
  
  // Value analysis (0-25 points)
  let highValueThreshold = BigInt.fromString("10000000000000000000") // 10 ETH
  if (transaction.value.gt(highValueThreshold)) {
    score += 25.0
  } else if (transaction.value.gt(BigInt.fromString("1000000000000000000"))) {
    score += 15.0
  }
  
  // Pattern detection (0-45 points)
  if (detectSandwich(transaction, blockTimestamp)) {
    score += 25.0
  }
  if (detectFrontRun(transaction, avgGasPrice)) {
    score += 20.0
  }
  if (detectArbitrage(transaction, blockTimestamp)) {
    score += 15.0
  }
  
  let scoreFloat = Math.floor(Math.min(score, 100.0)) as i32
  return BigInt.fromI32(scoreFloat)
}

/**
 * Create MEV alert when threat is detected
 */
export function createMEVAlert(
  transaction: Transaction,
  threatType: string,
  riskScore: BigInt,
  blockTimestamp: BigInt
): MEVAlert {
  let alertId = transaction.hash.toHexString() + "-" + threatType
  let alert = new MEVAlert(alertId)
  
  alert.threatType = threatType
  let riskScoreInt = riskScore.toI32()
  alert.severity = riskScoreInt > 75 ? "CRITICAL" : (riskScoreInt > 50 ? "HIGH" : (riskScoreInt > 25 ? "MEDIUM" : "LOW"))
  alert.targetAddress = transaction.to ? transaction.to! : Address.zero()
  alert.attackerAddress = transaction.from
  alert.potentialLoss = BigInt.fromI32(0) // To be calculated
  alert.gasPrice = transaction.gasPrice
  alert.riskScore = riskScore
  alert.detected = true
  alert.prevented = false
  alert.blockNumber = transaction.blockNumber
  alert.timestamp = blockTimestamp
  alert.transactionHash = transaction.hash
  
  // Calculate potential loss based on gas premium
  let avgGas = BigInt.fromString("20000000000") // 20 gwei default
  if (transaction.gasPrice.gt(avgGas)) {
    alert.gasCost = transaction.gasPrice.minus(avgGas)
  } else {
    alert.gasCost = BigInt.fromI32(0)
  }
  
  alert.save()
  
  log.info("MEV Alert created: {} for transaction {}", [
    threatType,
    transaction.hash.toHexString()
  ])
  
  return alert
}

/**
 * Update gas analytics for the current block
 */
export function updateGasAnalytics(gasPrice: BigInt, timestamp: BigInt): GasPriceAnalytics {
  let blockId = timestamp.div(BigInt.fromI32(60)).toString() // 1-minute intervals
  let analytics = GasPriceAnalytics.load(blockId)
  
  if (!analytics) {
    analytics = new GasPriceAnalytics(blockId)
    analytics.avgGasPrice = gasPrice
    analytics.medianGasPrice = gasPrice
    analytics.maxGasPrice = gasPrice
    analytics.minGasPrice = gasPrice
    analytics.gasSpike = false
    analytics.spikeThreshold = GAS_SPIKE_THRESHOLD
    analytics.anomalousTransactions = 0
    analytics.startTimestamp = timestamp
    analytics.endTimestamp = timestamp
    analytics.blockNumber = BigInt.fromI32(0)
    analytics.transactionCount = 1
  } else {
    // Update statistics
    analytics.transactionCount += 1
    
    if (gasPrice.gt(analytics.maxGasPrice)) {
      analytics.maxGasPrice = gasPrice
    }
    if (gasPrice.lt(analytics.minGasPrice)) {
      analytics.minGasPrice = gasPrice
    }
    
    // Update average (simple running average)
    let totalGas = analytics.avgGasPrice.times(BigInt.fromI32(analytics.transactionCount - 1))
    analytics.avgGasPrice = totalGas.plus(gasPrice).div(BigInt.fromI32(analytics.transactionCount))
    
    // Check for gas spike
    let spikeThreshold = analytics.avgGasPrice.times(analytics.spikeThreshold).div(BigInt.fromI32(100))
    if (gasPrice.gt(spikeThreshold)) {
      analytics.gasSpike = true
      analytics.anomalousTransactions += 1
    }
    
    analytics.endTimestamp = timestamp
  }
  
  analytics.save()
  return analytics
}

/**
 * Add transaction to recent transactions cache
 */
export function addToRecentTransactions(transaction: Transaction): void {
  recentTransactions.push(transaction)
  
  // Keep only recent transactions
  if (recentTransactions.length > MAX_RECENT_TRANSACTIONS) {
    recentTransactions.shift()
  }
}

/**
 * Analyze transaction for MEV patterns
 * Main entry point for MEV detection
 */
export function analyzeMEVPatterns(
  transaction: Transaction,
  avgGasPrice: BigInt,
  blockTimestamp: BigInt
): void {
  // Calculate risk score
  let riskScore = calculateRiskScore(transaction, avgGasPrice, blockTimestamp)
  
  // Update transaction with MEV analysis
  transaction.isMEV = riskScore.gt(BigInt.fromI32(50))
  transaction.riskScore = riskScore
  transaction.save()
  
  // Add to recent transactions for pattern analysis
  addToRecentTransactions(transaction)
  
  // Create alerts for high-risk transactions
  if (riskScore.gt(BigInt.fromI32(50))) {
    if (detectSandwich(transaction, blockTimestamp)) {
      createMEVAlert(transaction, "SANDWICH", riskScore, blockTimestamp)
    }
    if (detectFrontRun(transaction, avgGasPrice)) {
      createMEVAlert(transaction, "FRONTRUN", riskScore, blockTimestamp)
    }
    if (detectArbitrage(transaction, blockTimestamp)) {
      createMEVAlert(transaction, "ARBITRAGE", riskScore, blockTimestamp)
    }
    
    // Generic MEV alert if no specific pattern
    if (!transaction.isPotentialSandwich && !transaction.isPotentialFrontRun && !transaction.isArbitrage) {
      createMEVAlert(transaction, "POTENTIAL_MEV", riskScore, blockTimestamp)
    }
  }
  
  log.info("MEV analysis completed for transaction {} with risk score {}", [
    transaction.hash.toHexString(),
    riskScore.toString()
  ])
}

/**
 * Process new transaction for MEV patterns
 * Called from block handler
 */
export function processMEVTransaction(
  transaction: Transaction,
  blockTimestamp: BigInt
): void {
  // Update gas analytics
  let gasAnalytics = updateGasAnalytics(transaction.gasPrice, blockTimestamp)
  
  // Analyze for MEV patterns
  analyzeMEVPatterns(transaction, gasAnalytics.avgGasPrice, blockTimestamp)
}

/**
 * Exported function for external analysis calls
 * Main entry point for MEV pattern analysis
 */
export function analyzeTransactionMEV(
  transaction: Transaction,
  avgGasPrice: BigInt,
  blockTimestamp: BigInt
): void {
  analyzeMEVPatterns(transaction, avgGasPrice, blockTimestamp)
}
