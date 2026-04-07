# @pay-skill/mcp

MCP server for [Pay](https://pay-skill.com) — USDC payments for AI agents on Base.

Gives any MCP-compatible client (Claude Desktop, Cursor, VS Code, custom frameworks) the full power of Pay: direct payments, tabs, x402 paywalls, service discovery, and wallet management. No CLI binary needed.

## Setup

### Prerequisites

Run `pay init` to create a wallet. The MCP server shares the same wallet and key storage as the CLI — no separate key management needed.

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pay": {
      "command": "npx",
      "args": ["-y", "@pay-skill/mcp"]
    }
  }
}
```

If your wallet uses an encrypted keystore (`~/.pay/keys/default.enc`), set the password:

```json
{
  "mcpServers": {
    "pay": {
      "command": "npx",
      "args": ["-y", "@pay-skill/mcp"],
      "env": {
        "PAYSKILL_SIGNER_KEY": "your-keystore-password"
      }
    }
  }
}
```

### VS Code / Cursor

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "pay": {
      "command": "npx",
      "args": ["-y", "@pay-skill/mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add pay -- npx -y @pay-skill/mcp
```

## Configuration

| Env Var | Required | Default | Description |
|---------|----------|---------|-------------|
| `PAYSKILL_SIGNER_KEY` | Depends | — | Keystore password (if `.enc` exists) or raw hex key (dev/testing only). Not needed if using OS keychain. |
| `PAY_NETWORK` | No | `mainnet` | `mainnet` (Base) or `testnet` (Base Sepolia) |

### Key Resolution (checked in order)

The MCP server resolves the wallet key using the same chain as the `pay` CLI:

1. **OS keychain** (recommended) — If `~/.pay/keys/default.meta` exists with `storage: "keychain"`, the key is loaded from the OS credential store (Windows Hello, macOS Keychain, Linux Secret Service) via `keytar`. No env var needed.
2. **Encrypted keystore** — If `~/.pay/keys/default.enc` exists, `PAYSKILL_SIGNER_KEY` is used as the decryption password (scrypt + AES-256-GCM).
3. **Raw hex key** (dev only) — If `PAYSKILL_SIGNER_KEY` is a 64-char hex string, it's used directly. Only for testing.

If you've already run `pay init`, the MCP server picks up the same wallet automatically.

## Diagnostic Check

Verify everything is configured correctly:

```bash
npx @pay-skill/mcp --check
```

Output:
```
pay-mcp diagnostic check
  network: Base (chain 8453)
  api:     https://pay-skill.com/api/v1
  wallet:  0x1234...
  key:     keychain
  server:  OK (router: 0xABCD...)
  auth:    OK (balance: $50.00)

All checks passed. MCP server is ready.
```

## Tools (15)

### Payments
| Tool | Description |
|------|-------------|
| `pay_send` | Direct USDC payment ($1 min). Confirmation thresholds: <$10 auto, $10-100 plan, >$100 explicit. |
| `pay_request` | HTTP request with x402 auto-payment. Handles 402 detection, direct/tab settlement, price skepticism. |

### Tabs (metered accounts)
| Tool | Description |
|------|-------------|
| `pay_tab_open` | Open pre-funded tab ($5 min, $50 recommended). Provider charges per-call. |
| `pay_tab_close` | Close tab. Returns distribution breakdown (provider 99%, fee 1%, agent remainder). |
| `pay_tab_charge` | Charge against open tab (provider only). |
| `pay_tab_topup` | Add funds to open tab (agent only). |
| `pay_tab_list` | List tabs with idle/low-balance flags. |

### Wallet
| Tool | Description |
|------|-------------|
| `pay_status` | Balance, locked/available funds, actionable suggestions. |
| `pay_fund` | Generate 1-hour funding link (Coinbase Onramp or direct USDC). |
| `pay_withdraw` | Generate 1-hour withdrawal link. |
| `pay_mint` | Mint testnet USDC (Base Sepolia only). |

### Discovery & Webhooks
| Tool | Description |
|------|-------------|
| `pay_discover` | Search paid API services by keyword/category. |
| `pay_webhook_register` | Register webhook for payment events (HMAC-signed). |
| `pay_webhook_list` | List registered webhooks. |
| `pay_webhook_delete` | Delete a webhook. |

## Resources (5)

| URI | Description |
|-----|-------------|
| `pay://wallet/status` | Balance, tabs, locked/available |
| `pay://wallet/tabs` | All open tabs |
| `pay://tab/{tab_id}` | Single tab detail |
| `pay://wallet/address` | Wallet address |
| `pay://network` | Network config + contract addresses |

## Prompts (3)

| Prompt | Description |
|--------|-------------|
| `pay-for-service` | Guided: discover service, evaluate pricing, make request |
| `review-tabs` | Review tabs, flag idle, suggest close/topup |
| `fund-wallet` | Generate fund link, explain deposit process |

## Development

```bash
git clone https://github.com/remit-md/pay-mcp.git
cd pay-mcp
npm install
npm run build
npm test                    # unit tests (mocked)
npm run test:acceptance     # testnet (requires PAYSKILL_SIGNER_KEY)
```

## License

MIT
