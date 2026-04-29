/**
 * Catalog: 8 restaurants, 30+ dishes from across Indian cuisines.
 * Macros + glycemic index estimates derived from IFCT-2017 + USDA composition tables.
 * In production, this dataset is built via vision LLM + crowd-sourced CGM responses.
 */

export interface Dish {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  price: number;
  calories: number;
  carbs: number; // grams
  protein: number;
  fat: number;
  fiber: number;
  /** Estimated glycemic index (0–100). 0 = no glucose response, 100 = pure glucose */
  gi: number;
  /** Glycemic load = (GI × carbs) / 100. Better predictor of real spike */
  gl: number;
  tags: string[];
  veg: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  area: string;
  rating: number;
  deliveryMin: number;
  costForTwo: number;
  dishIds: string[];
}

export const DISHES: Record<string, Dish> = {
  d_dal_tadka: {
    id: "d_dal_tadka", name: "Dal Tadka",
    description: "Yellow lentils tempered with cumin, garlic, and ghee",
    cuisine: "North Indian", price: 220, calories: 280, carbs: 32, protein: 14, fat: 9, fiber: 8,
    gi: 32, gl: 10.2, tags: ["lentil", "high-fiber", "low-gi"], veg: true
  },
  d_jeera_rice: {
    id: "d_jeera_rice", name: "Jeera Rice (Basmati)",
    description: "Long-grain basmati rice with cumin",
    cuisine: "North Indian", price: 180, calories: 320, carbs: 68, protein: 6, fat: 4, fiber: 1.5,
    gi: 58, gl: 39.4, tags: ["rice", "moderate-gi"], veg: true
  },
  d_brown_rice: {
    id: "d_brown_rice", name: "Brown Rice (steamed)",
    description: "Whole-grain brown rice, no oil",
    cuisine: "Multi", price: 200, calories: 290, carbs: 60, protein: 7, fat: 2, fiber: 4,
    gi: 50, gl: 30.0, tags: ["whole-grain", "high-fiber"], veg: true
  },
  d_ragi_roti: {
    id: "d_ragi_roti", name: "Ragi Roti (2 pcs)",
    description: "Finger millet flatbread, hand-rolled",
    cuisine: "South Indian", price: 140, calories: 260, carbs: 42, protein: 7, fat: 5, fiber: 7,
    gi: 38, gl: 16.0, tags: ["millet", "low-gi", "PCOS-friendly"], veg: true
  },
  d_paneer_tikka: {
    id: "d_paneer_tikka", name: "Paneer Tikka",
    description: "Char-grilled cottage cheese, no cream marinade",
    cuisine: "North Indian", price: 320, calories: 380, carbs: 8, protein: 28, fat: 26, fiber: 2,
    gi: 27, gl: 2.2, tags: ["high-protein", "low-carb", "grilled"], veg: true
  },
  d_paneer_butter: {
    id: "d_paneer_butter", name: "Paneer Butter Masala",
    description: "Paneer in tomato cashew gravy with cream",
    cuisine: "North Indian", price: 360, calories: 540, carbs: 22, protein: 22, fat: 38, fiber: 4,
    gi: 45, gl: 9.9, tags: ["rich", "high-fat"], veg: true
  },
  d_chicken_tikka: {
    id: "d_chicken_tikka", name: "Chicken Tikka",
    description: "Boneless chicken, tandoor-grilled, yogurt marinated",
    cuisine: "North Indian", price: 380, calories: 320, carbs: 4, protein: 38, fat: 16, fiber: 0,
    gi: 0, gl: 0, tags: ["high-protein", "low-carb", "grilled"], veg: false
  },
  d_butter_chicken: {
    id: "d_butter_chicken", name: "Butter Chicken",
    description: "Chicken in tomato-cream gravy with butter",
    cuisine: "North Indian", price: 420, calories: 580, carbs: 14, protein: 32, fat: 42, fiber: 2,
    gi: 30, gl: 4.2, tags: ["high-fat", "moderate-protein"], veg: false
  },
  d_butter_naan: {
    id: "d_butter_naan", name: "Butter Naan",
    description: "Refined-flour leavened bread with butter",
    cuisine: "North Indian", price: 80, calories: 320, carbs: 54, protein: 8, fat: 9, fiber: 2,
    gi: 71, gl: 38.3, tags: ["maida", "high-gi", "trigger-food"], veg: true
  },
  d_chicken_biryani: {
    id: "d_chicken_biryani", name: "Hyderabadi Chicken Biryani",
    description: "Layered basmati with chicken, saffron, fried onions",
    cuisine: "Hyderabadi", price: 420, calories: 720, carbs: 78, protein: 32, fat: 28, fiber: 3,
    gi: 62, gl: 48.4, tags: ["rice-heavy", "high-gi"], veg: false
  },
  d_chole_bhature: {
    id: "d_chole_bhature", name: "Chole Bhature",
    description: "Spiced chickpeas with deep-fried maida bread",
    cuisine: "Punjabi", price: 240, calories: 850, carbs: 110, protein: 22, fat: 36, fiber: 9,
    gi: 70, gl: 77.0, tags: ["fried", "high-gi", "trigger-food"], veg: true
  },
  d_dosa_masala: {
    id: "d_dosa_masala", name: "Masala Dosa",
    description: "Fermented rice-lentil crepe, potato filling",
    cuisine: "South Indian", price: 180, calories: 480, carbs: 70, protein: 10, fat: 16, fiber: 4,
    gi: 56, gl: 39.2, tags: ["fermented", "moderate-gi"], veg: true
  },
  d_idli_sambar: {
    id: "d_idli_sambar", name: "Idli Sambar (3 pcs)",
    description: "Steamed rice cakes with lentil-vegetable stew",
    cuisine: "South Indian", price: 140, calories: 320, carbs: 56, protein: 12, fat: 4, fiber: 6,
    gi: 47, gl: 26.3, tags: ["fermented", "steamed"], veg: true
  },
  d_millet_khichdi: {
    id: "d_millet_khichdi", name: "Foxtail Millet Khichdi",
    description: "Millet + moong dal one-pot meal, ghee tempering",
    cuisine: "Multi", price: 260, calories: 360, carbs: 52, protein: 14, fat: 8, fiber: 9,
    gi: 36, gl: 18.7, tags: ["millet", "low-gi", "PCOS-friendly"], veg: true
  },
  d_quinoa_pulao: {
    id: "d_quinoa_pulao", name: "Quinoa Pulao",
    description: "Quinoa with seasonal vegetables, no oil added",
    cuisine: "Modern Indian", price: 320, calories: 380, carbs: 54, protein: 14, fat: 10, fiber: 8,
    gi: 53, gl: 28.6, tags: ["quinoa", "high-protein", "low-gi"], veg: true
  },
  d_grilled_fish: {
    id: "d_grilled_fish", name: "Grilled Pomfret",
    description: "Whole pomfret with lemon, herbs, no batter",
    cuisine: "Coastal", price: 480, calories: 320, carbs: 2, protein: 42, fat: 14, fiber: 0,
    gi: 0, gl: 0, tags: ["high-protein", "omega-3", "low-carb"], veg: false
  },
  d_palak_paneer: {
    id: "d_palak_paneer", name: "Palak Paneer",
    description: "Spinach gravy with paneer, light cream",
    cuisine: "North Indian", price: 320, calories: 380, carbs: 16, protein: 22, fat: 24, fiber: 6,
    gi: 32, gl: 5.1, tags: ["leafy-green", "high-iron"], veg: true
  },
  d_rajma: {
    id: "d_rajma", name: "Rajma (Kidney Beans Curry)",
    description: "Slow-cooked kidney beans in onion-tomato gravy",
    cuisine: "Punjabi", price: 240, calories: 320, carbs: 48, protein: 16, fat: 6, fiber: 12,
    gi: 29, gl: 13.9, tags: ["legume", "high-fiber", "low-gi"], veg: true
  },
  d_raita: {
    id: "d_raita", name: "Cucumber Raita",
    description: "Whisked yogurt with cucumber, cumin",
    cuisine: "Multi", price: 80, calories: 120, carbs: 10, protein: 6, fat: 6, fiber: 1,
    gi: 14, gl: 1.4, tags: ["probiotic", "low-gi"], veg: true
  },
  d_greek_salad: {
    id: "d_greek_salad", name: "Greek Salad with Feta",
    description: "Cucumber, tomato, olives, feta, olive oil",
    cuisine: "Mediterranean", price: 280, calories: 240, carbs: 12, protein: 8, fat: 18, fiber: 4,
    gi: 15, gl: 1.8, tags: ["raw", "low-carb", "anti-inflammatory"], veg: true
  },
  d_sweet_lassi: {
    id: "d_sweet_lassi", name: "Sweet Lassi (Mango)",
    description: "Yogurt smoothie with mango pulp and sugar",
    cuisine: "Punjabi", price: 140, calories: 280, carbs: 52, protein: 8, fat: 4, fiber: 1,
    gi: 65, gl: 33.8, tags: ["sugar", "trigger-food", "high-gi"], veg: true
  },
  d_buttermilk: {
    id: "d_buttermilk", name: "Spiced Buttermilk",
    description: "Thinned yogurt with cumin, ginger, curry leaves",
    cuisine: "South Indian", price: 60, calories: 80, carbs: 8, protein: 4, fat: 2, fiber: 0,
    gi: 11, gl: 0.9, tags: ["probiotic", "low-gi"], veg: true
  },
  d_egg_bhurji: {
    id: "d_egg_bhurji", name: "Egg Bhurji",
    description: "Scrambled eggs with onion, tomato, green chilli",
    cuisine: "Multi", price: 180, calories: 280, carbs: 6, protein: 22, fat: 18, fiber: 2,
    gi: 0, gl: 0, tags: ["high-protein", "low-carb"], veg: false
  },
  d_oats_khichdi: {
    id: "d_oats_khichdi", name: "Oats Vegetable Khichdi",
    description: "Steel-cut oats with moong dal and vegetables",
    cuisine: "Modern Indian", price: 240, calories: 320, carbs: 46, protein: 14, fat: 6, fiber: 8,
    gi: 42, gl: 19.3, tags: ["oats", "high-fiber", "low-gi"], veg: true
  },
  d_tofu_stirfry: {
    id: "d_tofu_stirfry", name: "Tofu Vegetable Stir-fry",
    description: "Pan-seared tofu with broccoli, bell pepper, ginger",
    cuisine: "Asian", price: 320, calories: 280, carbs: 14, protein: 22, fat: 16, fiber: 5,
    gi: 18, gl: 2.5, tags: ["plant-protein", "low-gi"], veg: true
  }
};

export const RESTAURANTS: Restaurant[] = [
  {
    id: "r_punjab_grill", name: "Punjab Grill", cuisine: "North Indian",
    area: "Indiranagar", rating: 4.4, deliveryMin: 28, costForTwo: 800,
    dishIds: ["d_dal_tadka", "d_jeera_rice", "d_paneer_tikka", "d_paneer_butter",
              "d_butter_chicken", "d_butter_naan", "d_chicken_tikka", "d_palak_paneer", "d_rajma", "d_raita"]
  },
  {
    id: "r_paradise", name: "Paradise Biryani", cuisine: "Hyderabadi",
    area: "HSR Layout", rating: 4.2, deliveryMin: 35, costForTwo: 700,
    dishIds: ["d_chicken_biryani", "d_raita", "d_chicken_tikka"]
  },
  {
    id: "r_dosa_camp", name: "Dosa Camp", cuisine: "South Indian",
    area: "Koramangala", rating: 4.5, deliveryMin: 22, costForTwo: 400,
    dishIds: ["d_dosa_masala", "d_idli_sambar", "d_ragi_roti", "d_buttermilk"]
  },
  {
    id: "r_eat_better", name: "Eat Better Co.", cuisine: "Modern Healthy",
    area: "Indiranagar", rating: 4.6, deliveryMin: 32, costForTwo: 900,
    dishIds: ["d_quinoa_pulao", "d_oats_khichdi", "d_millet_khichdi", "d_tofu_stirfry",
              "d_greek_salad", "d_egg_bhurji", "d_grilled_fish"]
  },
  {
    id: "r_punjabi_dhaba", name: "Sardarji Da Dhaba", cuisine: "Punjabi",
    area: "MG Road", rating: 4.1, deliveryMin: 38, costForTwo: 600,
    dishIds: ["d_chole_bhature", "d_butter_chicken", "d_butter_naan", "d_sweet_lassi", "d_rajma"]
  },
  {
    id: "r_coastal", name: "Mangalore Pearl", cuisine: "Coastal",
    area: "Brigade Road", rating: 4.5, deliveryMin: 40, costForTwo: 1200,
    dishIds: ["d_grilled_fish", "d_brown_rice", "d_buttermilk", "d_palak_paneer"]
  }
];

export function getDish(id: string) {
  const d = DISHES[id];
  if (!d) throw new Error(`Dish not found: ${id}`);
  return d;
}

export function getRestaurantWithMenu(id: string) {
  const r = RESTAURANTS.find((x) => x.id === id);
  if (!r) throw new Error(`Restaurant not found: ${id}`);
  return { ...r, menu: r.dishIds.map(getDish) };
}
