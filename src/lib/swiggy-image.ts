/**
 * Swiggy image references.
 *
 * The published reference lists `imageUrl` as an optional string but never says
 * what it contains, and the same docs already proved wrong about the response
 * envelope — so assume nothing. Handle a full URL and a bare CDN path, and
 * return null for anything unrecognised so the UI shows a placeholder instead
 * of a broken image.
 */

const CDN_BASE = "https://media-assets.swiggy.com/swiggy/image/upload/";

/** Hosts we allow images from; must stay in sync with next.config.mjs. */
const ALLOWED_HOSTS = new Set([
  "media-assets.swiggy.com",
  "res.cloudinary.com",
  "rmpassets.swiggystatic.com"
]);

export function swiggyImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      // Only render images from hosts Next.js is configured to optimise;
      // anything else would fail at request time and blank the card.
      return ALLOWED_HOSTS.has(url.hostname) ? url.toString() : null;
    } catch {
      return null;
    }
  }

  // Protocol-relative ("//host/path")
  if (value.startsWith("//")) return swiggyImageUrl(`https:${value}`);

  // Otherwise treat it as a CDN path/id. Reject anything with characters that
  // suggest it isn't one (spaces, quotes) rather than building a junk URL.
  if (/[\s"'<>]/.test(value)) return null;

  return CDN_BASE + value.replace(/^\/+/, "");
}
