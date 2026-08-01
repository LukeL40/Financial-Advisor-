# Copilot / Codex Work Package — PR 4

## Title

PR 4 — Financial Brain Dashboard

## Goal

Add a dedicated, read-only Financial Brain dashboard route to the Actual Budget UI. The dashboard surfaces the liquidity snapshot, monthly surplus, debt exposure, emergency-reserve status, and next-dollar allocation recommendations produced by the engine built in PR #1 and the adapter built in PR #3.

This PR must not implement forecasting, AI inference, portfolio analytics, transfers, payments, trades, or settings overhauls. It must not mutate Actual ledger data in any way.

## Required files

### Server (loot-core)

- `packages/loot-core/src/server/financial-brain/app.ts` — IPC handler exposing `financial-brain-build-snapshot` and `financial-brain-allocate`.

### Type system (loot-core)

- `packages/loot-core/src/types/handlers.ts` — add `FinancialBrainHandlers` import and include it in the `Handlers` union.

### Server wiring (loot-core)

- `packages/loot-core/src/server/main.ts` — import `financialBrainApp` and include it in `app.combine(…)`.

### UI (desktop-client)

- `packages/desktop-client/src/components/financial-brain/MetricCard.tsx` — reusable stat tile wrapping `Card`, `FinancialText`, and `integerToCurrency`.
- `packages/desktop-client/src/components/financial-brain/WarningBanner.tsx` — visible warning list from the snapshot build result.
- `packages/desktop-client/src/components/financial-brain/RecommendationList.tsx` — ordered list of allocation recommendations.
- `packages/desktop-client/src/components/financial-brain/FinancialBrainPage.tsx` — top-level page; composes all sub-components, manages loading/error states, and owns the deployable-amount input.

### Routing & navigation

- `packages/desktop-client/src/components/FinancesApp.tsx` — add `<Route path="/financial-brain" element={<FinancialBrainPage />} />` behind an `ErrorBoundary`.
- `packages/desktop-client/src/components/sidebar/PrimaryButtons.tsx` — add a "Financial Brain" nav item using `SvgLightBulb` above the existing More section.

### Tests

- `packages/loot-core/src/server/financial-brain/__tests__/app.test.ts` — unit tests for the server handler using mocked dependencies (no real database required).

### Release notes

- `upcoming-release-notes/financial-brain-dashboard.md`

## Reuse requirements

| Need               | Reuse source                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Route pattern      | `FinancesApp.tsx` existing `<Route>` blocks with `ErrorBoundary`                              |
| Sidebar navigation | `Item` / `SecondaryItem` components from `packages/desktop-client/src/components/sidebar/`    |
| Page frame         | `Page` / `PageHeader` from `packages/desktop-client/src/components/Page.tsx`                  |
| Card container     | `Card` from `@actual-app/components/card`                                                     |
| Money formatting   | `integerToCurrency` from `@actual-app/core/shared/util`; `FinancialText` for tabular numbers  |
| Loading state      | `LoadingIndicator` from `packages/desktop-client/src/components/reports/LoadingIndicator.tsx` |
| Error state        | `FeatureErrorFallback` / `ErrorBoundary` already used elsewhere                               |
| Theme tokens       | `theme` from `@actual-app/components/theme`                                                   |
| View/Text          | `View`, `Text`, `Block` from `@actual-app/components/*`                                       |
| IPC                | `send` from `@actual-app/core/platform/client/connection`                                     |
| Icons              | `SvgLightBulb` from `@actual-app/components/icons/v1`                                         |
| Input              | `Input` from `@actual-app/components/input`                                                   |
| Button             | `Button` from `@actual-app/components/button`                                                 |

## Functional scope

### Server handler

`financial-brain-build-snapshot` accepts a `FinancialSnapshotAdapterConfig` and delegates to `buildFinancialSnapshot`. Returns `FinancialSnapshotBuildResult` (snapshot + warnings + provenance).

`financial-brain-allocate` accepts an `AllocationRequest` and delegates to `allocateFinancialRecommendations`. Returns `AllocationResult`.

Both handlers are read-only. No database writes, no network calls, no LLM calls.

### Dashboard page (`/financial-brain`)

The page fetches the snapshot on mount with an empty default config (resulting in auto-detected accounts based on account type metadata) and re-fetches when the user requests a refresh.

It displays:

1. **Metric cards** (always visible even when zero):
   - Liquid Cash (`snapshot.liquidCash`)
   - Monthly Surplus (`snapshot.monthlyNetIncome - snapshot.monthlyEssentialSpend`)
   - Debt Exposure (sum of `snapshot.debts[*].balance`)
   - Emergency Reserve (`snapshot.emergencySavings`)

2. **Warnings panel** — any `SnapshotWarning` objects surfaced prominently so the user understands what data is missing.

3. **Next-dollar allocation section**:
   - A numeric input for `deployableAmount` (integer minor units, user enters dollars and the page converts).
   - A "Run Recommendations" button.
   - The ordered list of `AllocationRecommendation` objects, each showing action label, formatted amount, and explanation.

4. **Loading** — show `LoadingIndicator` while the snapshot is being fetched.

5. **Error** — show an inline error message if the handler throws.

## Safety constraints

- No writes to Actual data.
- No external API calls.
- No LLM calls.
- No forecasting or portfolio analytics beyond what the PR #1–#3 engine already produces.
- No settings overhaul or new preferences screen.
- All monetary amounts handled in integer minor units; convert to display currency only in the render layer using `integerToCurrency`.

## Tests

Handler tests must cover:

1. `financial-brain-build-snapshot` returns a valid `FinancialSnapshotBuildResult` with warnings when no config is provided (mocked database returns no accounts).
2. `financial-brain-allocate` returns correct `AllocationResult` for a valid `AllocationRequest`.
3. `financial-brain-allocate` rejects a negative `deployableAmount`.

UI component tests are not required for this PR but the components must be type-correct.

## Validation

Run and report:

```bash
yarn workspace @actual-app/core run test
yarn typecheck
yarn lint
```

## Non-goals

Do not implement:

- Forecasting or cash-flow projections.
- AI/LLM financial chat or explanation generation.
- Portfolio analytics or investment holdings views.
- Bank transfers, payments, or trade execution.
- Settings overhaul or new user-configurable policy UI.
- Scenario "what-if" engine (Phase 4 work).

## Definition of done

The repository contains a `/financial-brain` route that:

- loads without error;
- displays four metric cards with zero or auto-detected values;
- displays any snapshot warnings;
- accepts a deployable amount and runs the allocator on demand;
- shows the ordered recommendation list;
- passes typecheck and the loot-core unit test suite.
