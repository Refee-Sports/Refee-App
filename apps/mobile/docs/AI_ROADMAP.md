# REFEE — AI Integration Roadmap

**Created:** July 8, 2026
**Principle:** AI attacks existing user frictions; it is never the feature itself. If arithmetic solves it, don't use a language model.

---

## Prioritized candidates

| # | Feature | User | Friction it kills | Tech | Effort | Verdict |
|---|---------|------|-------------------|------|--------|---------|
| 1 | **AI Tournament Builder** | Director | Bulk game creation is tedious (copy button was a band-aid) | Claude structured output → batch `createGame` drafts | Medium | **Build first** |
| 2 | **Smart feed ranking / applicant ranking** | Both | Refs scroll irrelevant games; directors can't compare applicants | Scoring formula v1 (no LLM); learned prefs later | Small (v1) | **Build second** |
| 3 | **Earnings optimizer ("game bundles")** | Referee | Refs think in days, not games — want max $ per trip | Heuristic grouping (same venue/day); LLM optional for phrasing | Small–Medium | Strong third |
| 4 | **Rating narrative summaries** | Director (viewing refs) | 40 ratings ≠ insight; comments unread | Haiku summarization, cached per ref, refreshed on new rating | Small | Do when comment volume exists |
| 5 | **Cert scan onboarding** | Referee | Typing license numbers; trust gap | Vision extraction (Haiku/Sonnet) → prefill + verify flag | Small | Nice pre-launch polish |
| 6 | **Auto-invite top refs on game post** | Director | Staffing latency | Builds on #2 scoring + push notifications | Medium | After push exists |

### Deliberately skipped (for now)
- **Support chatbot** — no support volume yet; revisit post-launch.
- **AI game descriptions** — forms are structured; nothing free-text worth generating.
- **Message auto-reply/drafting** — crews are 2–3 humans coordinating logistics; don't automate the human part.
- **AI rating of refs** — ratings must stay human (directors), or the trust model collapses.

---

## Feature 1 spec sketch: AI Tournament Builder

**Flow:** Tournament detail → "⚡ GENERATE GAMES" → director describes the slate in plain language (or answers 3 short prompts: teams/courts/hours) → preview list of draft games → edit/delete individual drafts → "POST ALL".

**Prompt contract (edge function `ai-generate-games`):**
- Input: free-text description + tournament context (dates, venue, ruleset, defaults from last game created)
- Output: strict JSON array of `createGame` args (title, level, crew_size, pay, starts_at, duration/format, court-as-venue-suffix)
- Model: `claude-sonnet-5` with structured output; temperature low; validate every row against the same rules as the manual form (venue required, ruleset preset, times within tournament dates) before showing preview
- Guardrails: never auto-post — always human review; cap generation at ~60 games/call; log prompt+output for tuning

**Why first:** highest-pain workflow, pure structured generation (LLMs' strongest mode), zero trust/safety surface (drafts only), and it's a demo-able "wow" for director acquisition.

## Feature 2 spec sketch: match scoring (no LLM in v1)

```
refScore(game, ref) =
  w1 · levelFit(ref.levels, game.level)
+ w2 · payFit(game.pay ≥ ref.min_pay; margin above)
+ w3 · dayFit(game.day ∈ ref.available_days)
+ w4 · distance (state now; miles post-geocoding)
+ w5 · reliability (completed rate, withdrew_late count)   // director-facing only
+ w6 · rating (with NEW-REF neutral prior)
```
- Referee feed: sort by score, badge top 3 as "GOOD FIT".
- Director applicants: sort + show 2–3 fit reasons as chips ("WORKED JUCO · 98% SHOW RATE · 12 MI").
- All signals already exist in the schema **except** distance (needs geocoding) — ship with state-level first.

---

## Architecture (all features)

- **Claude API from Supabase Edge Functions** (same pattern as Stripe): `ANTHROPIC_API_KEY` lives in `supabase/functions/.env`, never in the app.
- App calls `supabase.functions.invoke("ai-generate-games", …)`.
- Model routing: `claude-haiku-4-5` for extraction/summarization (cheap, fast), `claude-sonnet-5` for tournament generation.
- Every AI output that mutates data goes through the same validation as manual input, and a human confirms before write.
- Log all prompts/outputs to a table (`ai_events`) from day one — needed for tuning and debugging.

## Open product questions
1. Tournament Builder input style: free-text box, guided 3-question wizard, or both (wizard that accepts rambling)?
2. Does "GOOD FIT" badging need explanation text for refs, or just the badge?
3. Rating summaries: visible to the ref about themselves, or director-only? (Recommend: both see the same text — transparency builds trust.)
4. Pricing: are AI features free (growth) or a director-tier upsell later?
