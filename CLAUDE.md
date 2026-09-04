# GlycoCart

A glucose-aware food-ordering agent on Swiggy's MCP. Next.js 15 App Router,
TypeScript strict, Tailwind, Neon Postgres.

## Non-negotiable

**GlycoCart never places an order or books a table.** Swiggy food orders cannot
be cancelled through the API (their docs say to phone 080-67466729), and the
live Dineout server exposes no `cancel_booking` despite the docs listing one.
`place_food_order`, `checkout`, `confirm_order`, `book_table`, `create_cart` and
the payment tools are never registered as agent tools. Enforcement is the
absence of the tool, not prompt wording. `npm run test:cart-safety` asserts it.

**Never invent a number.** Swiggy publishes no per-dish nutrition. A dish the
estimator cannot recognise is shown as unscored, never guessed. Every glucose
figure is labelled an estimate.

## Before pushing

`npm test && npm run build`. Nine suites; each was written against a bug that
actually shipped, and each was verified to fail without its fix.

## Design rules

The house style is editorial and quiet. It is easy to drift from that into the
generated-marketing-page look, so these are explicit. Written after an audit
against okaashish's AI-slop list found ~15 hits in our own UI.

**Never do these:**

- A tiny ALL-CAPS mono label sitting above a heading. One eyebrow per screen at
  most, and never one that repeats the heading below it ("settings" over
  "Settings"). `.mono` is for data labels inside a component, not page furniture.
- One word of a headline in italic serif for emphasis.
- A numbered three-step explainer (01 / 02 / 03).
- Three feature cards in a row under a hero. Three of anything, when the real
  number is two or five.
- An icon in a rounded square or circle at the top of every card.
- A coloured dot next to the words "Live" or "AI powered".
- A sparkle, magic wand, brain or rocket icon to mean "intelligent".
- An icon on something that reads fine without one.
- Staggered fade-up animations on every section as you scroll.
- Em dashes as default punctuation. A full stop or a comma is almost always
  right. Audit the count before shipping copy.
- Rhetorical question then answer. "Here's the thing." "The best part?"
  "It's not just X, it's Y." "Fast. Simple. Powerful."
- Generic CTAs: "Get started", "Start building today".
- Any statistic, testimonial, logo strip or screenshot that is not real.

**Do these instead:**

- Say the specific, checkable thing only this product could say. The strongest
  copy we have is "GlycoCart will not place your order, because Swiggy orders
  cannot be cancelled" — no generated page would write that.
- Prose over cards when the content is prose. A card is for a repeated item in
  a list, not for making three paragraphs look designed.
- Vary section length and rhythm deliberately. Identical vertical spacing on
  every section is the tell.
- Consistency INSIDE the app (matching cards, one corner radius per role, one
  card component) is good app design, not slop. The list is about marketing
  surfaces. Do not randomise the product UI to look artisanal.

## UI structure

Standard mobile app patterns, grounded in Apple HIG:

- Tab bar is navigation only, never actions. Five tabs maximum at 375px.
- Settings live on the Settings screen. Never a gear that expands a config
  panel over a task surface.
- One app bar per screen, one action per side, 44x44 touch targets.
- Colour resolves through CSS variables in `globals.css` so the dark theme is
  one block, not a `dark:` prefix per element. `npm run test:contrast` gates
  both themes at WCAG AA.
