# @pay-skill/mcp

MCP server for [Pay](https://pay-skill.com) — USDC payments for AI agents on Base.

Gives any MCP-compatible client (Claude Desktop, Cursor, VS Code, custom frameworks) the full power of Pay: direct payments, tabs, x402 paywalls, service discovery, and wallet management.

## Quick Start

```json
{
  "mcpServers": {
    "pay": {
      "command": "npx",
      "args": ["-y", "@pay-skill/mcp"],
      "env": {
        "PAYSKILL_SIGNER_KEY": "0x...",
        "PAY_NETWORK": "mainnet"
      }
    }
  }
}
```

## License

MIT
