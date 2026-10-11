# Refee brand kit

The **On Call** mark: a heavy R standing on a zebra baseline, with the square
hi-vis "live" dot at its shoulder. Every part already existed in the product —
the R and the `REF`+`EE` wordmark (Inter Tight Black), the `ZebraRule`
divider, the square `notif-dot`, and the ink canvas — the mark just gathers
them into one symbol. The dot says *available / on call*; the stripes say
*official*.

```
KIND       brand + launch assets     REGISTER  expressive (icon, store, marketing)
PLATFORMS  iOS, Android phone, web   DEPTH     identity
```

## Files

| Folder | What | Master |
|---|---|---|
| `logo/` | mark, small mark, wordmark, horizontal + stacked lockups × reverse / positive / mono-white / mono-black | SVG (outlined type, no fonts needed) |
| `app-icon/` | iOS light/dark/tinted, Android adaptive foreground/background/monochrome, notification glyph, splash | SVG |
| `store/` | Google Play feature graphic 1024×500 | SVG |
| `social/` | avatar 1080, launch post 1080×1350, story 1080×1920 | SVG |
| `web/` | favicon, OpenGraph 1200×630, email header 600×120 | SVG |
| `export/` | every PNG, at store sizes | generated |
| `screenshots/` | raw captures → framed App Store / Play screenshots | generated |
| `tools/` | `gen_brand.py` (SVGs), `render.py` (PNGs + copies into the apps), `screenshots.py` | — |

**Already wired:** `apps/mobile/assets/images/*` + `app.json` (`icon`, `ios.icon`
light/dark/tinted, `android.adaptiveIcon` foreground + monochrome, the
`expo-splash-screen` and `expo-notifications` plugins); web `public/favicon.svg`,
`app/apple-icon.png`, `app/opengraph-image.png` (Next picks those up by file name).

**Regenerate after any change:**

```bash
pip install fonttools                     # once, gen_brand.py only
python3 brand/tools/gen_brand.py          # SVGs
python3 brand/tools/render.py             # PNGs (Chrome + sips) and copies into both apps
```

The local `apps/mobile/ios/` is gitignored and stale — EAS regenerates it. To see
the icon in a local dev build: `npx expo prebuild --clean` or `npx expo run:ios`.

## Usage rules

**Colour by ground**

| Ground | Use | R / REF | Zebra / EE | Live square |
|---|---|---|---|---|
| Ink `#08111C` (home) | `*-reverse` | paper `#E5E1D6` | signal-dark `#4F8CFF` | hi-vis `#C9F031` |
| Paper, chalk, white (**the app icon**) | `*-positive` | ink | signal `#1F4FCC` | court-deep `#009150` |
| Signal blue, photos | `*-mono-white` | white | white | white |
| One-colour print, fax, embroidery | `*-mono-black` | black | black | black |

Hi-vis on paper measures **1.01:1** — it vanishes, which is why the positive
version switches the square to court-deep. Plain court `#00A85C` is only 2.4:1 on
paper, so the mark uses the deeper `#009150` (3.1:1). All other pairs pass 3:1
(paper/ink 14.5, signal-dark/ink 5.9, signal/paper 5.3, court-deep/paper 3.1).

**Clear space:** two live-squares (0.34 × the R's cap height) on every side.

**Minimum size:** full mark 24 px tall (8 mm print). Below that use
`mark-small-*` — the zebra merges into one solid bar. Horizontal lockup 96 px
wide (25 mm). Wordmark alone 14 px cap height.

**Which logo where:** app icon and avatars → mark. Website header, email,
decks → horizontal lockup. Posters, splash-style layouts → stacked lockup. In-app
headers → the existing `Wordmark` component (it already matches).

**Don't:** stretch or rotate it · move or recolour the live square (it's always
top-right, and only hi-vis on ink, court-deep on light grounds, or the mono colour) · round the zebra or
the square (the brand is squared corners) · add shadows, gradients or outlines ·
place the reverse version on a busy photo (use mono-white on a scrim) · set
"REFEE" in another font or all-blue.

## Decisions

- **Evolve, don't replace.** REF+EE, zebra, hi-vis and ink are already the product's language; a new mark from scratch would split the brand three weeks before launch.
- **R, not the jersey.** A pure stripe icon (the old favicon's direction) reads "referee" but looks like any striped brand and moirés below 60 px. The R carries identity; the stripes sit under it as a baseline.
- **Self-contained mark.** A full-bleed zebra band was tried and dropped: Android's circle mask shows only the centre 72 of 108 dp and would crop it away. The mark body is ~50% of the adaptive canvas and ~58% of the iOS tile.
- **Filled EE, not outlined.** The design pack strokes the EE; React Native can't stroke text and outlines disappear at small sizes. The wordmark uses filled signal EE, same as `components/ui/Wordmark.tsx`.
- **Paper icon, not ink or blue (changed Oct 2).** The first cut was an ink tile with a blue zebra and hi-vis square. It sat too close to HoopTrace (near-black tile, mid-blue mark) in store search. The icon is now a paper (cream) tile with an ink R, signal zebra and court-deep square — the one light tile among sports apps. Splash follows the system: paper in light mode, ink in dark (`splash.dark` in app.json). Ink + hi-vis stays the *in-app dark* look and the store/social graphics.
- **Still ink-based, not yet moved to paper:** Play feature graphic, OpenGraph card, email header, launch post and story, and the store-screenshot template. Do these next so the listing doesn't mix both grounds.

## Launch design-asset assessment

Status against a public listing in October. ✅ = produced in this kit.

### Blocks store submission

| # | Asset | Status |
|---|---|---|
| 1 | App icon 1024, opaque, no alpha (iOS) | ✅ `export/ios/AppIcon-1024.png`, wired |
| 2 | iOS 18 dark + tinted icons | ✅ wired |
| 3 | Android adaptive icon + monochrome (Android 13 themed) | ✅ wired |
| 4 | Splash screen | ✅ wired (ink + mark) |
| 5 | Play Store icon 512 | ✅ `export/android/play-store-icon-512.png` |
| 6 | Play feature graphic 1024×500 | ✅ `export/android/play-feature-graphic-1024x500.png` |
| 7 | **iPhone 6.9" screenshots** (1320×2868, 3–10; 6 planned) | **TODO — needs real captures.** Framer + captions ready: see below |
| 8 | **Android phone screenshots** (min 2) | **TODO** — same captures, `screenshots.py` makes the 1080×2340 set |

### Should ship with launch

| # | Asset | Status |
|---|---|---|
| 9 | Android notification icon (white alpha glyph) | ✅ wired — without it Android shows a white square |
| 10 | Web favicon, apple-touch icon, OpenGraph card | ✅ wired — link previews were blank before |
| 11 | **Official store badges on the website** | **TODO** — `apps/web/components/StoreButtons.tsx` draws its own "Download on the App Store"/"Get it on Google Play" buttons. Apple's and Google's badge guidelines require their official artwork; download it from Apple Marketing Resources and Google's badge generator, and swap the `#` links for the live URLs. |
| 12 | Email header | ✅ `export/web/email-header-1200x240.png` — host at `refee.app/brand/email-header.png` and add to `supabase/templates/sign_in_code.html` and the roster-invite email (both text-only today) |
| 13 | Social launch kit | ✅ avatar, launch post, story |

### Worth doing if time allows

| # | Asset | Why |
|---|---|---|
| 14 | Director / league one-pager (PDF) | Supply is two-sided — directors and ref associations need something to forward. Uses the stacked lockup + the site's "Games need officials" line. |
| 15 | "Join my roster" QR poster | Roster QR invites shipped in 0057; a printable poster for gyms and ref meetings turns that into acquisition. |
| 16 | App Store preview video (15–30 s) | Optional; lifts conversion. Screen-record the accept-a-job flow. |
| 17 | Custom Product Page for directors (App Store) | Second screenshot set led by the director flow, for director-targeted links. |

Deliberately **not** needed: empty-state or onboarding illustrations — the
product is type-led by design (display type + mono telemetry), and adding an
illustration style now would dilute it.

## Store screenshots

Capture on the iPhone 17 Pro Max simulator (native 1320×2868), with the seeded
test accounts, into `brand/screenshots/raw/01.png` … `06.png`, then run
`python3 brand/tools/screenshots.py`.

| # | Eyebrow | Headline | Capture |
|---|---|---|---|
| 01 | FOR OFFICIALS | EARN ON YOUR **CALL.** | Jobs feed, Available tab, 4+ games with pay and miles |
| 02 | SET YOUR RATE | PICK YOUR **GAMES.** | Job detail: pay, crew, venue, tip-off |
| 03 | CLEAR PAY STATUS | TRACK EVERY **PAYOUT.** | Profile earnings card on MONTH |
| 04 | CREW CHAT | YOUR CREW, ONE **THREAD.** | Crew group thread |
| 05 | VETTED | VERIFIED. **CHECKED.** | Ref profile: headshot, certs, background check current |
| 06 | FOR DIRECTORS | STAFF EVERY **GAME.** | Director game detail with applicants |

The first three show in search results, so they carry the referee story. The
captions stay literal — nothing says "instant" pay (bank arrival isn't instant).

## Limitations

- Screenshots aren't produced: they have to be real app captures, and the app needs a running backend with seeded data.
- No Illustrator/`.ai`/CMYK master. The SVGs are print-ready vectors; get a CMYK/Pantone spec if merch or signage is planned.
- The iOS dark/tinted variants follow Apple's guidance but have only been checked in a simulated preview, not on a device running iOS 18+.
- Trademark: "Refee" and the mark haven't been searched. Run a USPTO check (classes 9 and 35) before investing in print.
