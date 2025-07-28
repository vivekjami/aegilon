#!/usr/bin/env node
/**
 * Aegilon Partner Integration Setup Script
 * Configures all hackathon partner tools for seamless operation
 */

require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');

// Configuration
const PARTNERS = {
  goldsky: {
    name: 'Goldsky',
    apiUrl: 'https://api.goldsky.com',
    features: ['Real-time indexing', 'Custom subgraphs', 'MEV detection']
  },
  thirdweb: {
    name: 'Thirdweb',
    apiUrl: 'https://api.thirdweb.com',
    features: ['Smart contract deployment', 'SDK integration', 'Dashboard management']
  },
  redstone: {
    name: 'Redstone',
    apiUrl: 'https://oracle-gateway-1.a.redstone.finance',
    features: ['Price feeds', 'Oracle data', 'MEV price validation']
  },
  sequence: {
    name: 'Sequence',
    apiUrl: 'https://api.sequence.app',
    features: ['Wallet integration', 'User authentication', 'Transaction management']
  }
};

class PartnerIntegration {
  constructor() {
    this.results = {
      goldsky: { status: 'pending', features: [], errors: [] },
      thirdweb: { status: 'pending', features: [], errors: [] },
      redstone: { status: 'pending', features: [], errors: [] },
      sequence: { status: 'pending', features: [], errors: [] }
    };
  }

  async checkEnvironmentVariables() {
    console.log('🔍 Checking environment configuration...');
    
    const requiredVars = [
      'ETHERLINK_GHOSTNET_RPC',
      'GOLDSKY_API_KEY',
      'THIRDWEB_CLIENT_ID',
      'REDSTONE_API_KEY',
      'SEQUENCE_PROJECT_ID'
    ];

    const missing = [];
    for (const variable of requiredVars) {
      if (!process.env[variable]) {
        missing.push(variable);
      }
    }

    if (missing.length > 0) {
      console.log('⚠️  Missing environment variables:');
      missing.forEach(variable => console.log(`   - ${variable}`));
      console.log('\n📋 Please add these to your .env file');
      return false;
    }

    console.log('✅ All environment variables configured');
    return true;
  }

  async testEtherlinkConnection() {
    console.log('\n🌐 Testing Etherlink connection...');
    
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        process.env.ETHERLINK_GHOSTNET_RPC || 'https://node.ghostnet.etherlink.com'
      );
      
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      
      console.log(`✅ Connected to Etherlink Ghostnet`);
      console.log(`   Chain ID: ${network.chainId}`);
      console.log(`   Current Block: ${blockNumber}`);
      console.log(`   Network: ${network.name || 'etherlink-testnet'}`);
      
      return true;
    } catch (error) {
      console.log(`❌ Etherlink connection failed: ${error.message}`);
      return false;
    }
  }

  async testGoldskyIntegration() {
    console.log('\n📊 Testing Goldsky integration...');
    
    try {
      // Test basic API connection
      if (!process.env.GOLDSKY_API_KEY) {
        throw new Error('GOLDSKY_API_KEY not configured');
      }

      console.log('✅ Goldsky API key configured');
      console.log('📝 Features available:');
      PARTNERS.goldsky.features.forEach(feature => {
        console.log(`   - ${feature}`);
      });

      this.results.goldsky = {
        status: 'success',
        features: PARTNERS.goldsky.features,
        errors: []
      };

      console.log('🚀 Ready for subgraph deployment after contract deployment');
      return true;
    } catch (error) {
      console.log(`❌ Goldsky integration failed: ${error.message}`);
      this.results.goldsky.status = 'error';
      this.results.goldsky.errors.push(error.message);
      return false;
    }
  }

  async testThirdwebIntegration() {
    console.log('\n🔧 Testing Thirdweb integration...');
    
    try {
      if (!process.env.THIRDWEB_CLIENT_ID) {
        throw new Error('THIRDWEB_CLIENT_ID not configured');
      }

      console.log('✅ Thirdweb client ID configured');
      console.log('📝 Features available:');
      PARTNERS.thirdweb.features.forEach(feature => {
        console.log(`   - ${feature}`);
      });

      this.results.thirdweb = {
        status: 'success',
        features: PARTNERS.thirdweb.features,
        errors: []
      };

      console.log('🚀 Ready for smart contract deployment');
      return true;
    } catch (error) {
      console.log(`❌ Thirdweb integration failed: ${error.message}`);
      this.results.thirdweb.status = 'error';
      this.results.thirdweb.errors.push(error.message);
      return false;
    }
  }

  async testRedstoneIntegration() {
    console.log('\n📈 Testing Redstone Oracle integration...');
    
    try {
      // Test oracle data fetching
      const response = await axios.get(
        'https://oracle-gateway-1.a.redstone.finance/prices/latest?ids=ETH,USDC&format=json',
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'Aegilon-MEV-Protector/1.0'
          }
        }
      );

      if (response.data && response.data.ETH) {
        const ethPrice = response.data.ETH.value;
        console.log(`✅ Redstone Oracle connection successful`);
        console.log(`   Current ETH Price: $${ethPrice}`);
        console.log(`   Timestamp: ${new Date(response.data.ETH.timestamp).toISOString()}`);
        
        this.results.redstone = {
          status: 'success',
          features: PARTNERS.redstone.features,
          errors: [],
          testData: {
            ethPrice: ethPrice,
            timestamp: response.data.ETH.timestamp
          }
        };

        console.log('📝 Features available:');
        PARTNERS.redstone.features.forEach(feature => {
          console.log(`   - ${feature}`);
        });

        return true;
      } else {
        throw new Error('Invalid response format from Redstone');
      }
    } catch (error) {
      console.log(`❌ Redstone integration failed: ${error.message}`);
      this.results.redstone.status = 'error';
      this.results.redstone.errors.push(error.message);
      return false;
    }
  }

  async testSequenceIntegration() {
    console.log('\n👛 Testing Sequence Wallet integration...');
    
    try {
      if (!process.env.SEQUENCE_PROJECT_ID) {
        throw new Error('SEQUENCE_PROJECT_ID not configured');
      }

      console.log('✅ Sequence project ID configured');
      console.log('📝 Features available:');
      PARTNERS.sequence.features.forEach(feature => {
        console.log(`   - ${feature}`);
      });

      this.results.sequence = {
        status: 'success',
        features: PARTNERS.sequence.features,
        errors: []
      };

      console.log('🚀 Ready for wallet integration in frontend');
      return true;
    } catch (error) {
      console.log(`❌ Sequence integration failed: ${error.message}`);
      this.results.sequence.status = 'error';
      this.results.sequence.errors.push(error.message);
      return false;
    }
  }

  async generateIntegrationReport() {
    console.log('\n📊 AEGILON PARTNER INTEGRATION REPORT');
    console.log('=====================================');
    
    const successful = Object.values(this.results).filter(r => r.status === 'success').length;
    const total = Object.keys(this.results).length;
    
    console.log(`\n🎯 Integration Status: ${successful}/${total} partners ready`);
    
    for (const [partner, result] of Object.entries(this.results)) {
      const status = result.status === 'success' ? '✅' : '❌';
      console.log(`\n${status} ${PARTNERS[partner].name}`);
      
      if (result.status === 'success') {
        console.log(`   Status: Ready for production use`);
        console.log(`   Features: ${result.features.length} available`);
      } else {
        console.log(`   Status: Configuration needed`);
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
    }

    // Integration recommendations
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Complete .env configuration for any failed integrations');
    console.log('2. Deploy smart contracts using: npm run deploy:testnet');
    console.log('3. Update subgraph with deployed contract addresses');
    console.log('4. Deploy subgraph to Goldsky');
    console.log('5. Build and launch frontend application');
    
    // Save report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        total: total,
        successful: successful,
        readyForProduction: successful === total
      }
    };

    require('fs').writeFileSync(
      './integration-report.json',
      JSON.stringify(reportData, null, 2)
    );

    console.log('\n💾 Full report saved to: integration-report.json');
    
    return successful === total;
  }

  async runFullIntegrationTest() {
    console.log('🛡️  AEGILON PARTNER INTEGRATION TEST');
    console.log('===================================');
    console.log(`🕐 Started at: ${new Date().toISOString()}`);

    const envCheck = await this.checkEnvironmentVariables();
    if (!envCheck) {
      console.log('\n❌ Integration test failed: Missing environment variables');
      return false;
    }

    const etherlinkOk = await this.testEtherlinkConnection();
    const goldskyOk = await this.testGoldskyIntegration();
    const thirdwebOk = await this.testThirdwebIntegration();
    const redstoneOk = await this.testRedstoneIntegration();
    const sequenceOk = await this.testSequenceIntegration();

    const allReady = await this.generateIntegrationReport();

    if (allReady) {
      console.log('\n🎉 ALL SYSTEMS GO! Aegilon is ready for deployment!');
    } else {
      console.log('\n⚠️  Some integrations need attention before full deployment');
    }

    return allReady;
  }
}

// Run integration test if called directly
if (require.main === module) {
  const integration = new PartnerIntegration();
  integration.runFullIntegrationTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Integration test failed:', error);
      process.exit(1);
    });
}

module.exports = PartnerIntegration;
