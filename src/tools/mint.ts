/**
 * pay_mint — mint testnet USDC for development and testing.
 *
 * Testnet-only. The server rejects mint requests on mainnet.
 * This tool adds an additional client-side guard.
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { MintArgs } from "./validate.js";

export function createMintTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_mint",
      description:
        "Mint testnet USDC (Base Sepolia only). Free test tokens with no real value.\n\n" +
        "WHEN TO USE: Testing payments on testnet. Amount is in whole dollars " +
        "(e.g. 100 = $100.00 USDC). Will fail on mainnet — use pay_fund for real USDC.",
      inputSchema: zodToMcpSchema(MintArgs),
    },
    handler: async (args) => {
      const { amount } = args as { amount: number };

      // Client-side testnet guard
      if (api.getChainId() !== 84532) {
        throw new Error(
          "pay_mint is only available on testnet (Base Sepolia). " +
            "Set PAY_NETWORK=testnet to use this tool.",
        );
      }

      const result = await api.post<{ tx_hash: string }>("/mint", {
        amount: amount * 1_000_000, // dollars to micro-USDC
        to: api.getAddress(),
      });

      return {
        tx_hash: result.tx_hash,
        amount_usdc: amount,
        wallet: api.getAddress(),
        network: "Base Sepolia (testnet)",
      };
    },
  };
}
