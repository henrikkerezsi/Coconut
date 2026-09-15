# Coconut

A private, offline-first Android budget management app built around a monthly spending
allowance and a savings reserve.

## Product

Coconut models a single user's personal financial system, not a banking or accounting
tool. All data is stored locally on the device in a SQLite database. There is no backend,
no account system, no cloud sync, no advertising, and no analytics.

See [`idea.txt`](idea.txt) for the complete product and architecture specification, and
[`AGENTS.md`](AGENTS.md) for coding conventions used by AI agents.

## Tech Stack

- React Native via Expo SDK
- TypeScript (strict mode)
- expo-sqlite (local storage)
- Expo Router (navigation)
- React Native Paper, Material Design 3 (UI)
- dayjs (date handling)
- Jest + jest-expo (unit tests)

## Development Setup

Prerequisites:

- Node.js 22+
- Android SDK (API 29 / Android 10 or newer) and an emulator

```bash
npm install
npm run start      # start Expo dev server
npm run android    # run in the Android emulator
npm test           # run unit tests
npm run typecheck  # TypeScript check (tsc --noEmit)
```

## Project Structure

```
src/
├── app/           # Expo Router screens and layouts (file-based routing)
├── components/    # Reusable UI components
├── database/      # SQLite schema, migrations, and data-access layer
├── models/        # TypeScript domain models
├── services/      # Business logic and financial calculations
└── utils/         # Generic helpers
tests/             # Jest unit tests
build/             # APK build outputs
```