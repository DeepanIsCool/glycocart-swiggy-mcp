/**
 * Regression test for Swiggy's response envelope.
 *
 * The published reference documents `{ success, data: { ... } }`, but a real
 * `get_addresses` call returns the payload at the TOP level with no `data`
 * wrapper. Reading `res.data.addresses` therefore silently produced `undefined`
 * everywhere — Settings showed no addresses, and identity resolution fell
 * through to a random id on every login, wiping the user's profile.
 *
 * Shapes below are taken from a real account response (values anonymised).
 *
 * Run: npm run test:envelope
 */
import assert from "node:assert";
import { unwrapSwiggy } from "./swiggy-tools";

// Exactly the shape the live server returns: no `data` wrapper.
const LIVE_GET_ADDRESSES = {
  addresses: [
    {
      id: "aaaa1111",
      addressLine: "Friend Name: 123/4/5, Some Para, Kolkata, West Bengal 700063, India",
      phoneNumber: "****4746",
      addressCategory: "Friends & Family",
      addressTag: "Friend House"
    },
    {
      id: "bbbb2222",
      addressLine: "Account Owner: Block -5, Flat -3A, Some Complex, Behala, Kolkata, India",
      phoneNumber: "****4257",
      addressCategory: "Home",
      addressTag: "Adi home"
    },
    {
      id: "cccc3333",
      addressLine: "Account Owner: 1st Floor Building 14, Some Rd, Behala, Kolkata, India",
      phoneNumber: "****4257",
      addressCategory: "Other",
      addressTag: "Home"
    }
  ],
  total: 3,
  pagination: { page: 1, pageSize: 10, total: 3, totalPages: 1, hasMore: false }
};

// The documented (but not actually observed) wrapped form must still work.
const WRAPPED = { success: true, data: { addresses: [{ id: "z" }], total: 1 } };

const live = unwrapSwiggy<any>(LIVE_GET_ADDRESSES);
assert.equal(live.addresses.length, 3, "top-level payload must pass through untouched");
assert.equal(live.addresses[1].id, "bbbb2222");

const wrapped = unwrapSwiggy<any>(WRAPPED);
assert.equal(wrapped.addresses.length, 1, "documented wrapped payload must unwrap");
assert.equal(wrapped.addresses[0].id, "z");

// Degenerate inputs must not throw — a tool error should surface as "no
// addresses", never as a crashed route.
assert.equal(unwrapSwiggy(undefined), undefined);
assert.equal(unwrapSwiggy(null), null);
assert.deepEqual(unwrapSwiggy<any>({ addresses: [] })?.addresses, []);

// Why the phone number can never be the identity key: it is masked, and
// differs per address because addresses saved for other people carry theirs.
const phones = new Set(LIVE_GET_ADDRESSES.addresses.map((a) => a.phoneNumber));
assert.ok(phones.size > 1, "a single account genuinely exposes multiple phone numbers");
assert.ok(
  [...phones].every((p) => p.startsWith("****")),
  "phone numbers are masked, so they are not a usable stable identifier"
);

// Address labels are user-authored and collide: one account has a "Home"
// category tagged "Adi home" and an "Other" category tagged "Home". The UI
// must disambiguate on the address line, not the tag.
const tags = LIVE_GET_ADDRESSES.addresses.map((a) => a.addressTag);
const categories = LIVE_GET_ADDRESSES.addresses.map((a) => a.addressCategory);
assert.ok(tags.includes("Home") && categories.includes("Home"), "tag/category can disagree");

console.log("swiggy-envelope: all checks passed");
