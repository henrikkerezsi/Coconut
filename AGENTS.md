# AGENTS.md — Coconut Coding Conventions

This file is the single source of truth for AI agents working on Coconut.
Read `idea.txt` for the full product and architecture specification.

---

## 1. Project Overview

Coconut is a private, offline-first budget management app for Android and
desktop/web. Single user. Local SQLite storage is the single source of truth;
the app works fully offline with no network.

Optional sync: the user's own Supabase project is the ONLY permitted backend,
and only for optional, opt-in row-level synchronization (see `idea.txt`
§11.2 / 11.3). It is local-first: with sync disabled the app makes zero network
requests. Supabase URL + anon key are configured in-app (never hardcoded).

Tech stack (mandatory, do not deviate without explicit user approval):
- React Native via Expo SDK
- TypeScript (strict mode)
- expo-sqlite for local storage
- Expo Router for navigation
- React Native Paper (Material Design 3) for UI components
- dayjs for date handling
- Jest + jest-expo + @testing-library/react-native for tests
- @supabase/supabase-js (optional, only the Supabase sync transport)
- react-native-web + react-dom (desktop/web build support)

Forbidden additions: Redux/MobX/Zustand-style state frameworks, ads, analytics,
authentication beyond Supabase anonymous mode, and any backend/cloud service
OTHER than a user-configured Supabase project. Never hardcode credentials;
Supabase URL + anon key are entered in the in-app Settings screen. Also
forbidden: react-native-vector-icons (use @expo/vector-icons which ships with
Expo).

---

## 2. Report and Plan

When starting work:

1. Read `idea.txt` — it defines the product.
2. Read this file — it defines how to build.
3. State the plan of what you will implement before writing code.
4. Ask when a decision is ambiguous; do not guess on money-related logic.

Do NOT implement things the user has not asked for.

---

## 3. Project Structure

```
src/
├── app/           # Expo Router screens and layouts (file-based routing)
│   ├── (tabs)/    # Tab navigation: overview, transactions, statistics, settings
│   └── _layout.tsx
├── components/    # Reusable UI components (React Native Paper based)
├── database/      # SQLite schema, migrations, and data-access layer
├── models/        # TypeScript types and interfaces (domain model)
├── services/      # Business logic / financial calculations (pure TS)
├── sync/          # Option-al Supabase row sync: pure engine + transport
└── utils/         # Generic helpers (date/currency formatting, etc.)
```

Platform-specific modules are written as `name.android.tsx` / `name.web.tsx`
pairs (or `.native.ts` / `.web.ts`), so the same import resolves correctly on
Android and desktop/web. Do not branch on `Platform.OS` inside shared files
where a `.web` variant is the cleaner solution.

`tests/` mirrors the structure of `src/` and `src/app/` (Jest convention).

---

## 4. Naming Conventions

- Files: `kebab-case.ts` / `kebab-case.tsx` (e.g., `month-summary.tsx`).
- React components: `PascalCase`.
- Non-component functions and variables: `camelCase`.
- Constants and types: `PascalCase` types, `UPPER_SNAKE_CASE` for module constants.
- SQLite tables: `snake_case`, plural, e.g. `fixed_expenses`, `transactions`.
- SQLite columns: `snake_case`, no type prefix (e.g. `amount_cents`, not `int_amount`).

---

## 5. Database Layer

- All database access lives in `src/database/`. Never call SQL directly from UI.
- Money is stored as integers in cents (`amount_cents`). Never floats.
- Use a single database file via expo-sqlite.
- Schema changes require a migration: a numbered migration appended to
  `src/database/migrations.ts`. Never mutate an existing migration.
- Queries are small named functions in `src/database/queries.ts` grouped by domain.
- One repository module per aggregate: `months.ts`, `fixedExpenses.ts`,
  `budgets.ts`, `transactions.ts`, `settings.ts`, `reserve.ts`.

---

## 6. Business Logic

- All calculations live in `src/services/` as pure TypeScript functions.
  No React, no Expo imports there.
- UI components must NOT contain money math, reserve reconciliation, forecasting,
  or estimation logic. Call services instead.
- Key services:
  - `allowance-service.ts` — allowance vs. spending differences.
  - `reserve-service.ts` — reserve adjustments and carry-forward.
  - `estimation-service.ts` — variable fixed-expense estimation strategies.
  - `forecast-service.ts` — expected month-end spending/adjustment.
  - `statistics-service.ts` — historical averages and trends.
- Every function in `src/services/` must have a corresponding unit test in `tests/`.

---

## 7. UI Components

- Use React Native Paper components (Card, List, Button, TextInput, etc.).
- Colors/theme: a single Paper theme configured once in the app layout.
- Use TypeScript types for all props. Never `any`.
- Keep components presentational where possible; screens own state.
- No inline `style` where a themed Paper variant or component exists.

---

## 8. TypeScript

- `strict: true` is always on. Never disable it.
- Prefer interfaces for object shapes; types for unions.
- Derive types from the domain models in `src/models/`.
- No `@ts-ignore`, `@ts-nocheck`, or `any` without explicit justification.

---

## 9. Testing

- Unit tests are mandatory for every function in `src/services/`.
- Component tests encouraged for non-trivial UI behavior.
- Run with: `npm test`.
- Tests must be deterministic. Use explicit fixture data, no randomness.
- Data values in tests use integer cents (e.g. `50000` for 500.00).

---

## 10. Style / Quality

- No comments unless they explain non-obvious business rules.
- No dead code, unused imports, or debug logging left behind.
- Keep functions small and focused; split when they grow.
- Prefer small dependency footprint. Before adding a dependency, ask: could
  Expo, React Native Paper, dayjs, or existing code do this?
- Never commit secrets, credentials, or personal financial data.
- Follow existing patterns in the codebase rather than introducing new ones.

---

## 11. Git

- Subjective: Keep commits small and focused; one logical change per commit.
- Only commit when the user explicitly asks.

---

## 12. Definition of Done

A task is done only when ALL of the following hold:

1. Feature matches the specification in `idea.txt`.
2. Unit tests for all new/changed business logic pass (`npm test`).
3. TypeScript compiles with no errors (`npx tsc --noEmit`).
4. The app runs in the Android emulator without warnings caused by your code.
5. No lint errors (`npx expo lint` if configured).