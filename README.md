# GlycoCart

A food-ordering assistant for people managing PCOS, prediabetes or glucose on a CGM, built on Swiggy's MCP servers.

Live: https://glycocart.vercel.app

## What it does

You sign in with your Swiggy account, answer a short questionnaire, and chat. The agent searches real Swiggy restaurants and dishes for your saved delivery address, estimates how each dish is likely to affect your glucose, and builds a cart with the better options.

- **Food delivery** (`mcp.swiggy.com/food`): dish and restaurant search, full menus, cart, coupons, order history and tracking.
- **Groceries** (`mcp.swiggy.com/im`, Instamart): product search, your usual items, lower-GI swaps.
- **Eating out** (`mcp.swiggy.com/dineout`): restaurants and table availability. Dineout publishes no menus, so GlycoCart gives an ordering brief from the cuisines, never a dish list.
- **Daily carb budget** from what you have already ordered today, and a retrospective glucose estimate on past orders.

## What it will not do

**GlycoCart will not place your order, because Swiggy orders cannot be cancelled through the API.** Swiggy's docs say to phone support (080-67466729) to cancel. The live Dineout server has no `cancel_booking` either, so it will not book a table. The agent builds the cart and you check out in the Swiggy app.

This is enforced by the absence of the tools, not by prompt wording: `place_food_order`, `checkout`, `confirm_order`, `book_table`, `create_cart` and the payment tools are never registered. `npm run test:cart-safety` asserts it.

**It will not invent a number.** Swiggy publishes no per-dish nutrition. GlycoCart matches a dish name against a reference table of common Indian dishes (IFCT-2017 and USDA derived, `src/lib/catalog.ts`). A dish it cannot recognise is shown as unscored. A category match is labelled a rough estimate. Every glucose figure is an estimate from a closed-form model (`src/lib/glycemic.ts`) driven by your questionnaire answers, not a clinical measurement and not medical advice.

## Stack

- Next.js 15 App Router, React 18, TypeScript strict, Tailwind 3.4
- Vercel AI SDK 4 (`streamText` with multi-step tool calling)
- `@modelcontextprotocol/client` with OAuth to Swiggy's MCP servers
- Neon Postgres for profiles, chat history and the daily log
- LLM: NVIDIA-hosted models by default on the server key (free). Users can switch to OpenRouter in Settings with their own key; the server never spends an OpenRouter key.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # fill in the values
npm run dev                        # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `NVIDIA_API_KEY` | Server-side LLM key (`nvapi-...`). Free tier at build.nvidia.com |
| `NVIDIA_MODEL`, `OPENROUTER_MODEL` | Optional model overrides |
| `NEXT_PUBLIC_APP_URL` | Public origin. Must match the redirect URI registered with Swiggy |
| `SWIGGY_TOKEN_SECRET` | 32-byte hex. Encrypts session cookies and salts the pseudonymous user id |
| `DATABASE_URL` | Neon Postgres connection string. Tables are created on first use |

Swiggy OAuth redirect URIs:

- Dev: `http://localhost:3000/api/auth/swiggy/callback`
- Prod: `https://glycocart.deepansadhukhan.com/api/auth/swiggy/callback`

## Tests

```bash
npm test && npm run build
```

Thirteen suites, each written against a bug that shipped. Among them: the forbidden-tools check (which also covers any route that names a tool at runtime), the single-restaurant cart guard, WCAG AA contrast in both themes, the rule that the server key is never spent on a paid provider, and the avoid-list and diet matching.

## Privacy

- An API key you enter is saved in your browser. The server forwards it to the provider you chose with each request and never stores it.
- Your profile is keyed by a pseudonymous id derived from your Swiggy account, not your name or phone number.
- The LLM sees your questionnaire-derived profile and Swiggy results. There is no CGM integration today.
