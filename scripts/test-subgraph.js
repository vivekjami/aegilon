#!/usr/bin/env node

/**
 * Test script to verify Goldsky subgraph deployment and schema
 */

const { GraphQLClient } = require('graphql-request');
require('dotenv').config();

const client = new GraphQLClient(process.env.GOLDSKY_SUBGRAPH_URL);

async function testSubgraph() {
  console.log('🧪 Testing Aegilon MEV Subgraph...');
  console.log(`📡 Endpoint: ${process.env.GOLDSKY_SUBGRAPH_URL}`);
  
  try {
    // Test 1: Get metadata
    console.log('\n1️⃣ Testing metadata query...');
    const metaQuery = `
      query {
        _meta {
          block {
            number
            hash
          }
        }
      }
    `;
    
    const metaResult = await client.request(metaQuery);
    console.log('✅ Metadata:', metaResult);
    
    // Test 2: Get token transfers
    console.log('\n2️⃣ Testing token transfers query...');
    const transfersQuery = `
      query {
        tokenTransfers(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
          id
          from
          to
          amount
          blockNumber
          blockTimestamp
        }
      }
    `;
    
    const transfersResult = await client.request(transfersQuery);
    console.log('✅ Token Transfers:', transfersResult);
    
    // Test 3: Get transactions with MEV analysis
    console.log('\n3️⃣ Testing transactions query...');
    const transactionsQuery = `
      query {
        transactions(first: 5, orderBy: blockNumber, orderDirection: desc) {
          id
          hash
          from
          to
          gasPrice
          riskScore
          isMEV
          isHighGas
          blockNumber
          timestamp
        }
      }
    `;
    
    const transactionsResult = await client.request(transactionsQuery);
    console.log('✅ Transactions:', transactionsResult);
    
    // Test 4: Get MEV alerts
    console.log('\n4️⃣ Testing MEV alerts query...');
    const alertsQuery = `
      query {
        mevAlerts(first: 5, orderBy: blockNumber, orderDirection: desc) {
          id
          threatType
          severity
          targetAddress
          attackerAddress
          gasPrice
          riskScore
          detected
          blockNumber
          timestamp
        }
      }
    `;
    
    const alertsResult = await client.request(alertsQuery);
    console.log('✅ MEV Alerts:', alertsResult);
    
    // Test 5: Get gas analytics
    console.log('\n5️⃣ Testing gas analytics query...');
    const gasQuery = `
      query {
        gasPriceAnalytics(first: 5, orderBy: blockNumber, orderDirection: desc) {
          id
          avgGasPrice
          maxGasPrice
          minGasPrice
          gasSpike
          anomalousTransactions
          transactionCount
          blockNumber
        }
      }
    `;
    
    const gasResult = await client.request(gasQuery);
    console.log('✅ Gas Analytics:', gasResult);
    
    console.log('\n🎉 All schema tests passed! Subgraph is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

testSubgraph();
