/**
 * Tab tools — open, close, charge, topup, list.
 *
 * Tabs are pre-funded metered accounts. Agent locks USDC, provider charges
 * incrementally. Charges are batched on-chain for gas efficiency.
 */

import type { PayAPI } from "../api.js";
import type { Tool } from "./index.js";
import { zodToMcpSchema } from "./schema.js";
import { TabOpenArgs, TabCloseArgs, TabChargeArgs, TabTopupArgs, TabListArgs } from "./validate.js";
import { signPermit } from "../crypto/permit.js";
import type { Hex } from "viem";
import type { Tab } from "../types.js";

export function createTabTools(api: PayAPI, privateKey: Hex): Tool[] {
  return [
    createTabOpenTool(api, privateKey),
    createTabCloseTool(api),
    createTabChargeTool(api),
    createTabTopupTool(api, privateKey),
    createTabListTool(api),
  ];
}

function createTabOpenTool(api: PayAPI, privateKey: Hex): Tool {
  return {
    definition: {
      name: "pay_tab_open",
      description:
        "Open a pre-funded metered tab with a provider. Use tabs for repeated API calls " +
        "or ongoing service access — more gas-efficient than per-call direct payments.\n\n" +
        "WHEN TO USE: Multiple calls to the same provider, sub-$1 per-call pricing, " +
        "or when pay_request auto-opens one (tab settlement mode). For one-time payments, " +
        "use pay_send instead.\n\n" +
        "SIZING: $50 recommended for cost efficiency (activation fee is 1% = $0.50). " +
        "Minimum $5.00 (activation fee = $0.10). Unused balance refunded on close.\n\n" +
        "max_charge: maximum the provider can charge per single call (contract-enforced). " +
        "Tabs auto-close after 30 days of no charges.",
      inputSchema: zodToMcpSchema(TabOpenArgs),
    },
    handler: async (args) => {
      const { provider, amount, max_charge } = args as {
        provider: string;
        amount: number;
        max_charge: number;
      };

      const contracts = await api.getContracts();
      const prepare = await api.post<{ hash: string; nonce: string; deadline: number }>(
        "/permit/prepare",
        { amount, spender: contracts.tab },
      );
      const permit = await signPermit(
        privateKey,
        prepare.hash as Hex,
        prepare.nonce,
        prepare.deadline,
      );

      const tab = await api.post<Tab>("/tabs", {
        provider,
        amount,
        max_charge_per_call: max_charge,
        permit,
      });

      const usdAmount = (amount / 1_000_000).toFixed(2);
      const activationFee = Math.max(100_000, Math.floor(amount * 0.01));
      const usdFee = (activationFee / 1_000_000).toFixed(2);
      return {
        ...tab,
        summary: `Opened tab ${tab.id} with $${usdAmount} USDC. Activation fee: $${usdFee}. ` +
          `Provider can charge up to ${max_charge} per call.`,
      };
    },
  };
}

function createTabCloseTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_tab_close",
      description:
        "Close a tab and settle funds. Either party can close unilaterally.\n\n" +
        "DISTRIBUTION: Provider receives 99% of total charged. Fee wallet gets 1%. " +
        "Agent gets all remaining (unspent) balance back. Pending charges are flushed first.",
      inputSchema: zodToMcpSchema(TabCloseArgs),
    },
    handler: async (args) => {
      const { tab_id } = args as { tab_id: string };
      const tab = await api.post<Tab>(`/tabs/${tab_id}/close`, {});

      // Distribution breakdown
      const totalCharged = Number(tab.total_charged);
      const providerGets = (totalCharged * 0.99 / 1_000_000).toFixed(2);
      const feeAmount = (totalCharged * 0.01 / 1_000_000).toFixed(2);

      return {
        ...tab,
        summary: `Closed tab ${tab_id}.`,
        distribution: {
          total_charged: `$${(totalCharged / 1_000_000).toFixed(2)}`,
          provider_receives: `$${providerGets} (99%)`,
          fee: `$${feeAmount} (1%)`,
          charges: tab.charge_count,
        },
      };
    },
  };
}

function createTabChargeTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_tab_charge",
      description:
        "Charge against an open tab. Only the provider can charge. " +
        "Amount must not exceed max_charge_per_call set at tab open.",
      inputSchema: zodToMcpSchema(TabChargeArgs),
    },
    handler: async (args) => {
      const { tab_id, amount } = args as { tab_id: string; amount: number };
      const result = await api.post<{ charge_id: string }>(`/tabs/${tab_id}/charge`, { amount });
      return result;
    },
  };
}

function createTabTopupTool(api: PayAPI, privateKey: Hex): Tool {
  return {
    definition: {
      name: "pay_tab_topup",
      description:
        "Add more USDC to an open tab. Only the agent (tab opener) can top up.\n\n" +
        "WHEN TO TOP UP: When effective_balance drops below ~20% of original amount " +
        "or below 10x the per-call charge. Top-up avoids closing and re-opening " +
        "(which would cost another activation fee).",
      inputSchema: zodToMcpSchema(TabTopupArgs),
    },
    handler: async (args) => {
      const { tab_id, amount } = args as { tab_id: string; amount: number };

      const contracts = await api.getContracts();
      const prepare = await api.post<{ hash: string; nonce: string; deadline: number }>(
        "/permit/prepare",
        { amount, spender: contracts.tab },
      );
      const permit = await signPermit(
        privateKey,
        prepare.hash as Hex,
        prepare.nonce,
        prepare.deadline,
      );

      const tab = await api.post<Tab>(`/tabs/${tab_id}/topup`, { amount, permit });
      const usdAmount = (amount / 1_000_000).toFixed(2);
      return {
        ...tab,
        summary: `Topped up tab ${tab_id} with $${usdAmount} USDC.`,
      };
    },
  };
}

function createTabListTool(api: PayAPI): Tool {
  return {
    definition: {
      name: "pay_tab_list",
      description:
        "List all tabs. Use to review tab health and optimize fund usage.\n\n" +
        "FLAGS: Idle tabs (open, no charges in 7+ days) are marked — consider closing " +
        "to free locked funds. Low-balance tabs are flagged for top-up. " +
        "Pending charges show amounts buffered but not yet settled on-chain.",
      inputSchema: zodToMcpSchema(TabListArgs),
    },
    handler: async () => {
      const tabs = await api.get<Tab[]>("/tabs");
      const now = Date.now();
      const IDLE_DAYS = 7;
      const idleMs = IDLE_DAYS * 24 * 60 * 60 * 1000;

      const flagged = tabs.map((tab) => {
        if (tab.status !== "open") return { ...tab, idle: false, low_balance: false };

        // Idle: open with zero charges and created > 7 days ago
        const age = now - new Date(tab.created_at).getTime();
        const isIdle = tab.charge_count === 0 && age > idleMs;

        // Low balance: effective balance below 10% of max_charge (less than ~10 calls)
        const effective = Number(tab.effective_balance);
        const maxCharge = Number(tab.max_charge_per_call);
        const isLow = maxCharge > 0 && effective < maxCharge * 10 && effective > 0;

        return { ...tab, idle: isIdle, low_balance: isLow };
      });

      const openTabs = flagged.filter((t) => t.status === "open");
      const idleCount = openTabs.filter((t) => t.idle).length;
      const lowCount = openTabs.filter((t) => t.low_balance).length;
      const totalLocked = openTabs.reduce(
        (sum, t) => sum + Number(t.balance_remaining),
        0,
      );

      const parts = [`${openTabs.length} open tab(s)`];
      if (totalLocked > 0) parts.push(`$${(totalLocked / 1_000_000).toFixed(2)} locked`);
      if (idleCount > 0) parts.push(`${idleCount} idle (close to free funds)`);
      if (lowCount > 0) parts.push(`${lowCount} low balance (consider top-up)`);

      return {
        tabs: flagged,
        summary: parts.join(", ") + ".",
      };
    },
  };
}
