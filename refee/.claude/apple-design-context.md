# Apple Design Context

> Refee is a **React Native (Expo)** app, not native SwiftUI/UIKit. Apple HIG
> still applies to how the iOS build looks and behaves, but implementation is
> RN + NativeWind — favor HIG *principles* and RN-appropriate techniques
> (`useColorScheme`, `AccessibilityInfo`, `PixelRatio`/font scaling) over
> native APIs. See `hig-technologies` (React Native) and `hig-platforms` (iOS).

## Product
- **Name**: Refee
- **Description**: On-demand marketplace for sports officials — referees find and accept games; tournament directors post games, staff crews, and pay them (basketball MVP).
- **Category**: Marketplace / gig-economy (two-sided)
- **Stage**: Development (MVP; Stripe test mode; hosted Supabase; not shipped)

## Platforms
| Platform | Supported | Min OS | Notes |
|----------|-----------|--------|-------|
| iOS      | Yes       | iOS 15.1+ (Expo SDK 54 baseline — verify Xcode deployment target) | **iPhone only** (`supportsTablet: false`) |
| iPadOS   | No        | —      | Not targeted; layouts are phone-width |
| macOS    | No        | —      | — |
| tvOS     | No        | —      | — |
| watchOS  | No        | —      | — |
| visionOS | No        | —      | — |
| Android  | Yes       | —      | Same Expo/RN codebase (`com.refee.app`) |

Bundle id: `com.refee.app` · scheme: `refee`

## Technology
- **UI Framework**: **React Native** via Expo Router (file-based routing). **Not** SwiftUI/UIKit/AppKit.
- **Styling**: NativeWind (Tailwind for RN) — design tokens in `tailwind.config.js`
- **State**: Zustand · **Backend**: Supabase (Postgres/RLS/Edge Functions)
- **Architecture**: Two role-based tab navigators — referee `(app)/(tabs)` and director `(director)/(tabs)` — with pushed detail stacks
- **Apple technologies in use**:
  - **Sign in with Apple** (`expo-apple-authentication`)
  - **Apple Pay-capable** — Stripe `merchantIdentifier: merchant.app.refee` set; currently uses the Stripe card payment sheet, not the Apple Pay button
  - Push notifications (`expo-notifications`), Location (`expo-location`), Secure Store, Image Picker, Web Browser (OAuth)

## Design System
- **Base**: Custom design system (NativeWind tokens), deliberately branded — **not** system defaults
- **Brand Colors** (`tailwind.config.js`): `signal` #1F4FCC (blue), `hi-vis` #C9F031, `court` #00A85C (green/success), `foul` #E63946 (red/destructive), `whistle` #F5B90B; `ink`/`paper`/`chalk` neutrals; dark-mode variants defined
- **Typography**: **Custom** — Inter Tight (display) + JetBrains Mono (mono). Intentionally not SF Pro (brand choice; note HIG's "use platform fonts" is a deliberate deviation here)
- **Dark Mode**: ⚠️ **Defined but not wired** — dark tokens exist in Tailwind, but there is no `useColorScheme` usage and `StatusBar` is hardcoded `style="dark"`; app renders **light-only** today
- **Dynamic Type**: ⚠️ Partial — RN text scales by default (`allowFontScaling` on), and scaling is **globally capped at MAX_FONT_SCALE (1.4×)** via `lib/ui/text-scaling.ts` so dense layouts don't break. Not yet full: ~75 fixed `lineHeight`/fixed-height rows still clip at large sizes; raising the cap needs those made flexible. New code should use `@/components/ui/Text`.

## Accessibility
- **Target Level**: Baseline (currently **below** baseline)
- **Current state**: Only ~3 `accessibilityLabel` + 1 `accessibilityRole` across the whole app; most interactive elements are unlabeled
- **Key gaps to close**: labels on all `Pressable`s/icons-only buttons, VoiceOver pass, Dynamic Type support, sufficient contrast in both themes, Reduce Motion
- **Regulatory**: none stated (no WCAG/508 requirement captured yet)

## Users
- **Primary personas**:
  1. **Referee** — gig worker; on-the-go, glanceable use (browse/accept games, track pay, message crew). Wants speed and clarity on money.
  2. **Tournament Director** — organizer; planning use (create tournaments/games, staff crews, complete + auto-pay, rate refs).
- **Key Use Cases**: accept a game → work it → get paid; post games → fill crew → pay crew; in-app messaging; post-game ratings
- **Known Challenges / design debt**:
  - Two distinct role UIs to keep consistent
  - Payment/payout clarity (charge vs. transfer vs. bank arrival)
  - **Timezone display hardcoded to America/Chicago** (games are in venue-local time — known bug)
  - Dark mode unfinished; Dynamic Type absent; low accessibility coverage

## Existing Design Assets
- No Figma/Sketch source captured
- Design system lives in code: `tailwind.config.js` tokens + `components/ui/*`
- No Apple Design Resources / native component library (RN app)

---
*Generated via the `hig-project-context` skill. Update this file as the app evolves so the other `hig-*` skills can tailor guidance without re-asking.*
