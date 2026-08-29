/**
 * Image reference normalisation.
 * Run: npm run test:image
 */
import assert from "node:assert";
import { swiggyImageUrl } from "./swiggy-image";

// Full URLs on known Swiggy hosts pass through.
assert.equal(
  swiggyImageUrl("https://media-assets.swiggy.com/swiggy/image/upload/abc123"),
  "https://media-assets.swiggy.com/swiggy/image/upload/abc123"
);

// Bare CDN paths/ids get the base prefix — the other plausible shape.
assert.equal(
  swiggyImageUrl("fa1b2c3d4e5f"),
  "https://media-assets.swiggy.com/swiggy/image/upload/fa1b2c3d4e5f"
);
assert.equal(
  swiggyImageUrl("/rng/md/carousel/production/abc.png"),
  "https://media-assets.swiggy.com/swiggy/image/upload/rng/md/carousel/production/abc.png"
);

// Protocol-relative.
assert.equal(
  swiggyImageUrl("//media-assets.swiggy.com/x.jpg"),
  "https://media-assets.swiggy.com/x.jpg"
);

// Unknown hosts are rejected: next/image would fail on an unconfigured domain
// and blank the card, so a placeholder is strictly better.
assert.equal(swiggyImageUrl("https://evil.example.com/x.jpg"), null);

// Degenerate inputs must never produce a junk URL.
for (const bad of [undefined, null, 123, "", "   ", "not a url with spaces", '"quoted"', "<tag>"]) {
  assert.equal(swiggyImageUrl(bad as unknown), null, `expected null for ${JSON.stringify(bad)}`);
}

console.log("swiggy-image: all checks passed");
