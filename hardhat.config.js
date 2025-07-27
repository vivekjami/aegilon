require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const GOLDSKY_API_KEY = process.env.GOLDSKY_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

// Generate a dummy private key for development if none provided
const DUMMY_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    // Etherlink Ghostnet (Testnet)
    etherlinkGhostnet: {
      url: process.env.ETHERLINK_GHOSTNET_RPC || "https://node.ghostnet.etherlink.com",
      chainId: 128123,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [DUMMY_PRIVATE_KEY],
      gas: 2100000,
      gasPrice: 8000000000,
      timeout: 60000,
    },
    // Etherlink Mainnet (Future)
    etherlinkMainnet: {
      url: process.env.ETHERLINK_MAINNET_RPC || "https://node.mainnet.etherlink.com",
      chainId: 42793,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [DUMMY_PRIVATE_KEY],
      gas: 2100000,
      gasPrice: 8000000000,
      timeout: 60000,
    },
    // Local development
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 12000000,
      allowUnlimitedContractSize: true,
      timeout: 1800000,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      etherlink: ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: "etherlink",
        chainId: 42793,
        urls: {
          apiURL: "https://explorer.etherlink.com/api",
          browserURL: "https://explorer.etherlink.com",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};
