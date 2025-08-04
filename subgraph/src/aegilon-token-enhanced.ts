// Enhanced Aegilon Token Handler with MEV Detection
import { BigInt, log, ethereum } from "@graphprotocol/graph-ts"
import { Transfer } from "../generated/AegilonToken/AegilonToken"
import { TokenTransfer, Transaction, MEVAlert, GasPriceAnalytics } from "../generated/schema"

export function handleTransfer(event: Transfer): void {
  log.info("Transfer from {} to {} amount {}", [
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.value.toString()
  ])
  
  let transferId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let transfer = new TokenTransfer(transferId)
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.amount = event.params.value
  transfer.transactionHash = event.transaction.hash
  transfer.blockNumber = event.block.number
  transfer.blockTimestamp = event.block.timestamp
  transfer.save()
  
  // Create or update transaction for MEV analysis
  let transaction = Transaction.load(event.transaction.hash.toHexString())
  if (!transaction) {
    transaction = new Transaction(event.transaction.hash.toHexString())
    transaction.hash = event.transaction.hash
    transaction.from = event.transaction.from
    transaction.to = event.transaction.to
    transaction.value = event.transaction.value
    transaction.gasPrice = event.transaction.gasPrice
    transaction.gasUsed = event.transaction.gasUsed
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
    transaction.isMEV = false
    transaction.mevType = ""
    transaction.riskScore = BigInt.fromI32(0)
    transaction.isHighGas = false
    transaction.isPotentialSandwich = false
    transaction.isPotentialFrontRun = false
    transaction.isArbitrage = false
    transaction.mevThreatId = null
  }
  
  // Basic MEV risk assessment
  let avgGasPrice = getOrCreateGasAnalytics(event.block.timestamp)
  if (avgGasPrice && event.transaction.gasPrice.gt(avgGasPrice.avgGasPrice.times(BigInt.fromI32(2)))) {
    transaction.isHighGas = true
    transaction.riskScore = BigInt.fromI32(30)
    
    // Create MEV alert for high gas price
    let alertId = event.transaction.hash.toHexString() + "-high-gas"
    let alert = new MEVAlert(alertId)
    alert.threatType = "HIGH_RISK_MEV"
    alert.severity = "MEDIUM"
    alert.targetAddress = event.transaction.to || event.transaction.from
    alert.attackerAddress = event.transaction.from
    alert.potentialLoss = BigInt.fromI32(0)
    alert.gasPrice = event.transaction.gasPrice
    alert.gasCost = event.transaction.gasPrice.times(event.transaction.gasUsed)
    alert.riskScore = BigInt.fromI32(30)
    alert.detected = true
    alert.prevented = false
    alert.blockNumber = event.block.number
    alert.timestamp = event.block.timestamp
    alert.transactionHash = event.transaction.hash
    alert.save()
  }
  
  transaction.save()
}

export function handleBlock(block: ethereum.Block): void {
  log.info("Processing block {} at timestamp {}", [
    block.number.toString(),
    block.timestamp.toString()
  ])
  
  // Update gas analytics
  updateGasAnalytics(block.timestamp, block.number)
}

function getOrCreateGasAnalytics(timestamp: BigInt): GasPriceAnalytics | null {
  let intervalId = timestamp.div(BigInt.fromI32(300)).toString() // 5-minute intervals
  return GasPriceAnalytics.load(intervalId)
}

function updateGasAnalytics(timestamp: BigInt, blockNumber: BigInt): void {
  let intervalId = timestamp.div(BigInt.fromI32(300)).toString() // 5-minute intervals
  let analytics = GasPriceAnalytics.load(intervalId)
  
  if (!analytics) {
    analytics = new GasPriceAnalytics(intervalId)
    analytics.avgGasPrice = BigInt.fromString("20000000000") // 20 gwei default
    analytics.medianGasPrice = BigInt.fromString("20000000000")
    analytics.maxGasPrice = BigInt.fromString("20000000000")
    analytics.minGasPrice = BigInt.fromString("20000000000")
    analytics.gasSpike = false
    analytics.spikeThreshold = BigInt.fromI32(120) // 20% threshold
    analytics.anomalousTransactions = 0
    analytics.startTimestamp = timestamp
    analytics.endTimestamp = timestamp
    analytics.blockNumber = blockNumber
    analytics.transactionCount = 0
  }
  
  analytics.endTimestamp = timestamp
  analytics.blockNumber = blockNumber
  analytics.save()
}
