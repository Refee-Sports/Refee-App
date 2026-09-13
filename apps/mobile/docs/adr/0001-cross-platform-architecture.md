# ADR 0001: Cross-platform Refee architecture

- **Status:** Approved
- **Date:** September 2, 2026
- **Decision owner:** Product owner

## Context

Refee must deliver tournament-director, assignor, and referee workflows on web
and mobile without duplicating permissions, money logic, lifecycle rules, or
data. The current implementation is split between an Expo mobile repository
and a Next.js marketing repository, while Supabase schema/functions currently
live with mobile.

## Decision

Use a monorepo as the target repository structure while retaining distinct,
platform-appropriate frontends:

```text
refee/
├── apps/
│   ├── mobile/          # Expo / React Native
│   └── web/             # Next.js
├── packages/
│   ├── domain/          # Shared statuses, validation, and pure rules
│   ├── design-tokens/   # Shared visual tokens and terminology
│   └── database-types/  # Generated Supabase schema types
└── supabase/
    ├── migrations/
    ├── functions/
    └── tests/
```

The applications deploy independently. “Same experience” means capability,
data, permission, terminology, validation, and state-transition parity—not
pixel-identical layouts.

The following are authoritative shared contracts:

1. One Supabase project per environment: development, staging, production.
2. One migration history and generated database type package.
3. Authorization, assignment transitions, capacity/conflict checks,
   invitation acceptance, and payment calculations run on the server.
4. Web and mobile share domain schemas, design tokens, status labels, analytics
   event names, and cross-platform acceptance scenarios.
5. Web uses responsive desktop patterns; mobile uses native navigation, push,
   deep links, and device integrations.

## Migration constraints

- Preserve both repositories' uncommitted changes and the web repository's Git
  history before moving files.
- Do not make the repository move a prerequisite for correcting production
  authorization or completing the first thin vertical workflow.
- Until consolidation, the mobile repository's `supabase/` directory remains
  the canonical backend and cross-repository drift is a release blocker.
- Select a documented history-preserving import method before the move (for
  example, subtree/history rewrite rather than copying an untracked snapshot).

## Consequences

- Web is not a React Native Web port; it receives purpose-built desktop and
  responsive views.
- Shared UI source is limited to tokens, assets, terminology, and behavioral
  contracts unless a component is demonstrably platform-neutral.
- Database migrations must remain backward-compatible across independently
  released web and mobile clients.
- CI must test shared packages once, then run platform-specific build and E2E
  gates independently.

