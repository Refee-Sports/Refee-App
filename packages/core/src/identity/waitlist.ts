import { supabase } from "../client";

// 16 and 17 year olds can't use Refee yet (it's 18+), but we'd like to know how
// many of them there are. They can ask to be emailed when there is something
// for them. The backend keeps only the account's email, their age and an
// optional state — see migration 0060. Both apps use this so they behave alike.

export type WaitlistResult = { error: string | null };

/** Turns what the backend says into something a person can act on. */
export function humanizeWaitlistError(message: string): string {
  if (/16 and 17/i.test(message)) return "The waitlist is for 16 and 17 year olds.";
  if (/two-letter/i.test(message)) return "Use a two-letter state, like NY.";
  return "We couldn't save that. Try again in a moment.";
}

/** Adds the signed-in account to the 16–17 list. `age` must be 16 or 17. */
export async function joinUnder18Waitlist(age: number, state?: string | null): Promise<WaitlistResult> {
  if (age !== 16 && age !== 17) return { error: "The waitlist is for 16 and 17 year olds." };
  const cleaned = (state ?? "").trim().toUpperCase();
  const { error } = await supabase.rpc("join_under_18_waitlist", {
    p_age: age,
    p_state: cleaned === "" ? null : cleaned,
  });
  return { error: error ? humanizeWaitlistError(error.message) : null };
}
