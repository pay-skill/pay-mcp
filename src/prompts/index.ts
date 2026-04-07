/**
 * MCP Prompts — guided multi-step workflows for common payment tasks.
 *
 * 3 prompts: pay-for-service, review-tabs, fund-wallet.
 */

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}

const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    name: "pay-for-service",
    description:
      "Guided workflow: discover a paid API service, evaluate pricing, make a request, and report results",
    arguments: [
      {
        name: "service",
        description: "What kind of service you need (e.g. 'weather API', 'image generation')",
        required: true,
      },
    ],
  },
  {
    name: "review-tabs",
    description:
      "Review all open tabs, flag idle ones, suggest closures or top-ups to optimize fund usage",
  },
  {
    name: "fund-wallet",
    description:
      "Generate a fund link and walk through the process of depositing USDC into your wallet",
  },
];

export function listPrompts(): PromptDefinition[] {
  return PROMPT_DEFINITIONS;
}

export function getPrompt(
  name: string,
  args: Record<string, string>,
): PromptMessage[] {
  const def = PROMPT_DEFINITIONS.find((p) => p.name === name);
  if (!def) throw new Error(`Unknown prompt: ${name}`);

  if (def.arguments) {
    for (const arg of def.arguments) {
      if (arg.required && !args[arg.name]) {
        throw new Error(`Missing required argument: ${arg.name}`);
      }
    }
  }

  switch (name) {
    case "pay-for-service":
      return buildPayForServicePrompt(args["service"] ?? "");

    case "review-tabs":
      return buildReviewTabsPrompt();

    case "fund-wallet":
      return buildFundWalletPrompt();

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

function buildPayForServicePrompt(service: string): PromptMessage[] {
  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `I need to use a paid ${service}. Help me find one, evaluate the pricing, and make a request.`,
      },
    },
    {
      role: "assistant",
      content: {
        type: "text",
        text: [
          `I'll help you find and use a ${service}. Here's the plan:\n`,
          `**Step 1: Check your balance**`,
          `First, I'll use \`pay_status\` to confirm you have funds available.\n`,
          `**Step 2: Discover services**`,
          `I'll search for "${service}" using \`pay_discover\` to find available providers, their pricing, and settlement modes.\n`,
          `**Step 3: Evaluate pricing**`,
          `For each service found, I'll assess:`,
          `- Price per request (typical API calls cost $0.001-$1.00)`,
          `- Settlement mode (direct = per-request, tab = metered billing)`,
          `- Whether the price is reasonable for the service type\n`,
          `**Step 4: Make the request**`,
          `Once you pick a service, I'll use \`pay_request\` with its URL. Payment is handled automatically:`,
          `- Direct settlement: one-time payment per request`,
          `- Tab settlement: opens a pre-funded tab, charges per use (more efficient for repeated calls)\n`,
          `**Step 5: Report results**`,
          `I'll show you the response data and a summary of what was paid.\n`,
          `Let me start by checking your balance.`,
        ].join("\n"),
      },
    },
  ];
}

function buildReviewTabsPrompt(): PromptMessage[] {
  return [
    {
      role: "user",
      content: {
        type: "text",
        text: "Review my open tabs and tell me if any should be closed or topped up.",
      },
    },
    {
      role: "assistant",
      content: {
        type: "text",
        text: [
          "I'll review your open tabs and assess their health. Here's what I'll check:\n",
          "**For each open tab:**",
          "- **Idle tabs**: No charges in the last 7+ days? Suggest closing to free locked funds.",
          "- **Low balance**: Effective balance (after pending charges) below 10 charges worth? Suggest top-up.",
          "- **Pending charges**: Large pending settlement? Note when the next batch settles.",
          "- **Auto-close date**: How close to the 30-day auto-close deadline?\n",
          "**Overall assessment:**",
          "- Total USDC locked across all tabs",
          "- Available balance vs locked ratio",
          "- Recommendations to optimize fund usage\n",
          "Let me pull your tab list now with `pay_tab_list`.",
        ].join("\n"),
      },
    },
  ];
}

function buildFundWalletPrompt(): PromptMessage[] {
  return [
    {
      role: "user",
      content: {
        type: "text",
        text: "I need to add funds to my wallet. Help me through the process.",
      },
    },
    {
      role: "assistant",
      content: {
        type: "text",
        text: [
          "I'll help you fund your wallet. Here's how it works:\n",
          "**Step 1: Generate a fund link**",
          "I'll use `pay_fund` to create a one-time URL. This link is valid for 1 hour.\n",
          "**Step 2: Open the link**",
          "Open the URL in a browser. You'll see options to:",
          "- Buy USDC with a credit card via Coinbase Onramp",
          "- Send USDC directly from another wallet on Base\n",
          "**Step 3: Wait for confirmation**",
          "After funding, I'll poll `pay_status` to detect when the deposit arrives.",
          "- Coinbase Onramp: typically 1-5 minutes",
          "- Direct USDC transfer: typically under 30 seconds\n",
          "**Important notes:**",
          "- The fund link is single-use and expires in 1 hour",
          "- Funds are USDC on Base (chain ID 8453)",
          "- No minimum deposit amount\n",
          "Let me generate the fund link now.",
        ].join("\n"),
      },
    },
  ];
}
