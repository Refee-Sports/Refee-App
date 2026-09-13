import { getSupabaseSetupError } from "@/lib/supabase";

/**
 * Shown in place of app content when Supabase env is missing. The web app is
 * useless without it — it is the shared backend that makes a web login the same
 * login as the app's.
 */
export function SetupNotice() {
  const error = getSupabaseSetupError();
  if (!error) return null;
  return (
    <div className="m-5 border-[1.5px] border-foul bg-chalk p-5">
      <p
        className="font-mono-bold text-[10px] uppercase text-foul"
        style={{ letterSpacing: 2 }}
      >
        Backend not configured
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-80">{error}</p>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-60">
        Use the same project as the mobile app so accounts carry across.
      </p>
    </div>
  );
}
