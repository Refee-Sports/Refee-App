import type { ReactNode } from "react";
import { ValueStrip } from "@/components/auth/ValueStrip";
import { ZebraRule } from "@/components/ui/ZebraRule";

/**
 * The signed-out shell for every auth and onboarding screen.
 *
 * Below `lg` it renders the form alone, full width — the phone layout each of
 * these screens was designed for, untouched. From `lg` up the viewport is
 * wide enough to be worth using, so the brand panel appears alongside and the
 * pair fills the screen: pitch on the left, the form on the right.
 *
 * The form column stays a reading width rather than stretching. A 1400px-wide
 * text field is not an improvement; a form that looks built for the browser
 * it's in is.
 */
export function AuthSplit({ children }: { children: ReactNode }) {
  return (
    <div className="auth-split">
      <aside className="auth-split__aside">
        <div className="flex w-full flex-col justify-center px-12 py-16 xl:px-16">
          <h2
            className="font-display text-[56px] leading-[58px] text-paper xl:text-[68px] xl:leading-[70px]"
            style={{ letterSpacing: -2.5 }}
          >
            REF<span className="text-signal-dark">EE</span>
            <br />
            EARN ON
            <br />
            YOUR <span className="text-signal-dark">CALL.</span>
          </h2>

          <p className="mb-9 mt-5 max-w-sm text-[15px] leading-6 text-paper/70">
            Find games, set your rate, and get paid through Stripe after the
            game.
          </p>

          <ValueStrip />
        </div>
      </aside>

      <div className="auth-split__main">
        {/* Desktop-only: these screens have no zebra rule on a phone and
            should stay exactly as they were there. */}
        <div className="hidden lg:block">
          <ZebraRule variant="signal" noMargin />
        </div>
        <div className="auth-split__form">{children}</div>
      </div>
    </div>
  );
}
