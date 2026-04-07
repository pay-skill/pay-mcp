/**
 * pay_status — wallet balance, open tabs, locked/available USDC.
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { StatusArgs } from "./validate.js";
import type { StatusResponse } from "../types.js";

export function createStatusTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_status",
      description:
        "Check wallet balance and status. Shows USDC balance, open tab count, " +
        "locked vs available funds.\n\n" +
        "WHEN TO USE:\n" +
        "- Before any payment to verify sufficient funds\n" +
        "- After funding to confirm deposit arrived\n" +
        "- When deciding whether to close idle tabs (locked funds reduce available balance)\n\n" +
        "RESPONSE INCLUDES: balance, locked amount, available amount, open tab count, " +
        "and a suggestion field with actionable advice (low balance, idle tabs, etc.).",
      inputSchema: zodToMcpSchema(StatusArgs),
    },
    handler: async (args) => {
      const wallet = (args as { wallet?: string }).wallet;
      const path = wallet ? `/status/${wallet}` : "/status";
      const status = await api.get<StatusResponse>(path);
      return {
        ...status,
        suggestion: buildSuggestion(status),
      };
    },
  };
}

function buildSuggestion(s: StatusResponse): string | null {
  const available = Number(s.available_usdc);
  const locked = Number(s.locked_usdc);
  const balance = Number(s.balance_usdc);

  // Critical: no funds at all
  if (balance === 0) {
    return "Wallet is empty. Use pay_fund to generate a funding link, then deposit USDC.";
  }

  // Low available but funds locked in tabs
  if (locked > 0 && available < 1_000_000) {
    return `Low available balance ($${(available / 1_000_000).toFixed(2)}). ` +
      `$${(locked / 1_000_000).toFixed(2)} is locked in ${s.open_tabs} open tab(s). ` +
      "Use pay_tab_list to check for idle tabs you can close to free funds.";
  }

  // Low balance, nothing locked
  if (available < 1_000_000) {
    return "Balance below $1.00 — insufficient for direct payments ($1 minimum). " +
      "Use pay_fund to generate a funding link.";
  }

  // Tabs open but enough funds — gentle reminder
  if (s.open_tabs > 3) {
    return `${s.open_tabs} tabs open. Use pay_tab_list to review — idle tabs lock funds unnecessarily.`;
  }

  return null;
}
