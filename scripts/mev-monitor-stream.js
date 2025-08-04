#!/usr/bin/env node

/**
 * Real-time MEV Monitoring Streaming Service
 * Connects to Goldsky subgraph and streams MEV alerts in real-time
 */

const { GraphQLClient } = require('graphql-request');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

class MEVMonitoringStream extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.client = new GraphQLClient(config.subgraphUrl);
    this.isRunning = false;
    this.lastBlockProcessed = 0;
    this.alertCount = 0;
  }

  /**
   * Start the real-time monitoring stream
   */
  async start() {
    console.log('🚀 Starting Aegilon MEV Monitoring Stream...');
    this.isRunning = true;
    
    try {
      // Get the latest block to start from
      const latestBlock = await this.getLatestBlock();
      this.lastBlockProcessed = latestBlock;
      
      console.log(`📡 Monitoring starting from block: ${latestBlock}`);
      console.log(`🔗 Subgraph URL: ${this.config.subgraphUrl}`);
      
      // Start polling for new MEV alerts
      this.pollForAlerts();
      
      // Start real-time transaction monitoring
      this.monitorTransactions();
      
      console.log('✅ MEV Monitoring Stream is now active!');
      console.log('💰 Watching for sandwich attacks, front-running, and arbitrage...');
      
    } catch (error) {
      console.error('❌ Failed to start monitoring stream:', error.message);
      this.stop();
    }
  }

  /**
   * Stop the monitoring stream
   */
  stop() {
    console.log('⏹️  Stopping MEV Monitoring Stream...');
    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Get the latest block number from the subgraph
   */
  async getLatestBlock() {
    const query = `
      query {
        _meta {
          block {
            number
          }
        }
      }
    `;
    
    try {
      const data = await this.client.request(query);
      return data._meta.block.number;
    } catch (error) {
      console.warn('Using default block number due to query error:', error.message);
      return 0; // Fallback to block 0 if query fails
    }
  }

  /**
   * Poll for new MEV alerts
   */
  async pollForAlerts() {
    if (!this.isRunning) return;

    const query = `
      query GetMEVAlerts($lastBlock: BigInt!) {
        mevAlerts(
          where: { blockNumber_gt: $lastBlock }
          orderBy: blockNumber
          orderDirection: asc
          first: 100
        ) {
          id
          threatType
          severity
          targetAddress
          attackerAddress
          potentialLoss
          gasPrice
          riskScore
          detected
          prevented
          blockNumber
          timestamp
          transactionHash
        }
      }
    `;

    try {
      const data = await this.client.request(query, {
        lastBlock: this.lastBlockProcessed.toString()
      });

      if (data.mevAlerts && data.mevAlerts.length > 0) {
        for (const alert of data.mevAlerts) {
          this.processAlert(alert);
          this.lastBlockProcessed = Math.max(this.lastBlockProcessed, parseInt(alert.blockNumber));
        }
      }
    } catch (error) {
      console.error('Error polling for alerts:', error.message);
    }

    // Continue polling every 5 seconds
    setTimeout(() => this.pollForAlerts(), 5000);
  }

  /**
   * Monitor transactions for MEV patterns
   */
  async monitorTransactions() {
    if (!this.isRunning) return;

    const query = `
      query GetRecentTransactions($lastBlock: BigInt!) {
        transactions(
          where: { 
            blockNumber_gt: $lastBlock
            isMEV: true
          }
          orderBy: blockNumber
          orderDirection: desc
          first: 50
        ) {
          id
          hash
          from
          to
          gasPrice
          riskScore
          mevType
          isPotentialSandwich
          isPotentialFrontRun
          isArbitrage
          blockNumber
          timestamp
        }
      }
    `;

    try {
      const data = await this.client.request(query, {
        lastBlock: this.lastBlockProcessed.toString()
      });

      if (data.transactions && data.transactions.length > 0) {
        console.log(`🔍 Found ${data.transactions.length} MEV transactions in recent blocks`);
        
        for (const tx of data.transactions) {
          this.analyzeTransaction(tx);
        }
      }
    } catch (error) {
      console.error('Error monitoring transactions:', error.message);
    }

    // Continue monitoring every 10 seconds
    setTimeout(() => this.monitorTransactions(), 10000);
  }

  /**
   * Process a MEV alert
   */
  processAlert(alert) {
    this.alertCount++;
    
    const alertInfo = {
      id: alert.id,
      type: alert.threatType,
      severity: alert.severity,
      target: alert.targetAddress,
      attacker: alert.attackerAddress,
      potentialLoss: this.formatEther(alert.potentialLoss),
      riskScore: alert.riskScore,
      blockNumber: alert.blockNumber,
      transactionHash: alert.transactionHash,
      timestamp: new Date(parseInt(alert.timestamp) * 1000).toISOString()
    };

    // Emit the alert for other components to handle
    this.emit('mevAlert', alertInfo);

    // Log to console with color coding
    const severity = alert.severity;
    const color = severity === 'HIGH' ? '🔴' : severity === 'MEDIUM' ? '🟡' : '🟢';
    
    console.log(`\\n${color} MEV ALERT #${this.alertCount}`);
    console.log(`📊 Type: ${alert.threatType}`);
    console.log(`⚠️  Severity: ${alert.severity}`);
    console.log(`🎯 Target: ${alert.targetAddress}`);
    console.log(`👤 Attacker: ${alert.attackerAddress}`);
    console.log(`💸 Potential Loss: ${alertInfo.potentialLoss} XTZ`);
    console.log(`📈 Risk Score: ${alert.riskScore}/100`);
    console.log(`🧱 Block: ${alert.blockNumber}`);
    console.log(`🔗 TX: ${alert.transactionHash}`);
    console.log(`⏰ Time: ${alertInfo.timestamp}`);

    // Additional actions based on severity
    if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
      console.log('🚨 HIGH PRIORITY ALERT - Consider immediate intervention!');
      
      // Here you could trigger additional actions:
      // - Send notifications to Discord/Slack
      // - Trigger automatic protection mechanisms
      // - Alert users via frontend dashboard
    }
  }

  /**
   * Analyze transaction for MEV patterns
   */
  analyzeTransaction(tx) {
    if (tx.riskScore > 70) {
      console.log(`\\n🔎 High-Risk Transaction Detected`);
      console.log(`🔗 Hash: ${tx.hash}`);
      console.log(`📈 Risk Score: ${tx.riskScore}/100`);
      console.log(`🏷️  MEV Type: ${tx.mevType}`);
      console.log(`💨 Gas Price: ${this.formatGwei(tx.gasPrice)} Gwei`);
      
      if (tx.isPotentialSandwich) {
        console.log(`🥪 Potential Sandwich Attack Component`);
      }
      if (tx.isPotentialFrontRun) {
        console.log(`🏃 Potential Front-Running Detected`);
      }
      if (tx.isArbitrage) {
        console.log(`⚖️  Arbitrage Opportunity Detected`);
      }
    }
  }

  /**
   * Format Wei to Ether
   */
  formatEther(wei) {
    if (!wei) return '0';
    return (parseInt(wei) / 1e18).toFixed(6);
  }

  /**
   * Format Wei to Gwei
   */
  formatGwei(wei) {
    if (!wei) return '0';
    return (parseInt(wei) / 1e9).toFixed(2);
  }

  /**
   * Get current monitoring statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      alertCount: this.alertCount,
      lastBlockProcessed: this.lastBlockProcessed,
      uptime: process.uptime()
    };
  }
}

// Configuration
const config = {
  subgraphUrl: process.env.GOLDSKY_SUBGRAPH_URL || 'https://api.goldsky.com/api/public/project_cmdhj7lfx6g2v01um6qgnabhf/subgraphs/aegilon-mev/1.1.0/gn',
  etherlinktRpcUrl: process.env.ETHERLINK_RPC_URL || 'https://node.ghostnet.etherlink.com'
};

// Create and start the monitoring stream
const monitor = new MEVMonitoringStream(config);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Received shutdown signal...');
  monitor.stop();
  setTimeout(() => {
    console.log('✅ MEV Monitoring Stream stopped.');
    process.exit(0);
  }, 1000);
});

// Display stats every 60 seconds
setInterval(() => {
  const stats = monitor.getStats();
  if (stats.isRunning) {
    console.log(`\\n📊 Monitoring Stats:`);
    console.log(`   Alerts detected: ${stats.alertCount}`);
    console.log(`   Last block: ${stats.lastBlockProcessed}`);
    console.log(`   Uptime: ${Math.floor(stats.uptime / 60)}m ${Math.floor(stats.uptime % 60)}s`);
  }
}, 60000);

// Start monitoring
if (require.main === module) {
  monitor.start().catch(console.error);
}

module.exports = MEVMonitoringStream;
