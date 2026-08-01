# Copilot PR #4 — Financial Brain Dashboard

## Objective
Create the first end-to-end user-visible Financial Brain experience by reusing Actual Budget's existing UI, navigation, data-loading, formatting, and component patterns. The dashboard must consume the read-only snapshot adapter from PR #3 and the deterministic allocator from PR #1.

## Mandatory reuse-first rule
Read these before implementation:
- `OPEN_SOURCE_REUSE_POLICY.md`
- `docs/FINANCE_OPEN_SOURCE_REUSE_MANIFEST.md`
- `docs/FINANCIAL_BRAIN_ARCHITECTURE.md`

Before creating any new generic UI primitive, chart wrapper, money formatter, route shell, loading state, error state, modal, card, table, or navigation pattern, search the existing Actual codebase and reuse its established components and conventions where practical. Do not add a new UI framework.

## Scope
Add a dedicated read-only Financial Brain dashboard route/view to the existing app.

The dashboard should present, using real Actual data through `buildFinancialSnapshot`:
- checking balance
- liquid cash
- monthly net income
- monthly essential spend
- monthly surplus (`monthlyNetIncome - monthlyEssentialSpend`)
- total mapped debt balance
- high-interest debt exposure using the existing policy threshold
- emergency savings and configured emergency target status
- near-term required cash
- missing mappings / missing data / warnings
- next-dollar recommendations from `allocateFinancialRecommendations`
- provenance/details sufficient to understand how major figures were derived

## Configuration boundary
PR #4 should not build a full settings subsystem. If the dashboard requires adapter mappings or policy values not yet persisted, use the smallest repository-consistent mechanism possible for a development/demo-safe configuration boundary. Prefer existing preference/settings primitives if suitable; otherwise isolate configuration in a typed adapter/presenter layer so a later settings PR can replace it cleanly.

Do not hard-code personal financial data.

If required mappings are missing, the dashboard must show a clear incomplete-setup state rather than fabricating values.

## Data flow
Prefer a narrow composition layer such as:

Actual data -> `buildFinancialSnapshot(config)` -> snapshot result -> `allocateFinancialRecommendations(...)` -> dashboard view model -> UI

Do not let UI components recalculate financial rules independently.

## Next-dollar input
The dashboard may expose a local, non-persisted input for `deployableAmount` so the user can ask "Where should this amount go?" without writing to the ledger.

Important invariant: the entered deployable amount is external/unallocated cash not already included in `snapshot.liquidCash`.

Use Actual's existing money input/formatting components if available. Validate minor-unit conversion carefully and do not mix displayed currency units with internal minor units.

## Dashboard behavior
At minimum provide these sections:

### 1. Financial position
Compact summary of:
- checking
- liquid cash
- monthly net income
- monthly essential spend
- monthly surplus

### 2. Risk / reserves
- near-term required cash
- emergency savings
- emergency target / shortfall where policy permits calculation
- total mapped debt
- high-interest mapped debt

### 3. Next-dollar recommendations
For a user-entered deployable amount, show ordered recommendations with:
- action
- formatted amount
- priority
- explanation
- target where available
- remaining deployable cash

### 4. Data quality / setup
Surface adapter warnings, missing mappings, and missing data prominently enough that the user cannot mistake incomplete inputs for verified zero values.

### 5. Provenance / details
Provide a compact expandable/details presentation showing source rules/account/category/schedule IDs for major metrics. Reuse existing disclosure/detail components if available.

## Safety constraints
1. Read only.
2. No transaction creation/update/delete.
3. No transfers, payments, trades, purchase actions, or external account mutation.
4. No bank sync initiation.
5. No AI/LLM call.
6. No automatic recommendation execution.
7. No forecasting implementation in this PR.
8. No investment/portfolio analytics in this PR.
9. No retirement modeling or market data.
10. Do not modify Actual ledger behavior to accommodate the dashboard.

## UX requirements
- Follow Actual's existing design system and responsive patterns.
- Keep the experience usable on desktop and narrow/mobile layouts where the existing app supports them.
- Use existing currency formatting and accessibility patterns.
- Loading, empty, incomplete-setup, and error states must be explicit.
- Do not expose raw minor-unit integers to users.
- Do not imply that recommendations are guaranteed outcomes or autonomous financial advice/execution.

## Tests
Add focused tests using existing UI/test patterns where practical. Cover at minimum:
- dashboard view model correctly consumes snapshot + allocator outputs
- formatted financial metrics derive from backend values rather than independent UI math, except simple presentation-only derived values explicitly tested
- warnings/missing mappings render as incomplete setup, not verified zero
- recommendation ordering and values match allocator output
- deployable input unit conversion is correct
- zero deployable amount is handled cleanly
- no write/mutation call is made from dashboard interactions
- route/view renders with representative fixture data

Prefer testing a presenter/view-model separately from full DOM tests if that matches repository conventions and reduces brittle UI tests.

## Reuse evidence
In the PR description, explicitly list existing Actual components/modules reused for:
- route/navigation
- data loading or API invocation
- currency formatting
- input controls
- layout/cards/tables/disclosures
- loading/error states

If a new component is introduced, state why an existing component was unsuitable.

## Non-goals
Do not implement:
- forecast engine
- debt payoff scenario engine
- portfolio analytics
- AI financial chat
- settings overhaul
- bank connection onboarding
- transaction classification
- execution/automation

## Validation before completion
Run targeted formatter/linter, relevant Financial Brain server tests, new presenter/UI tests, and applicable typechecks. If the client package has a targeted test/typecheck command for changed files, run it. Report exact commands and outcomes in the PR.

## Completion criteria
PR #4 is complete when a user can open a Financial Brain dashboard, see real read-only metrics sourced from Actual through the PR #3 adapter, inspect missing-data warnings/provenance, enter an external deployable amount, and receive the deterministic PR #1 next-dollar recommendations without any ledger or external-account mutation.

Do not merge the PR. Leave it for review.