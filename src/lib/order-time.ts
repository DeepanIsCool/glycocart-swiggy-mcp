/**
 * Reading Swiggy's `orderedTime`.
 *
 * Swiggy's MCP reference documents no format for it, and this code can't call
 * the live server to check, so every plausible form is handled explicitly
 * rather than trusting `new Date(string)`, which got the common ones wrong:
 * - "26 Oct, 7:30 PM" (no year) parsed as 2001, so the order never counted
 *   as today and the daily budget stayed empty;
 * - "Today, 7:30 PM", "Yesterday, ..." and day-first "26/10/2026 19:30" parsed
 *   as invalid;
 * - zone-less strings were read in the server's zone (UTC on Vercel), 5h30m off.
 *
 * Every zone-less form is Indian wall-clock time. Anything unrecognised returns
 * null (and is logged once) rather than a guessed date.
 */

const IST_OFFSET_MIN = 330;
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
};

/** A Date for an Indian wall-clock time. Month is 0-based. */
function fromIst(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date | null {
  if (mo < 0 || mo > 11 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const t = Date.UTC(y, mo, d, h, mi, s) - IST_OFFSET_MIN * 60_000;
  const out = new Date(t);
  // Reject roll-overs such as 31 Feb.
  return new Date(t + IST_OFFSET_MIN * 60_000).getUTCDate() === d ? out : null;
}

/** The Indian calendar date of `now`, as numbers. */
function istParts(now: Date): { y: number; mo: number; d: number } {
  const t = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate() };
}

/** "7:30 PM", "19:30", "07:30:15 pm" → 24h hour, minute, second. */
function clock(text: string | undefined): [number, number, number] | null {
  if (!text || !text.trim()) return [0, 0, 0];
  const m = text.trim().match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ampm = m[4]?.toLowerCase().replace(/\./g, "");
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
  }
  return [h, Number(m[2]), Number(m[3] ?? 0)];
}

const warned = new Set<string>();
function warnOnce(raw: string) {
  // The real format is unconfirmed; this makes it visible in the server logs.
  const shape = raw.replace(/\d/g, "9");
  if (warned.has(shape)) return;
  warned.add(shape);
  console.warn(`Unrecognised Swiggy orderedTime format: ${JSON.stringify(raw)}`);
}

export function parseOrderedAt(raw: unknown, now: Date = new Date()): Date | null {
  if (raw == null || raw === "") return null;

  // Epoch, in seconds or milliseconds.
  if (typeof raw === "number" || (typeof raw === "string" && /^\d{9,13}$/.test(raw.trim()))) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    const d = new Date(n < 1e12 ? n * 1000 : n);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/\s+/g, " ");

  // ISO-like: 2026-10-26 19:30[:00][.000][Z|+05:30]
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (m) {
    const [, y, mo, d, h = "0", mi = "0", sec = "0", zone] = m;
    if (zone) {
      const out = new Date(s.replace(" ", "T"));
      return Number.isNaN(out.getTime()) ? null : out;
    }
    return fromIst(+y, +mo - 1, +d, +h, +mi, +sec);
  }

  // Day-first numeric, as written in India: 26/10/2026 or 26-10-2026, optional time.
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:,?\s+(.+))?$/);
  if (m) {
    const c = clock(m[4]);
    return c ? fromIst(+m[3], +m[2] - 1, +m[1], ...c) : null;
  }

  // Today / Yesterday, 7:30 PM
  m = s.match(/^(today|yesterday)(?:,|\s+at)?\s*(.*)$/i);
  if (m) {
    const c = clock(m[2]);
    if (!c) return null;
    const { y, mo, d } = istParts(now);
    const base = fromIst(y, mo, d, ...c);
    return base && m[1].toLowerCase() === "yesterday" ? new Date(base.getTime() - 86_400_000) : base;
  }

  // Month names, either order, optional weekday and year:
  // "26 Oct 2026, 7:30 PM", "Oct 26, 7:30 PM", "Sun, 26 Oct, 19:30"
  const noWeekday = s.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+/i, "");
  const dayFirst = noWeekday.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?(?:\s+(\d{4}))?(?:,?\s+(?:at\s+)?(.+))?$/i
  );
  const monthFirst = dayFirst
    ? null
    : noWeekday.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?(?:\s+(\d{4}))?(?:,?\s+(?:at\s+)?(.+))?$/i);
  const named = dayFirst
    ? { day: +dayFirst[1], mon: dayFirst[2], year: dayFirst[3], time: dayFirst[4] }
    : monthFirst
      ? { day: +monthFirst[2], mon: monthFirst[1], year: monthFirst[3], time: monthFirst[4] }
      : null;
  if (named) {
    const key = named.mon.toLowerCase();
    const mo = MONTHS[key.startsWith("sept") ? "sept" : key.slice(0, 3)];
    const c = clock(named.time);
    if (mo === undefined || !c) {
      warnOnce(raw);
      return null;
    }
    if (named.year) return fromIst(+named.year, mo, named.day, ...c);
    // No year: this year, unless that lands more than a day in the future.
    const { y } = istParts(now);
    const guess = fromIst(y, mo, named.day, ...c);
    if (guess && guess.getTime() > now.getTime() + 86_400_000) return fromIst(y - 1, mo, named.day, ...c);
    return guess;
  }

  // A full date string with an explicit zone ("... GMT+0530", RFC 2822).
  if (/(gmt|utc|z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 2015) return d;
  }

  warnOnce(raw);
  return null;
}

/** The calendar day in India, as YYYY-MM-DD. */
export function istDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}
