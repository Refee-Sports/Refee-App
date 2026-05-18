# CURSOR PROMPT CHEATSHEET — Refee Design Translation

This folder contains the design reference HTML files for the Refee app.
Use these with Cursor's Composer (Cmd+I / Ctrl+I) to translate designs
into React Native code.

## QUICK START

1. Drop this entire folder into your project as `_design-reference/`
   (the underscore prefix keeps it visually separated in your file tree)
2. When you want to build a screen, open Cursor Composer
3. Add the relevant HTML file as context (drag & drop, or @-mention it)
4. Use one of the prompt templates below

---

## DESIGN FILES — WHICH ONE FOR WHICH JOB?

| File | What's in it | Use when building... |
|---|---|---|
| `refee_design_system_light.html` | Color palette, type, components + Profile (4.1) and Jobs Feed (4.2) in LIGHT mode | Any screen, dark or light. Also Profile and Jobs Feed |
| `refee_design_system_v2.html` | Same but in DARK mode | Same as above, dark mode reference |
| `refee_job_detail.html` | Job detail screen (4.3) in both modes | The job detail screen |
| `refee_onboarding.html` | Original 6-screen onboarding flow | Welcome, SMS verify, public profile, availability, success |
| `refee_onboarding_v2.html` | NEW screens: Role Select (5.3), Levels (5.6a), Certs (5.6b) | Role-aware onboarding |
| `refee_tournament_workflows.html` | Director/Assignor surfaces (6.1–6.4) | Tournament creation, assignor hiring, dashboards |

---

## THE MASTER PROMPT TEMPLATE

Copy this, swap in the bracketed parts, and paste into Cursor Composer:

```
I'm building Refee, a React Native + Expo app for sports officials.

ATTACHED: [DRAG THE HTML FILE HERE]

Please translate the [SCREEN NAME, e.g. "Role Select (5.3)"] design from
the attached HTML into a React Native screen.

OUTPUT FILE: [PATH, e.g. "app/(onboarding)/role-select.tsx"]

TECHNICAL REQUIREMENTS:
- Use NativeWind classes — design tokens are in tailwind.config.js
- Reuse components from @/components/ui/ where they exist:
  - Button (variants: primary, hi-vis, secondary, danger)
  - Badge (variants: live, confirmed, signal, warn, foul, neutral, ink)
  - ZebraRule (variants: ink, signal, hi-vis)
  - Wordmark
- Match the layout patterns from existing screens:
  - app/(auth)/welcome.tsx (full-screen ink canvas)
  - app/(auth)/sign-in.tsx (form with sticky bottom button)
  - app/(auth)/verify.tsx (input-heavy with helper callouts)
- Use useSafeAreaInsets for top/bottom safe area
- Wire state with useState
- Use expo-haptics for button taps:
  - Haptics.selectionAsync() for choosing options
  - Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) for primary CTAs
- Use Feather icons from @expo/vector-icons where applicable

DESIGN FIDELITY:
- Match the design closely — same color tokens, same type scale, same spacing
- Use the EXACT colors via Tailwind classes (bg-paper, text-ink, text-signal, etc.)
- For text styling:
  - Display headlines: font-display (Inter Tight 900), uppercase, tight letter spacing
  - Body: default
  - Mono labels (eyebrows, metadata): font-mono-bold, uppercase, wide letter spacing
- Squared corners (no rounded-anything) unless the design clearly shows curves
- 1.5px borders for emphasis (border-[1.5px])
- 1px borders for default (border)

DATA & ROUTING:
- Use Expo Router's useRouter() for navigation
- Mock data is fine for now if Supabase queries aren't ready

Please generate the complete file.
```

---

## SCREEN-BY-SCREEN: WHAT TO BUILD NEXT (PRIORITY ORDER)

### Priority 1: Complete the onboarding flow
These unlock everything else because users can't get past welcome without them.

1. **Role Select** (`app/(onboarding)/role-select.tsx`)
   - Design: `refee_onboarding_v2.html` screen 5.3
   - State: selected role (ref / assignor / director)
   - Next: branches based on role

2. **Public Profile** (`app/(onboarding)/profile.tsx`)
   - Design: `refee_onboarding.html` screen 5.4
   - State: firstName, lastInitial, city, photo
   - Important: live preview card showing how they'll appear to others
   - Writes to: public_profiles table

3. **Levels of Play** — REF ONLY (`app/(onboarding)/levels.tsx`)
   - Design: `refee_onboarding_v2.html` screen 5.6a
   - State: array of selected level IDs
   - Sections: Amateur/Dev, College, Professional
   - Writes to: ref_levels table (see `supabase/migrations/0004_roles_levels_tournaments_assignors.sql`)

4. **Certifications** — REF ONLY (`app/(onboarding)/certifications.tsx`)
   - Design: `refee_onboarding_v2.html` screen 5.6b
   - State: array of selected cert IDs + custom add
   - Writes to: certifications table

5. **Availability** — REF ONLY (`app/(onboarding)/availability.tsx`)
   - Design: `refee_onboarding.html` screen 5.6
   - State: days bitmask, radius, min pay
   - Writes to: availability_prefs table

6. **Success** (`app/(onboarding)/success.tsx`)
   - Design: `refee_onboarding.html` screen 5.8
   - The hi-vis stamp + "JOBS NEAR YOU" stats
   - Routes to: /(app)/jobs

### Priority 2: Core ref experience

7. **Jobs Feed tab** (`app/(app)/(tabs)/jobs.tsx`)
   - Design: `refee_design_system_light.html` screen 4.2
   - State: filter, tab (available/invited/saved)
   - Fetches: jobs table

8. **Job Detail** (`app/(app)/job/[id].tsx`)
   - Design: `refee_job_detail.html`
   - Has sticky accept/decline action bar
   - Fetches: job + assignments + hirer

9. **Profile tab** (`app/(app)/(tabs)/profile.tsx`)
   - Design: `refee_design_system_light.html` screen 4.1
   - The "Scorecard" data block is the visual anchor

### Priority 3: Director/Assignor surfaces (later)

10. Tournament create flow
11. Staffing choice (`refee_tournament_workflows.html` 6.1)
12. Assignor browse (6.2)
13. Assignor proposal (6.3)
14. Assignor dashboard (6.4)

---

## CURSOR-SPECIFIC TIPS

### Use Composer, not just chat
Composer (Cmd+I) creates/edits files. Chat (Cmd+L) just talks.
For screen translation, always use Composer.

### Add context files
When asking Cursor to build a screen, also @-mention these so it follows
existing conventions:
- `@app/(auth)/welcome.tsx` (canvas screen pattern)
- `@app/(auth)/sign-in.tsx` (form screen pattern)
- `@tailwind.config.js` (design tokens)
- `@components/ui/Button.tsx` (component patterns)

### Iterate with follow-ups
After Cursor generates a screen, refine with quick follow-ups:
- "Make the headline 4px smaller and add tighter letter spacing"
- "Move the helper callout above the input, not below"
- "The selected state should invert to ink with hi-vis check"
- "Add a loading state when the form submits"

### Don't let Cursor create design tokens from scratch
If it tries to use a color like `bg-blue-600`, stop it. Tell it to use
`bg-signal` instead. The design tokens are already locked in tailwind.config.js.

---

## COMMON TRANSLATION GOTCHAS

| HTML pattern | React Native equivalent |
|---|---|
| `<div>` | `<View>` |
| Inline text in a div | `<Text>` wrapped in `<View>` |
| `display: flex` | View is flex by default; use `flex-row` for row |
| `cursor: pointer` | Wrap in `<Pressable>` |
| `:hover` styles | Use `active:` prefix (active:opacity-80) |
| `position: absolute` bottom bar | Use `absolute bottom-0 left-0 right-0` |
| `overflow-y: auto` | Use `<ScrollView>` |
| Gradient backgrounds | Use `expo-linear-gradient` package |
| SVG with `stroke="currentColor"` | Works fine via react-native-svg |
| `letter-spacing: 0.18em` on a 10px font | `style={{ letterSpacing: 1.8 }}` (em → px) |
| `repeating-linear-gradient` for zebra | Use the ZebraRule component (already built) |

---

## WHEN TO ASK CURSOR vs. ME

**Ask Cursor (Composer) for:**
- Translating an HTML design to a React Native screen
- Fixing TypeScript errors
- Refactoring components
- Adding new minor features
- Updating styles
- Writing Supabase queries against the existing schema

**Ask me (Claude) for:**
- Schema design decisions (new tables, new RLS policies)
- Architecture choices (auth flow, payment flow, state mgmt)
- Product decisions (what fields to collect, who can see what)
- Designing a new screen that doesn't exist yet
- Background check / Stripe Connect / compliance questions
- Strategy on monetization, growth, marketing

---

## A NOTE ON THE WHISTLE

You said you didn't love any of the whistle icons. That's fine.
Until you find one you love:

1. Use a temporary placeholder — the Feather "target" icon or "user-check"
2. Create `components/icons/RefereeIcon.tsx` as a single-file component
3. When you finalize the design, just update that one file

The whistle is one ~30-line SVG. It will never block you from shipping.

---

## QUESTIONS? COME BACK TO ME.

When you hit something Cursor can't quite get right, or you're not sure
about an architecture call, come back and ask. Don't fight Cursor for 30
minutes when 2 minutes with me + clearer prompts will unblock you.

Good luck. Go build.
