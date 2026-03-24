# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # Vite dev server on localhost:1420 (frontend only)
npm run tauri dev     # Full Tauri app in dev mode (frontend + Rust backend)

# Build
npm run build         # TypeScript check + Vite production build
npm run tauri build   # Full production build → generates .exe + NSIS/MSI installers

# Output locations
# src-tauri/target/release/e-proyectosfinanzas-personales-v2.exe  (portable)
# src-tauri/target/release/bundle/nsis/Finanzas Personales_1.0.0_x64-setup.exe
# src-tauri/target/release/bundle/msi/Finanzas Personales_1.0.0_x64_en-US.msi
```

Path alias `@/` maps to `src/`.

## Architecture

This is a **Tauri v2 desktop app** (React frontend + Rust backend) for personal finance management.

### Data Flow

```
React page → useQuery (TanStack React Query) → lib/api.ts (tauri.invoke) → Rust command handler → SQLite
```

- All backend logic lives in `src-tauri/src/commands/` — one file per domain (incomes, expenses, installments, investments, assets, goals, dashboard, charts, reports, settings, sources, profiles)
- All frontend API calls live in `src/lib/api.ts` — typed wrappers around `tauri.invoke()`
- Database schema is in `src-tauri/migrations/001_initial.sql` — initialized at startup via SQLx

### State Management

- **Server state**: TanStack React Query with `queryKey: [domain, profileId, year, month]`
- **Theme**: React Context (`src/lib/theme.tsx`), persisted in localStorage, toggled via `data-theme` attribute on `<html>`
- **UI state**: Local `useState` in each page (modals, forms, filters)

### Multi-Profile & Period Architecture

Every transaction is scoped to a `profile_id`. Currently all pages hardcode `PROFILE_ID = "default"`. Transactions are also grouped by `period_id` (year+month), enabling monthly filtering throughout the UI.

### Rust Command Pattern

```rust
#[tauri::command]
pub async fn get_incomes(
    pool: tauri::State<'_, SqlitePool>,
    profile_id: String,
    year: i64,
    month: i64,
) -> Result<Vec<IncomeEntry>, String>
```

Commands return `Result<T, String>` — errors surface as rejected promises in the frontend.

### Routing

React Router v7 with a `<Layout>` outlet. All routes are nested under the sidebar layout. Root `/` → Dashboard.

## Styling

- **Tailwind CSS v4** via Vite plugin (no `tailwind.config.js` — config is in CSS)
- **Design tokens** defined as CSS custom properties in `src/index.css` — use these variables, don't hardcode colors
- **Fonts**: Outfit (UI text), JetBrains Mono (numeric values)
- **CVA** (Class Variance Authority) used for component variants in `src/components/ui/`
- `cn()` from `src/lib/utils.ts` = clsx + tailwind-merge

Key color tokens: `--primary` (#4361ee), `--success` (#06d6a0), `--danger` (#ef233c), `--warning` (#fb8500), `--surface-*` for card backgrounds.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/api.ts` | All 40+ Tauri invoke wrappers — add new API calls here |
| `src/types/index.ts` | All TypeScript interfaces for domain entities |
| `src-tauri/src/commands/dashboard.rs` | KPI calculations and summary queries |
| `src-tauri/src/db/mod.rs` | SQLite pool initialization and migration runner |
| `src/index.css` | Global design tokens and base styles |
