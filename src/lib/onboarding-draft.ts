/**
 * Unsaved onboarding answers live in sessionStorage for 30 minutes. They are
 * health answers, so they must not survive sign-out or "Delete my data": the
 * next person to sign in on that tab was offered the previous person's draft.
 */
export const ONBOARDING_DRAFT_KEY = "glycocart:onboarding-draft:v1";

export function clearOnboardingDraft(): void {
  try {
    window.sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    /* storage blocked: nothing was stored */
  }
}
