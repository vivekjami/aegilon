# Aegilon

**Ultra-Fast MEV Protection Oracle for Etherlink**

Aegilon is a real-time MEV protection suite that leverages Etherlink's sub-500ms confirmations to detect and neutralize sandwich attacks, front-running, and other MEV extraction techniques before they can execute.

## The Problem

MEV (Maximal Extractable Value) attacks cost users billions annually through sandwich attacks and front-running. Traditional solutions rely on private mempools or delayed execution, creating poor user experiences and limited protection.

## The Solution

Aegilon uses Etherlink's speed advantage to flip the script on MEV attackers:

- **Lightning-Fast Detection**: Sub-500ms threat identification and mitigation
- **Cost-Effective Protection**: Near-zero fees enable micro-optimizations impossible on other chains
- **Universal Coverage**: Protects across all Etherlink DeFi protocols
- **Seamless Integration**: One-click activation through familiar wallet interfaces

## Technical Architecture

**Smart Contract Layer**
- MEV detection and protection logic deployed via Thirdweb
- Automated threat neutralization mechanisms
- Cross-protocol compatibility

**Real-Time Monitoring**
- Goldsky-powered transaction indexing and pattern recognition
- Advanced risk scoring algorithms
- Instant threat notifications

**Oracle Integration**
- Redstone price feeds for accurate arbitrage opportunity detection
- Real-time market data analysis
- Predictive MEV modeling

**User Interface**
- Sequence wallet integration
- Real-time threat visualization
- Historical attack analysis

## Architecture Overview

```mermaid
graph TB
    %% User Layer
    User[👤 DeFi User] --> Wallet[Sequence Wallet]
    Wallet --> UI[🖥️ Aegilon Interface]
    
    %% Core Protection Layer
    UI --> Smart[MEV Protection Contract]
    Smart --> Etherlink[Etherlink L2]
    
    %% Detection & Analysis Layer
    subgraph "Real-Time MEV Detection"
        Goldsky[Goldsky Indexer] --> Engine[Detection Engine]
        Engine --> Alerts[Threat Alerts]
    end
    
    %% Oracle Layer
    subgraph "Price Intelligence"
        Oracle[Redstone Oracle] --> Prices[Price Feeds]
        Prices --> Analysis[Market Analysis]
    end
    
    %% Data Flow
    Etherlink -.-> Goldsky
    Engine --> Smart
    Analysis --> Engine
    Smart --> UI
    
    %% Styling
    classDef userLayer fill:#4ade80,stroke:#22c55e,stroke-width:2px,color:#000
    classDef protectionLayer fill:#60a5fa,stroke:#3b82f6,stroke-width:2px,color:#000
    classDef detectionLayer fill:#f472b6,stroke:#ec4899,stroke-width:2px,color:#000
    classDef oracleLayer fill:#fbbf24,stroke:#f59e0b,stroke-width:2px,color:#000
    
    class User,Wallet,UI userLayer
    class Smart,Etherlink protectionLayer
    class Goldsky,Engine,Alerts detectionLayer
    class Oracle,Prices,Analysis oracleLayer
```

## User Stories

**As a DeFi Trader:**
- I want to execute swaps without worrying about sandwich attacks
- I want transparent protection that doesn't complicate my trading flow
- I want to see when MEV attacks are blocked in real-time
- I want protection that works across all Etherlink DeFi protocols

**As a Liquidity Provider:**
- I want protection from just-in-time liquidity attacks
- I want to maintain fair returns without MEV exploitation
- I want automated protection that doesn't require manual intervention

**As a DeFi Protocol:**
- I want to offer users built-in MEV protection
- I want to integrate protection without changing my core contracts
- I want analytics on MEV threats affecting my users

**As an Arbitrageur:**
- I want to distinguish legitimate arbitrage from harmful MEV attacks
- I want fair competition without being front-run by bots
- I want protection from having my own strategies exploited

## How It Works

1. **Monitor**: Goldsky indexes all Etherlink transactions in real-time
2. **Analyze**: Custom algorithms identify potential MEV patterns
3. **Protect**: Smart contracts automatically execute countermeasures
4. **Verify**: Redstone oracles confirm threat legitimacy and mitigation success

## Quick Start

```bash
git clone https://github.com/vivekjami/aegilon.git
cd aegilon
npm install
npm run dev
```

### Environment Setup

```bash
cp .env.example .env
```

Required environment variables:

```bash
# Etherlink Network Configuration
ETHERLINK_RPC_URL=https://node.ghostnet.etherlink.com
ETHERLINK_CHAIN_ID=128123
PRIVATE_KEY=your_wallet_private_key

# Goldsky API (Real-time transaction indexing)
GOLDSKY_API_KEY=your_goldsky_api_key
GOLDSKY_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_abc/subgraphs/aegilon/1.0.0/gn

# Thirdweb (Smart contract deployment and management)
THIRDWEB_CLIENT_ID=your_thirdweb_client_id
THIRDWEB_SECRET_KEY=your_thirdweb_secret_key
THIRDWEB_API_KEY=your_thirdweb_api_key

# Sequence Wallet (User authentication and transactions)
SEQUENCE_PROJECT_ID=your_sequence_project_id
SEQUENCE_ACCESS_KEY=your_sequence_access_key
SEQUENCE_WALLET_CONTEXT=your_wallet_context

# Redstone Oracle (Price feed data)
REDSTONE_API_KEY=your_redstone_api_key
REDSTONE_DATA_FEED_ID=ETH,USDC,USDT,BTC
REDSTONE_GATEWAY_URL=https://oracle-gateway-1.a.redstone.finance

# Application Configuration
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/aegilon

# Monitoring and Analytics
SENTRY_DSN=your_sentry_dsn_for_error_tracking
ANALYTICS_KEY=your_analytics_key

# Security
JWT_SECRET=your_jwt_secret_for_authentication
ENCRYPTION_KEY=your_32_character_encryption_key

# Optional: Testing and Development
TESTNET_MODE=true
DEBUG_LOGGING=true
MOCK_MEV_ATTACKS=false
```

### Deploy to Etherlink

```bash
npm run deploy:etherlink
```

## Demo

The demo showcases real-time MEV attack prevention:

1. **Scenario Setup**: Simulated sandwich attack targeting a large swap
2. **Detection**: Aegilon identifies the attack pattern in <200ms
3. **Mitigation**: Automated countermeasures neutralize the threat
4. **Outcome**: User's transaction executes at fair market price

## Technology Stack

- **Blockchain**: Etherlink L2
- **Smart Contracts**: Solidity + Thirdweb
- **Indexing**: Goldsky subgraphs
- **Oracles**: Redstone price feeds
- **Wallet**: Sequence integration
- **Frontend**: React + TypeScript
- **Testing**: Hardhat + Jest

## Project Structure

```
aegilon/
├── contracts/          # Smart contracts
├── subgraph/          # Goldsky indexing
├── frontend/          # React application
├── scripts/           # Deployment scripts
├── test/             # Test suites
└── docs/             # Documentation
```

## Development Roadmap

**Phase 1: Foundation** ✅
- Core smart contract architecture
- Partner tool integrations
- Basic MEV detection algorithms

**Phase 2: Enhancement** 🔄
- Advanced threat patterns
- Multi-protocol support
- Performance optimizations

**Phase 3: Production** 📋
- Security audits
- Mainnet deployment
- Ecosystem partnerships

## Contributing

We welcome contributions to Aegilon. Please read our contributing guidelines and submit pull requests for any improvements.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Security

Aegilon has undergone extensive testing and security reviews. However, smart contracts carry inherent risks. Use at your own discretion and consider professional audits for production deployments.

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Team

Built during the Etherlink Hackathon with passion for protecting DeFi users from MEV exploitation.

## Acknowledgments

Special thanks to the Etherlink team and technology partners:
- Goldsky for real-time indexing infrastructure
- Thirdweb for smart contract development tools
- Redstone for reliable oracle services
- Sequence for seamless wallet integration

---

**Aegilon: Your shield against MEV attacks on Etherlink**

## 🪙 Tokenomics - $AEG Token

**Aegilon Token ($AEG)** is the native ERC-20 utility and governance token powering the entire MEV protection ecosystem.

### Token Distribution & Supply
- **Total Supply**: 10,000,000 AEG (fixed supply, no inflation)
- **Precision**: 18 decimals
- **Contract**: Deployed on Etherlink with full transparency

#### Distribution Breakdown:
```
📊 DISTRIBUTION OVERVIEW
├── 40% (4M AEG) - Liquidity Rewards & User Incentives
│   ├── Staking rewards for protection users
│   ├── Threat detection bounties
│   └── DeFi protocol integration rewards
├── 30% (3M AEG) - Governance & DAO Treasury
│   ├── Protocol development funding
│   ├── Community grants
│   └── Emergency response reserves
├── 20% (2M AEG) - Team & Development
│   ├── 24-month linear vesting
│   ├── Performance-based unlocks
│   └── Long-term alignment incentives
└── 10% (1M AEG) - Community & Hackathon
    ├── Hackathon airdrops
    ├── Beta tester rewards
    └── Community building initiatives
```


### Economic Model

#### **Deflationary Mechanisms**
- **Burn on Penalties**: 50% of MEV attack penalties burned
- **Feature Fees**: Premium feature access burns 0.1% of transaction
- **Governance Costs**: Proposal submission fee (1,000 AEG) burned if rejected

#### **Value Accrual**
- **Network Effects**: More protected users = higher token demand
- **Utility Growth**: Expanding use cases across Etherlink DeFi
- **Scarcity**: Fixed supply with deflationary pressure

### Getting Started with $AEG

```bash
# 1. Acquire AEG tokens (post-launch)
# Available on Etherlink DEXs: QuipuSwap, SpicySwap, etc.

# 2. Stake for protection
aegilon.stakeTokens(amount)

# 3. Activate MEV protection
aegilon.activateProtection()

# 4. Earn rewards while staying protected
# Automatic rewards for staking + bonuses for threat reports
```


## 🚀 Competitive Advantages

### **Speed Advantage**
- **Etherlink's 500ms finality** enables real-time MEV prevention
- **Sub-second threat detection** impossible on slower chains
- **Front-run the front-runners** using superior speed

### **Cost Efficiency**
- **Near-zero gas fees** enable micro-optimizations
- **Profitable protection** even for small trades
- **No transaction size minimums** unlike mainnet solutions

### **Universal Protection**
- **Works across all Etherlink protocols** without integration
- **Automatic detection** of new attack vectors
- **Future-proof architecture** adapts to new MEV techniques

### **User-Centric Design**
- **One-click activation** through familiar wallets
- **No trading workflow changes** required
- **Transparent reporting** of blocked attacks and saved funds
