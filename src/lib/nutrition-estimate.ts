import { DISHES, type Dish } from "./catalog";

/**
 * Real Swiggy menu items carry no nutrition data — only name, description,
 * price, isVeg. The glycemic engine needs carbs/protein/fat/fiber/gi/gl.
 *
 * This bridges that gap by matching a dish name against known Indian dish
 * profiles (IFCT-2017 / USDA derived, same source as the demo catalog).
 *
 * Confidence is returned and MUST be surfaced to the user — a "matched"
 * estimate is a real composition-table lookup for that dish; an "archetype"
 * estimate is a category average and can be well off for a specific kitchen's
 * recipe. We return null rather than invent numbers for unrecognised dishes:
 * a fabricated glucose curve shown to someone managing PCOS or diabetes is
 * worse than no curve at all.
 */

export type EstimateConfidence = "matched" | "archetype";

export interface NutritionEstimate {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  gi: number;
  gl: number;
  confidence: EstimateConfidence;
  basis: string;
}

/** Per-serving archetypes for common Indian restaurant dishes not in the catalog. */
const ARCHETYPES: { keywords: string[]; label: string; macros: Omit<NutritionEstimate, "confidence" | "basis"> }[] = [
  {
    keywords: ["biryani", "pulao", "pulav", "fried rice"],
    label: "rice-based main",
    macros: { calories: 650, carbs: 80, protein: 24, fat: 24, fiber: 3, gi: 62, gl: 49.6 }
  },
  {
    keywords: ["naan", "kulcha", "paratha", "bhatura", "puri", "poori"],
    label: "refined-flour bread",
    macros: { calories: 320, carbs: 52, protein: 8, fat: 10, fiber: 2, gi: 71, gl: 36.9 }
  },
  {
    keywords: ["roti", "chapati", "phulka", "tandoori roti"],
    label: "whole-wheat flatbread",
    macros: { calories: 160, carbs: 30, protein: 5, fat: 3, fiber: 4, gi: 52, gl: 15.6 }
  },
  {
    keywords: ["dal", "daal", "sambar", "rasam", "kadhi"],
    label: "lentil preparation",
    macros: { calories: 280, carbs: 32, protein: 14, fat: 9, fiber: 8, gi: 32, gl: 10.2 }
  },
  {
    keywords: ["rajma", "chole", "chana", "kidney bean", "chickpea"],
    label: "legume curry",
    macros: { calories: 320, carbs: 46, protein: 16, fat: 7, fiber: 11, gi: 30, gl: 13.8 }
  },
  {
    keywords: ["dosa", "uttapam", "appam"],
    label: "fermented rice-lentil crepe",
    macros: { calories: 450, carbs: 66, protein: 10, fat: 15, fiber: 4, gi: 56, gl: 37.0 }
  },
  {
    keywords: ["idli", "vada", "upma", "pongal"],
    label: "south indian steamed/savoury breakfast",
    macros: { calories: 320, carbs: 54, protein: 11, fat: 6, fiber: 5, gi: 48, gl: 25.9 }
  },
  {
    keywords: ["tikka", "kebab", "kabab", "grill", "tandoori", "seekh", "wings"],
    label: "grilled protein",
    macros: { calories: 340, carbs: 8, protein: 32, fat: 20, fiber: 1, gi: 20, gl: 1.6 }
  },
  {
    keywords: ["butter chicken", "makhani", "korma", "malai", "cream"],
    label: "cream-based curry",
    macros: { calories: 550, carbs: 18, protein: 28, fat: 40, fiber: 3, gi: 35, gl: 6.3 }
  },
  {
    keywords: ["paneer"],
    label: "paneer dish",
    macros: { calories: 400, carbs: 14, protein: 24, fat: 28, fiber: 3, gi: 30, gl: 4.2 }
  },
  {
    keywords: ["salad", "sprout", "raita"],
    label: "raw / low-carb side",
    macros: { calories: 180, carbs: 12, protein: 7, fat: 10, fiber: 4, gi: 15, gl: 1.8 }
  },
  {
    keywords: ["soup", "shorba", "broth"],
    label: "soup",
    macros: { calories: 140, carbs: 12, protein: 8, fat: 6, fiber: 2, gi: 25, gl: 3.0 }
  },
  {
    keywords: ["noodle", "hakka", "chowmein", "pasta", "schezwan"],
    label: "noodle / pasta",
    macros: { calories: 520, carbs: 72, protein: 16, fat: 18, fiber: 4, gi: 55, gl: 39.6 }
  },
  // Split out because a single "bread-wrapped fast food" bucket made a pizza, a
  // sandwich and a burger return byte-identical macros, which looks fabricated
  // and gives the user nothing to choose between.
  {
    keywords: ["pizza"],
    label: "pizza",
    macros: { calories: 680, carbs: 76, protein: 26, fat: 28, fiber: 4, gi: 60, gl: 45.6 }
  },
  {
    keywords: ["burger", "whopper", "patty"],
    label: "burger",
    macros: { calories: 520, carbs: 44, protein: 24, fat: 26, fiber: 3, gi: 61, gl: 26.8 }
  },
  {
    // "craver" is Subway's name for a sub, not a grilled skewer — scoring
    // "Chicken Seekh Craver" as grilled protein reported 8g of carbs for a
    // six-inch sandwich, which is the wrong direction to be wrong in.
    keywords: ["sandwich", "sub ", "panini", "craver", "footlong"],
    label: "sandwich",
    macros: { calories: 380, carbs: 42, protein: 16, fat: 14, fiber: 4, gi: 56, gl: 23.5 }
  },
  {
    keywords: ["roll", "wrap", "frankie", "shawarma"],
    label: "roll / wrap",
    macros: { calories: 450, carbs: 48, protein: 20, fat: 20, fiber: 3, gi: 58, gl: 27.8 }
  },
  {
    keywords: [
      "fries", "samosa", "pakora", "pakoda", "bhaji", "fried", "crispy", "manchurian",
      "nugget", "popcorn chicken",
      // A deep-fried momo is a different food from a steamed one; these longer
      // keywords win over plain "momo" because the match rule prefers the more
      // specific keyword.
      "fried momo", "kurkure momo", "crispy momo", "tandoori momo"
    ],
    label: "deep-fried item",
    macros: { calories: 450, carbs: 48, protein: 7, fat: 26, fiber: 3, gi: 65, gl: 31.2 }
  },
  {
    // Steamed is the default for momos in India, and steaming makes them a
    // materially better choice than the fried version — lumping both into
    // "deep-fried item" told a diabetic user the two were identical.
    keywords: ["momo", "dumpling", "dimsum", "dim sum", "steamed bao", "wonton"],
    label: "steamed dumpling",
    macros: { calories: 350, carbs: 40, protein: 17, fat: 12, fiber: 3, gi: 55, gl: 22.0 }
  },
  {
    // "waffle", "pancake", "donut", "pastry" all appeared in real order history
    // and were previously unscored.
    keywords: ["gulab", "jalebi", "halwa", "kheer", "rasmalai", "rasgulla", "brownie", "cake", "ice cream", "dessert", "sweet", "waffle", "pancake", "donut", "doughnut", "pastry", "muffin", "cookie", "choco"],
    label: "dessert",
    macros: { calories: 380, carbs: 62, protein: 5, fat: 13, fiber: 1, gi: 75, gl: 46.5 }
  },
  {
    keywords: ["lassi", "shake", "smoothie", "juice", "cola", "pepsi", "soda", "thums"],
    label: "sweetened drink",
    macros: { calories: 250, carbs: 48, protein: 5, fat: 4, fiber: 1, gi: 66, gl: 31.7 }
  },
  {
    keywords: ["buttermilk", "chaas", "green tea", "black coffee", "lime water", "nimbu"],
    label: "unsweetened drink",
    macros: { calories: 70, carbs: 7, protein: 3, fat: 2, fiber: 0, gi: 12, gl: 0.8 }
  },
  {
    keywords: ["fish", "prawn", "pomfret", "surmai", "crab", "egg", "omelette", "bhurji"],
    label: "seafood / egg protein",
    macros: { calories: 300, carbs: 5, protein: 34, fat: 16, fiber: 0, gi: 5, gl: 0.3 }
  },
  {
    keywords: ["millet", "ragi", "quinoa", "oats", "khichdi", "brown rice"],
    label: "whole-grain / millet",
    macros: { calories: 340, carbs: 50, protein: 13, fat: 8, fiber: 8, gi: 40, gl: 20.0 }
  },
  {
    keywords: ["curry", "masala", "gravy", "sabzi", "bhurji", "kofta"],
    label: "vegetable curry",
    macros: { calories: 320, carbs: 22, protein: 12, fat: 20, fiber: 5, gi: 35, gl: 7.7 }
  }
];

const CATALOG = Object.values(DISHES);

/**
 * Portion and marketing words that trail a real Swiggy dish name without saying
 * anything about the food — "[Serves 2]", "Large", "Premium Assorted". They must
 * be stripped before taking the head noun, or the dish type is lost.
 */
const PORTION_WORDS = new Set([
  "serves", "piece", "pieces", "large", "small", "medium", "regular", "combo", "meal",
  "pack", "half", "full", "family", "mini", "jumbo", "value", "special", "premium",
  "assorted", "portion", "size", "with", "plus", "free", "offer", "only", "pcs"
]);

/**
 * The dish type in an Indian menu name is the head noun at the end:
 * "Barbeque Chicken PIZZA", "Hyderabadi Chicken BIRYANI".
 */
function headNoun(name: string): string | undefined {
  const words = name.split(" ").filter((w) => w.length > 3 && !PORTION_WORDS.has(w));
  return words[words.length - 1];
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function toEstimate(d: Dish, confidence: EstimateConfidence, basis: string): NutritionEstimate {
  return {
    calories: d.calories,
    carbs: d.carbs,
    protein: d.protein,
    fat: d.fat,
    fiber: d.fiber,
    gi: d.gi,
    gl: d.gl,
    confidence,
    basis
  };
}

/**
 * Estimate nutrition for a real Swiggy menu item from its name (+ description).
 * Returns null when nothing matches — callers must then present the dish as
 * unscored rather than guessing.
 */
export function estimateNutrition(name: string, description = ""): NutritionEstimate | null {
  const n = normalize(name);
  if (!n) return null;

  // 1. Known dish from the composition-table catalog — strongest signal, but
  //    only when the dish TYPE agrees.
  //
  //    Word overlap alone is not enough and was actively dangerous: "Barbeque
  //    Chicken Pizza" scored 0.5 against "Chicken Tikka" on the shared word
  //    "chicken", so a ~70g-carb pizza was reported as 4g of carbs with no
  //    glucose rise. In Indian menu names the dish type is the head noun at the
  //    end ("... Pizza", "... Tikka", "... Biryani"), so the catalog entry's own
  //    head noun must appear in the name before we trust the match.
  //    Checking only that the CATALOG entry's head appears somewhere in the name
  //    was still too loose: "Chicken Moburg" (a burger) matched "Butter Chicken"
  //    on a "chicken" sitting mid-name, and reported 14g of carbs. The test is
  //    the other direction — the NAME's own head noun must be a word the catalog
  //    dish actually contains.
  const head = headNoun(n);

  let best: { dish: Dish; score: number } | null = null;
  for (const dish of CATALOG) {
    const dishName = normalize(dish.name);
    const dishWords = dishName.split(" ").filter((w) => w.length > 3);
    if (!dishWords.length) continue;

    if (head && !dishName.includes(head)) continue; // different kind of dish

    const hits = dishWords.filter((w) => n.includes(w)).length;
    const score = hits / dishWords.length;
    if (score >= 0.5 && (!best || score > best.score)) best = { dish, score };
  }

  // 2. Archetype from the NAME, by head noun — a keyword late in the name
  //    describes the dish itself ("chicken PIZZA"), an early one is a topping.
  //
  //    The name is searched on its own. Searching name+description together
  //    let a trailing word in the blurb outrank the dish's own type: "Chicken
  //    Moburg", described as "Burger filled with crispy chicken fried momos",
  //    was scored as a momo because "momos" sat last in the sentence. Every
  //    item on that menu then reported identical macros.
  const pick = (text: string, latest: boolean) => {
    let found: { a: (typeof ARCHETYPES)[number]; end: number; len: number } | null = null;
    for (const a of ARCHETYPES) {
      for (const k of a.keywords) {
        const at = latest ? text.lastIndexOf(k) : text.indexOf(k);
        if (at < 0) continue;
        const end = at + k.length;
        // Later wins (it's the head noun); on a tie the longer keyword wins, so
        // "fried momo" beats "momo" without depending on declaration order.
        const better = !found || (latest ? end > found.end : end < found.end) ||
          (end === found.end && k.length > found.len);
        if (better) found = { a, end, len: k.length };
      }
    }
    return found;
  };

  const fromName = pick(n, true);
  // Only fall back to the description, and there take the FIRST keyword —
  // menu blurbs lead with the dish type ("Burger filled with…").
  const arch = fromName ?? pick(normalize(description), false);

  // A later, more specific archetype keyword in the NAME beats a loose catalog
  // match. A description-derived archetype never outranks a real catalog hit.
  if (best && fromName) {
    const catalogHead = headNoun(normalize(best.dish.name));
    const catalogAt = catalogHead ? n.lastIndexOf(catalogHead) + catalogHead.length : -1;
    if (fromName.end > catalogAt) {
      return { ...fromName.a.macros, confidence: "archetype", basis: `category estimate: ${fromName.a.label}` };
    }
  }

  if (best) return toEstimate(best.dish, "matched", `composition table match: ${best.dish.name}`);
  if (arch) {
    return { ...arch.a.macros, confidence: "archetype", basis: `category estimate: ${arch.a.label}` };
  }

  return null;
}

/** Adapt a real Swiggy menu item into the Dish shape the glycemic engine expects. */
export function dishFromEstimate(
  item: { id?: string; name: string; description?: string; price?: number; isVeg?: boolean },
  est: NutritionEstimate
): Dish {
  return {
    id: item.id ?? item.name,
    name: item.name,
    description: item.description ?? "",
    cuisine: "Swiggy",
    price: item.price ?? 0,
    calories: est.calories,
    carbs: est.carbs,
    protein: est.protein,
    fat: est.fat,
    fiber: est.fiber,
    gi: est.gi,
    gl: est.gl,
    tags: [],
    veg: item.isVeg ?? false
  };
}
