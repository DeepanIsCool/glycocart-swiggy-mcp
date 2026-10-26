/**
 * Swiggy's orderedTime has no documented format. Each form below is read as
 * Indian wall-clock time, whatever zone the server runs in. "26 Oct, 7:30 PM"
 * used to parse as 2001, which kept every order out of today's budget.
 *
 * Run: npm run test:order-time (also run under TZ=Asia/Kolkata and New York)
 */
import assert from "node:assert";
import { parseOrderedAt, istDay } from "./order-time";

// 13:00 UTC on 26 Oct 2026 = 18:30 IST.
const now = new Date("2026-10-26T13:00:00Z");
const ist = (raw: unknown) => {
  const d = parseOrderedAt(raw, now);
  return d ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" }).format(d) : null;
};

const cases: [unknown, string | null][] = [
  ["2026-10-26 17:30:00", "26/10/2026, 17:30"],
  ["2026-10-26T17:30:00", "26/10/2026, 17:30"],
  ["2026-10-26T12:00:00Z", "26/10/2026, 17:30"],
  ["2026-10-26T17:30:00+05:30", "26/10/2026, 17:30"],
  ["2026-10-26", "26/10/2026, 00:00"],
  ["26 Oct 2026, 5:30 PM", "26/10/2026, 17:30"],
  ["26 Oct, 5:30 PM", "26/10/2026, 17:30"],
  ["Oct 26, 5:30 PM", "26/10/2026, 17:30"],
  ["October 26, 2026 at 5:30 pm", "26/10/2026, 17:30"],
  ["Sun, 26 Oct, 17:30", "26/10/2026, 17:30"],
  ["26th Oct, 5:30 PM", "26/10/2026, 17:30"],
  ["26/10/2026 17:30", "26/10/2026, 17:30"],
  ["26-10-2026, 5:30 PM", "26/10/2026, 17:30"],
  ["Today, 5:30 PM", "26/10/2026, 17:30"],
  ["Yesterday, 9:15 AM", "25/10/2026, 09:15"],
  ["today at 12:05 am", "26/10/2026, 00:05"],
  [1793016000, "26/10/2026, 17:30"],
  ["1793016000000", "26/10/2026, 17:30"],
  // A year-less date later than now is last year, not a future order.
  ["28 Dec, 8:00 PM", "28/12/2025, 20:00"],
  // Not guessed at.
  ["sometime", null],
  ["7:30 PM", null],
  ["31/02/2026 10:00", null],
  ["Today, 25:00", null],
  ["", null],
  [null, null],
  [{}, null]
];
for (const [raw, want] of cases) assert.equal(ist(raw), want, `parseOrderedAt(${JSON.stringify(raw)})`);

// The Indian day, not UTC: 23:00 UTC on the 25th is 04:30 IST on the 26th.
assert.equal(istDay(new Date("2026-10-25T23:00:00Z")), "2026-10-26");

console.log("order-time: all checks passed");
