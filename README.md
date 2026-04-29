# GlycoCart

> **Order food that works for your body.**
> A glucose-aware ordering agent for Indians managing PCOS, prediabetes, and metabolic health — built on Swiggy's MCP.

[![Demo](https://img.shields.io/badge/demo-live-0E7E5C)](https://glycocart.vercel.app)
[![MCP](https://img.shields.io/badge/swiggy-mcp-0F1614)](https://mcp.swiggy.com/builders)

---

## What it does

Most CGM and PCOS apps tell you what *not* to eat. None help you actually *order* it.

GlycoCart closes the loop:

1. **Reads your metabolic profile** — CGM data (Ultrahuman, Abbott Libre) or PCOS condition profile.
2. **Ranks every Swiggy dish** by predicted personal glycemic impact, not generic GI tables.
3. **Places a COD order** through Swiggy MCP.
4. **Auto-logs the meal** to Apple Health / Ultrahuman, killing the manual food-log friction that drives 60-day churn in CGM apps.

This wasn't buildable 6 months ago. It is now, on Swiggy MCP.

## Why it matters

| Audience | Pain | TAM |
|---|---|---|
| PCOS women in metros | Pay ₹1,800/mo to dietitians, manually translate plans to Swiggy | ~50M Indian women |
| CGM users (Ultrahuman / Levels) | Spend ₹4,200/2-weeks on sensors, get advice without execution | ~150K active, ~80% YoY growth |
| Prediabetic / T2D | Managing 100M+ population with fragmented tools | 100M+ Indians |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Next.js 15 App                         │
│  ┌────────────┐    ┌─────────────────┐    ┌─────────────┐   │
│  │  Landing   │───▶│   Chat View      │───▶│ Order Flow  │   │
│  │  (persona) │    │  (Vercel AI SDK) │    │  (COD-only) │   │
│  └────────────┘    └────────┬────────┘    └─────────────┘   │
│                             │                                │
│                    ┌────────▼─────────┐                      │
│                    │  /api/chat       │                      │
│                    │  streamText +    │                      │
│                    │  tool calling    │                      │
│                    └────────┬─────────┘                      │
└─────────────────────────────┼───────────────────────────────┘
                              │
        ┌─────────────────────┼──────────────────┐
        ▼                     ▼                  ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│  OpenRouter  │    │  Swiggy MCP      │    │  Glycemic    │
│  (Claude     │    │  (mock → real    │    │  Predictor   │
│   Sonnet)    │    │   on approval)   │    │  (per-user)  │
└──────────────┘    └──────────────────┘    └──────────────┘
```

### Tool layer mirrors Swiggy MCP

The 4 tools the LLM can call use schemas matching `swiggy-food` MCP server signatures from the public [manifest](https://github.com/Swiggy/swiggy-mcp-server-manifest):

| Tool | Swiggy MCP equivalent | Status |
|---|---|---|
| `search_restaurants` | `swiggy-food.search` | mock → live on approval |
| `get_restaurant_menu` | `swiggy-food.menu` | mock → live on approval |
| `rank_dishes_for_user` | (composed locally; combines menu + glycemic predictor) | local |
| `place_order` | `swiggy-food.order.place` (COD) | mock → live on approval |

Swap path: replace `executeMockTool` with the official MCP client (`@modelcontextprotocol/sdk`) once OAuth credentials are issued. Schemas remain identical — zero LLM-side changes.

## Tech stack

- **Frontend**: Next.js 15 (App Router), React 18, TypeScript strict, Tailwind 3.4
- **Agent**: Vercel AI SDK v4 (`streamText` with multi-step tool calling)
- **Model**: Claude 3.5 Sonnet via OpenRouter (swap to Bedrock once on Swiggy infra — same provider stack as Swiggy's own MCP per their AWS announcement)
- **Charts**: Recharts (lightweight, no D3 baggage)
- **Deploy**: Vercel (preview URL on every push)
- **Production-side (planned)**: AWS Lambda for prediction service, Postgres with RLS for per-user data isolation, S3 for consent ledger audit logs

## Run locally (Mac)

```bash
# 1. Install deps (uses npm; pnpm or bun also work)
npm install

# 2. Add your OpenRouter key
cp .env.local.example .env.local
# edit .env.local and paste your sk-or-v1-... key from openrouter.ai/keys

# 3. Run
npm run dev

# Open http://localhost:3000
```

You'll get $1 free credit on OpenRouter to test (~50 chat exchanges with Sonnet).

## Demo flow (90 seconds)

1. Land on `/` → click **Try as Priya (PCOS)** or **Arjun (CGM)**
2. Click a suggested prompt: *"Order me lunch — keep predicted peak under 140 mg/dL"*
3. Watch the agent stream through tool calls — `search_restaurants` → `rank_dishes_for_user`
4. See 3 ranked dish cards, each with predicted 3-hr glucose curve and personal match score
5. Confirm order → see COD confirmation + auto-log to Apple Health (mocked)

## Production roadmap (post-approval)

| Phase | Weeks | What ships |
|---|---|---|
| **0 — Approval** | now | This demo + form submission |
| **1 — Live MCP** | 2 | Swap mock to real `mcp.swiggy.com/food` with OAuth |
| **2 — CGM ingestion** | 4 | Ultrahuman API + Apple Health + Google Fit |
| **3 — Personal model** | 8 | Per-user gradient boosted predictor (vs current closed-form) |
| **4 — DPDP compliance** | 10 | Consent ledger, encryption-at-rest with per-user keys, audit trails |
| **5 — Hospital pilot** | 12 | White-label for Apollo / Manipal diabetes-reversal programs |

## OAuth & redirect URIs

For Swiggy MCP review:

- **Dev**: `http://localhost:3000/api/auth/swiggy/callback`
- **Prod**: `https://glycocart.vercel.app/api/auth/swiggy/callback` (will request whitelisting)
- **Claude Desktop testing**: `https://claude.ai/api/mcp/auth_callback` (already on Swiggy's whitelist)

## Compliance

- COD-only payments (matches current Swiggy MCP constraint)
- DPDP Act 2023: explicit health-data consent, encryption at rest, India data residency
- "Lifestyle optimization" framing — not medical advice (mirrors Ultrahuman's legal posture)
- No raw glucose readings sent to LLM — only derived match scores

## Status

🟡 **Pre-approval.** Demo uses mock MCP. Ready to swap to live endpoints on access grant.

---

Built by Deepan Sadhukhan · [LinkedIn](#) · [github.com/yourusername/glycocart](#)
