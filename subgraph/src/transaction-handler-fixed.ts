// Transaction Handler for Real-time MEV Detection
// Processes Etherlink blocks and transactions

import { ethereum, BigInt, Address, Bytes, log, BigDecimal } from "@graphprotocol/graph-ts"
import { Transaction } from "../generated/schema"
import { processMEVTransaction } from "./mev-detection"

/**
 * Handle new blocks for real-time transaction analysis
 * This is called for every new block on Etherlink
 */
export function handleBlock(block: ethereum.Block): void {
  log.info("Processing block {} with {} transactions", [
    block.number.toString(),
    block.transactions.length.toString()
  ])
  
  // Process each transaction in the block
  for (let i = 0; i < block.transactions.length; i++) {
    let ethTx = block.transactions[i]
    
    // Skip if transaction already processed
    let transaction = Transaction.load(ethTx.hash.toHexString())
    if (transaction) {
      continue
    }
    
    // Create new transaction entity
    transaction = createTransactionEntity(ethTx, block)
    
    // Perform MEV analysis
    processMEVTransaction(transaction, block.timestamp)
  }
  
  log.info("Block {} processing completed", [block.number.toString()])
}

/**
 * Create transaction entity from Ethereum transaction
 */
function createTransactionEntity(ethTx: ethereum.Transaction, block: ethereum.Block): Transaction {
  let transaction = new Transaction(ethTx.hash.toHexString())
  
  // Basic transaction data
  transaction.hash = ethTx.hash
  transaction.from = ethTx.from
  transaction.to = ethTx.to
  transaction.value = ethTx.value
  transaction.gasPrice = ethTx.gasPrice
  transaction.gasUsed = ethTx.gasLimit // Will be updated with actual gas used later
  
  // Block information
  transaction.blockNumber = block.number
  transaction.timestamp = block.timestamp
  
  // MEV analysis fields (initialized)
  transaction.isMEV = false
  transaction.mevType = ""
  transaction.riskScore = BigInt.fromI32(0)
  
  // Pattern detection (initialized)
  transaction.isHighGas = false
  transaction.isPotentialSandwich = false
  transaction.isPotentialFrontRun = false
  transaction.isArbitrage = false
  
  // Optional MEV threat ID
  transaction.mevThreatId = null
  
  transaction.save()
  
  return transaction
}

/**
 * Create transaction from raw transaction data
 * Used for manual transaction creation or external data
 */
export function createTransactionFromData(
  txHash: string,
  from: string,
  to: string | null,
  value: string,
  gasPrice: string,
  gasLimit: string,
  blockNumber: string,
  blockTimestamp: string
): Transaction {
  let transaction = new Transaction(txHash)
  
  // Convert string data to proper types
  transaction.hash = Bytes.fromHexString(txHash)
  transaction.from = Address.fromString(from)
  
  if (to) {
    transaction.to = Address.fromString(to)
  } else {
    transaction.to = null
  }
  
  transaction.value = BigInt.fromString(value)
  transaction.gasPrice = BigInt.fromString(gasPrice)
  transaction.gasUsed = BigInt.fromString(gasLimit)
  transaction.blockNumber = BigInt.fromString(blockNumber)
  transaction.timestamp = BigInt.fromString(blockTimestamp)
  
  // MEV analysis fields (initialized)
  transaction.isMEV = false
  transaction.mevType = ""
  transaction.riskScore = BigInt.fromI32(0)
  
  // Pattern detection (initialized)
  transaction.isHighGas = false
  transaction.isPotentialSandwich = false
  transaction.isPotentialFrontRun = false
  transaction.isArbitrage = false
  
  transaction.save()
  
  // Perform MEV analysis
  let avgGasPrice = BigInt.fromString("20000000000") // 20 gwei default
  processMEVTransaction(transaction, transaction.timestamp)
  
  return transaction
}

/**
 * Handle transaction receipts to update gas usage
 * Called when transaction receipts are available
 */
export function handleTransactionReceipt(
  txHash: string,
  gasUsed: BigInt,
  status: i32
): void {
  let transaction = Transaction.load(txHash)
  if (!transaction) {
    log.warning("Transaction receipt received for unknown transaction: {}", [txHash])
    return
  }
  
  // Update actual gas used
  transaction.gasUsed = gasUsed
  
  // Update MEV analysis based on actual gas consumption
  if (status == 1) { // Transaction successful
    // Re-analyze with updated gas information
    processMEVTransaction(transaction, transaction.timestamp)
  }
  
  transaction.save()
}

/**
 * Batch process multiple transactions
 * Useful for historical data or bulk processing
 */
export function batchProcessTransactions(transactions: Transaction[]): void {
  log.info("Batch processing {} transactions", [transactions.length.toString()])
  
  for (let i = 0; i < transactions.length; i++) {
    let transaction = transactions[i]
    processMEVTransaction(transaction, transaction.timestamp)
  }
  
  log.info("Batch processing completed")
}
