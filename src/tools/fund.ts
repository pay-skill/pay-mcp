/**
 * pay_fund — generate a fund link for depositing USDC into the wallet.
 * pay_withdraw — generate a withdraw link for pulling USDC out.
 *
 * Both create short-lived bearer-token URLs via the server.
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { FundArgs, WithdrawArgs } from "./validate.js";
import type { FundLinkResponse, WithdrawLinkResponse } from "../types.js";

export function createFundTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_fund",
      description:
        "Generate a one-time link to deposit USDC into your wallet. " +
        "Share this link with a human operator or open it in a browser to fund " +
        "the wallet via Coinbase Onramp or direct USDC transfer. " +
        "The link expires in 1 hour.\n\n" +
        "After generating: poll pay_status every 30 seconds to detect when " +
        "funds arrive. Typical onramp takes 1-5 minutes.",
      inputSchema: zodToMcpSchema(FundArgs),
    },
    handler: async () => {
      const result = await api.post<FundLinkResponse>("/links/fund");
      return {
        url: result.url,
        expires_at: result.expires_at,
        wallet: api.getAddress(),
        tip: "Share this URL to fund the wallet. Link expires in 1 hour. " +
          "Poll pay_status to detect when funds arrive.",
      };
    },
  };
}

export function createWithdrawTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_withdraw",
      description:
        "Generate a one-time link to withdraw USDC from your wallet. " +
        "Share this link with a human operator or open it in a browser. " +
        "The link expires in 1 hour.",
      inputSchema: zodToMcpSchema(WithdrawArgs),
    },
    handler: async () => {
      const result = await api.post<WithdrawLinkResponse>("/links/withdraw");
      return {
        url: result.url,
        expires_at: result.expires_at,
        wallet: api.getAddress(),
      };
    },
  };
}
