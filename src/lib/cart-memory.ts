import type { CartMemory } from "./cart-tools";
import { getCartRestaurant, setCartRestaurant } from "./db";

/** The database-backed CartMemory for one user, shared by chat and /api/cart. */
export function cartMemory(uid: string): CartMemory {
  return {
    remember: (id, name) => setCartRestaurant(uid, id, name),
    recall: () => getCartRestaurant(uid)
  };
}
