import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";
dotenv.config();
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: "0.8.26" },
      { version: "0.8.28" },
    ],
  },
  networks: {
    sepolia: {
      type: "http",
      url: `${process.env.SEPOLIA_RPC_URL}`,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
};
export default config;
