/**
 * Swiggy's `orderedTime` may be an epoch (seconds or milliseconds) or a date
 * string. A string with no zone is Indian time: parsing it in the server's
 * zone (UTC on Vercel) put every order 5h30m late.
 */
export function parseOrderedAt(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  let d: Date;
  if (typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw.trim()))) {
    const n = Number(raw);
    d = new Date(n < 1e12 ? n * 1000 : n);
  } else if (typeof raw === "string") {
    d = new Date(raw);
    if (!Number.isNaN(d.getTime()) && !/(z|gmt|utc|[+-]\d{2}:?\d{2})\s*$/i.test(raw.trim())) {
      d = new Date(d.getTime() - d.getTimezoneOffset() * 60_000 - 330 * 60_000);
    }
  } else {
    return null;
  }
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The calendar day in India, as YYYY-MM-DD. */
export function istDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}
