#!/usr/bin/env node

/**
 * Simple test to verify Goldsky subgraph connectivity
 */

const { GraphQLClient } = require('graphql-request');
require('dotenv').config();

const client = new GraphQLClient(process.env.GOLDSKY_SUBGRAPH_URL);

async function testConnection() {
  console.log('Testing Goldsky subgraph connection...');
  console.log('URL:', process.env.GOLDSKY_SUBGRAPH_URL);
  
  try {
    // Test basic connection with _meta query
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
    
    console.log('Testing _meta query...');
    const metaResult = await client.request(metaQuery);
    console.log('✅ Meta query successful:', metaResult);
    
    // Test TokenTransfer query (our only entity)
    const transferQuery = `
      query {
        tokenTransfers(first: 5) {
          id
          from
          to
          amount
          blockNumber
          blockTimestamp
        }
      }
    `;
    
    console.log('Testing token transfers query...');
    const transferResult = await client.request(transferQuery);
    console.log('✅ Token transfers query successful:', transferResult);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testConnection();
