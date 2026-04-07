/**
 * Tool registry — builds all tools, dispatches callTool.
 */

import type { PayAPI } from "../api.js";
import { PayAPIError } from "../api.js";
import type { Hex } from "viem";
import type { ToolInputSchema } from "./schema.js";
import { createStatusTool } from "./status.js";
import { createSendTool } from "./send.js";
import { createTabTools } from "./tabs.js";
import { createRequestTool } from "./request.js";
import { createDiscoverTool } from "./discover.js";
import { createFundTool, createWithdrawTool } from "./fund.js";
import { createWebhookTools } from "./webhooks.js";
import { createMintTool } from "./mint.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface Tool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

/**
 * Build all tools for the server. Returns the tool list and a dispatch map.
 */
export function buildTools(api: PayAPI, privateKey: Hex): Tool[] {
  return [
    createStatusTool(api),
    createSendTool(api, privateKey),
    ...createTabTools(api, privateKey),
    createRequestTool(api, privateKey),
    createDiscoverTool(api),
    createFundTool(api),
    createWithdrawTool(api),
    ...createWebhookTools(api),
    createMintTool(api),
  ];
}

export function buildToolRegistry(tools: Tool[]): Map<string, Tool> {
  return new Map(tools.map((t) => [t.definition.name, t]));
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  registry: Map<string, Tool>,
): Promise<unknown> {
  const tool = registry.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  try {
    return await tool.handler(args);
  } catch (err) {
    if (err instanceof PayAPIError) {
      throw new Error(enrichError(err));
    }
    throw err;
  }
}

/**
 * Enrich API errors with recovery suggestions from SKILL.md errors.md.
 * Core rule: never blind-retry payments. Read the error first.
 */
function enrichError(err: PayAPIError): string {
  const base = `${err.message} — ${err.body}`;
  const recovery = ERROR_RECOVERY[err.status];
  return recovery ? `${base}\n\nRecovery: ${recovery}` : base;
}

const ERROR_RECOVERY: Record<number, string> = {
  400: "Bad request. Check parameter values (address format, amounts, tab IDs).",
  401: "Authentication failed. Wallet key may be invalid or auth headers expired. Try again.",
  402: "Insufficient USDC balance. Use pay_status to check, then pay_fund to add funds.",
  403: "Not authorized for this action (e.g., charging a tab you don't own, closing another's tab).",
  404: "Resource not found. The tab or webhook ID may be wrong or already deleted.",
  409: "Conflict — likely a nonce replay. Do NOT retry the same payment. Check pay_status for the transaction.",
  429: "Rate limited. Wait a moment before retrying. Limits: 10 tab opens/min, 120 direct/min per wallet.",
  500: "Server error. Try again in a few seconds. If persistent, the service may be down.",
};
