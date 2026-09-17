# Coconut

<p align="center">
  <img src="assets/coconut-banner.webp" alt="Coconut — a private, offline-first budget tracking app" width="640">
</p>

<p align="center">
  A private, offline-first Android budget app built around a monthly allowance and a savings reserve.<br>
  Everything stays on your device — no account, no network, no tracking.
</p>

---

## About

Coconut models a single person's personal financial system, not a banking or
accounting tool. Every month you get a monthly allowance, plan fixed expenses
and flexible budgets against it, and any amount left over automatically flows
into your savings reserve.

All data lives in a local SQLite database on the device — the single source of
truth. The app works fully offline and makes **zero network requests**. There is
no backend, no account system, no advertising, and no analytics.

## Key features

- **Monthly allowance** — set how much is available each month; past months keep their own allowance.
- **Fixed expenses** — recurring bills, with four estimation strategies (manual, last month, recent average, full history) for variable bills.
- **Flexible budgets** — discretionary spending categories planned per month, with actual-versus-planned tracking per budget.
- **One-off income** — a bonus or gift is added to the month's available money; whatever is unused stays in the reserve.
- **Yearly subscriptions** — spread a once-a-year charge across the year as a flat monthly amount, optionally deducted from each month's available funds, with a renewal-month reminder.
- **Savings reserve** — start/end balance per month, transfers between the reserve and the month, and a month-end surplus that moves into savings automatically. A positive adjustment means you saved; a negative one means spending drew from the reserve.
- **Transactions** — unlimited entries tagged to a budget (with merchant-based budget suggestions) and optional photo attachments.
- **Statistics** — spending trends, averages, reserve development, and per-category performance over time.
- **Overview home screen** — reserve balance, allowance/income/spent/remaining at a glance, and cards for fixed expenses, flexible budgets, income and yearly subscriptions.
- **Theme** — Material Design 3 with light, dark and system appearances.
- **Backup & restore** — export your whole database to a portable file, or restore from one.

## Data & privacy

- Single-user, local-first: the database never leaves your device.
- Money is stored as integer cents — no floating point anywhere.
- The only optional external service on the roadmap is *your own* Supabase project for opt-in, row-level sync (never hardcoded credentials; sync is disabled by default).

## Tech stack

- React Native via **Expo SDK**
- **TypeScript** (strict mode)
- **expo-sqlite** for local storage
- **Expo Router** for file-based navigation
- **React Native Paper** (Material Design 3) for UI
- **dayjs** for date handling
- **Jest** + jest-expo for unit tests
- **react-native-web** for the desktop/web build

## Getting started

Prerequisites:

- Node.js 22+
- Android SDK (API 29 / Android 10 or newer) and an emulator

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `npm install`      | Install dependencies                          |
| `npm run start`    | Start the Expo dev server                     |
| `npm run android`  | Run in the Android emulator                   |
| `npm run web`      | Run the desktop/web build                     |
| `npm test`         | Run unit tests                                |
| `npm run typecheck`| TypeScript check (`tsc --noEmit`)             |
| `npm run lint`     | Lint the code (`expo lint`)                   |

## Project structure

```
src/
├── app/           # Expo Router screens (file-based routing: (tabs), planning, income, subscription, ...)
├── components/    # Reusable UI components (React Native Paper based)
├── config/        # App metadata and What's New entries
├── data/          # DataProvider (React context that owns app state)
├── database/      # SQLite schema, migrations, repositories and queries
├── models/        # TypeScript domain models
├── services/      # Pure business logic (allowance, reserve, forecast, statistics, subscriptions)
├── theme/         # Material 3 theming
└── utils/         # Generic helpers (date, currency, formatting)
tests/             # Jest unit tests
assets/            # App icons, logo and banner
```

## Documentation

- [`idea.txt`](idea.txt) — full product and architecture specification
- [`AGENTS.md`](AGENTS.md) — coding conventions for AI agents

## License

MIT — see [LICENSE](LICENSE).