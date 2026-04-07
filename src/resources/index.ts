/**
 * MCP Resources — read-only data endpoints for the Pay wallet.
 *
 * Resources let MCP clients read wallet state without calling tools.
 * 5 resources: status, tabs, tab/{id}, address, network.
 */

import type { PayAPI } from "../api.js";
import type { StatusResponse, Tab } from "../types.js";

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceTemplateDefinition {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
}

const RESOURCES: ResourceDefinition[] = [
  {
    uri: "pay://wallet/status",
    name: "Wallet Status",
    description: "USDC balance, open tab count, locked and available funds",
    mimeType: "application/json",
  },
  {
    uri: "pay://wallet/tabs",
    name: "Open Tabs",
    description: "All open tabs with pending charge info",
    mimeType: "application/json",
  },
  {
    uri: "pay://wallet/address",
    name: "Wallet Address",
    description: "The wallet's Ethereum address",
    mimeType: "application/json",
  },
  {
    uri: "pay://network",
    name: "Network Config",
    description: "Current network configuration (chain ID, API URL, contract addresses)",
    mimeType: "application/json",
  },
];

const RESOURCE_TEMPLATES: ResourceTemplateDefinition[] = [
  {
    uriTemplate: "pay://tab/{tab_id}",
    name: "Tab Detail",
    description: "Detailed information about a specific tab by ID",
    mimeType: "application/json",
  },
];

export function listResources(): ResourceDefinition[] {
  return RESOURCES;
}

export function listResourceTemplates(): ResourceTemplateDefinition[] {
  return RESOURCE_TEMPLATES;
}

type ParsedUri =
  | { type: "status" }
  | { type: "tabs" }
  | { type: "address" }
  | { type: "network" }
  | { type: "tab"; id: string };

function parseUri(uri: string): ParsedUri | null {
  if (uri === "pay://wallet/status") return { type: "status" };
  if (uri === "pay://wallet/tabs") return { type: "tabs" };
  if (uri === "pay://wallet/address") return { type: "address" };
  if (uri === "pay://network") return { type: "network" };

  const tabMatch = /^pay:\/\/tab\/([^/]+)$/.exec(uri);
  if (tabMatch) return { type: "tab", id: tabMatch[1] as string };

  return null;
}

export async function readResource(
  uri: string,
  api: PayAPI,
): Promise<{ mimeType: string; text: string }> {
  const parsed = parseUri(uri);
  if (!parsed) throw new Error(`Unknown resource URI: ${uri}`);

  let data: unknown;

  switch (parsed.type) {
    case "status": {
      data = await api.get<StatusResponse>("/status");
      break;
    }
    case "tabs": {
      data = await api.get<Tab[]>("/tabs");
      break;
    }
    case "address": {
      data = { address: api.getAddress() };
      break;
    }
    case "network": {
      const contracts = await api.getContracts();
      data = {
        chain_id: api.getChainId(),
        api_url: api.getApiUrl(),
        network: api.getChainId() === 8453 ? "mainnet" : "testnet",
        contracts,
      };
      break;
    }
    case "tab": {
      data = await api.get<Tab>(`/tabs/${parsed.id}`);
      break;
    }
  }

  return { mimeType: "application/json", text: JSON.stringify(data) };
}
