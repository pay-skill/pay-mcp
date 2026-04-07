#!/usr/bin/env node
/**
 * @pay-skill/mcp — entry point
 *
 * Starts the MCP server on stdio transport. Configure in claude_desktop_config.json:
 *
 *   "mcpServers": {
 *     "pay": {
 *       "command": "npx",
 *       "args": ["@pay-skill/mcp"],
 *       "env": {
 *         "PAYSKILL_SIGNER_KEY": "0x...",
 *         "PAY_NETWORK": "mainnet"
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const NETWORK_CONFIG = {
  mainnet: {
    chainId: 8453,
    apiUrl: "https://pay-skill.com/api/v1",
    name: "Base",
  },
  testnet: {
    chainId: 84532,
    apiUrl: "https://testnet.pay-skill.com/api/v1",
    name: "Base Sepolia",
  },
} as const;

type NetworkName = keyof typeof NETWORK_CONFIG;

function resolveNetwork(): NetworkName {
  const env = process.env.PAY_NETWORK?.toLowerCase();
  if (env === "testnet") return "testnet";
  return "mainnet";
}

function resolveKey(): string {
  const key = process.env.PAYSKILL_SIGNER_KEY;
  if (!key) {
    // Phase M1 will add keychain + .enc file resolution here
    throw new Error(
      "No wallet found. Set PAYSKILL_SIGNER_KEY or run 'pay init' to create a wallet.",
    );
  }

  // Check if it looks like a raw hex private key (64 hex chars, optional 0x prefix)
  const stripped = key.startsWith("0x") ? key.slice(2) : key;
  if (/^[0-9a-fA-F]{64}$/.test(stripped)) {
    return stripped;
  }

  // Otherwise it might be a keystore password — Phase M1 will handle this
  throw new Error(
    "PAYSKILL_SIGNER_KEY does not look like a hex private key. Keystore decryption is not yet implemented.",
  );
}

async function main(): Promise<void> {
  const network = resolveNetwork();
  const config = NETWORK_CONFIG[network];
  const key = resolveKey();

  console.error(
    `pay-mcp: starting on ${config.name} (chain ${config.chainId}), api: ${config.apiUrl}`,
  );
  console.error(`pay-mcp: wallet key loaded from PAYSKILL_SIGNER_KEY env var`);
  console.error(
    `pay-mcp: key prefix: ${key.slice(0, 4)}...${key.slice(-4)}`,
  );

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server runs until stdin closes
}

main().catch((err) => {
  console.error(
    "pay-mcp: fatal error:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
