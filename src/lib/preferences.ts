/**
 * The onboarding answers about diet and foods to avoid, applied to real dishes.
 *
 * Until this existed the avoid list fed nothing: "Deep fried" or "Maida" was
 * saved and shown on Profile, then ignored by every search. And a vegetarian's
 * non-veg dishes were only mentioned to the model while still being drawn as
 * cards with an add-to-cart button.
 *
 * Matching is by dish name, the only thing Swiggy gives us. It is a flag for
 * the person to see, not a claim about the recipe, so it errs towards obvious
 * names and never hides a dish for an avoid-list match, only for diet.
 */

/** Keyword patterns for the avoid chips onboarding offers. Custom entries match as plain text. */
const AVOID_PATTERNS: Record<string, RegExp> = {
  "refined sugar":
    /\b(dessert|sweet|halwa|gulab|jalebi|cake|pastry|brownie|ice ?cream|kheer|rasgulla|rasmalai|ladoo|laddu|barfi|mithai|donut|doughnut|waffle|pancake|kulfi|payasam)\b/i,
  "white rice": /\b(rice|biryani|biriyani|pulao|pulav|khichdi|curd rice|lemon rice|jeera rice)\b/i,
  maida: /\b(naan|kulcha|bhatura|bhature|pizza|pasta|momo|momos|burger|maida|white bread|croissant|puff|samosa|kachori|noodles?|chowmein|lasagna)\b/i,
  "deep fried":
    /\b(fried|fries|pakora|pakoda|bhaji|bhajji|samosa|vada|wada|puri|poori|bhatura|bhature|tempura|nuggets?|crispy|kachori|cutlet|65|chips)\b/i,
  "sugary drinks": /\b(cola|coke|pepsi|soda|soft drink|shake|milkshake|lemonade|iced tea|cold drink|mojito|frappe|smoothie)\b/i,
  "excess dairy": /\b(paneer|cheese|cheesy|cream|creamy|butter|malai|makhani|kheer|lassi|milkshake|ghee)\b/i
};

// "Brown rice" and "brown bread" shouldn't read as white rice or maida, and a
// stir-fry isn't deep fried.
const NOT_WHITE = /\bbrown (rice|bread)\b|\bmillet\b|\bquinoa\b/i;
const NOT_DEEP = /\bstir[- ]?fr(y|ied)\b|\bpan[- ]?fried\b|\bair[- ]?fried\b/i;

export function avoidMatches(dishName: string, blocklist: string[]): string[] {
  const name = dishName ?? "";
  const hits: string[] = [];
  for (const entry of blocklist ?? []) {
    const key = entry.trim().toLowerCase();
    if (!key) continue;
    const pattern = AVOID_PATTERNS[key];
    const hit = pattern
      ? pattern.test(name) &&
        !((key === "white rice" || key === "maida") && NOT_WHITE.test(name)) &&
        !(key === "deep fried" && NOT_DEEP.test(name))
      : name.toLowerCase().includes(key);
    if (hit) hits.push(entry.trim());
  }
  return hits;
}

/**
 * Whether the stated diet excludes non-veg dishes outright. Eggetarian is not
 * included: Swiggy's veg flag puts egg dishes on the non-veg side, so it can't
 * tell an omelette from chicken.
 */
export function wantsVegOnly(dietary: string[]): boolean {
  return (dietary ?? []).some((d) => /^(vegetarian|vegan|jain)$/i.test(d.trim()));
}

/** A dish the stated diet rules out. Unknown veg status is not a conflict. */
export function dietConflict(isVeg: boolean | undefined, dietary: string[]): boolean {
  return isVeg === false && wantsVegOnly(dietary);
}

/**
 * Sort key for dishes: scored by match score, those on the avoid list below
 * every clean one, unscored last. Unscored stays last because a missing
 * estimate is not evidence the dish is fine.
 */
export function preferenceRank(i: {
  glycemic?: { match_score?: number } | null;
  avoid_matches?: string[];
}): number {
  if (!i?.glycemic) return -1000;
  const score = Number(i.glycemic.match_score) || 0;
  return (i.avoid_matches?.length ? -200 : 0) + score;
}
