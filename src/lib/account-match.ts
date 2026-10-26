/**
 * Telling two Swiggy accounts apart when the access token carries no `sub`.
 *
 * Without a subject the only id was the one already in this browser's cookie,
 * so a second account signing in on the same browser without signing out
 * first was handed the first person's health profile. Saved address ids are
 * issued per account by Swiggy, so the accounts' address sets never overlap:
 * any shared id means the same account, none means a different one.
 */

/**
 * true: the same account. false: a different one. null: nothing to compare
 * (no addresses on file yet, or none on the account), so the caller keeps
 * what it had.
 */
export function sameAccount(known: string[], live: string[]): boolean | null {
  if (known.length === 0 || live.length === 0) return null;
  const seen = new Set(known);
  return live.some((h) => seen.has(h));
}
