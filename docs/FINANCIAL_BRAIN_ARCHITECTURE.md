# Financial Brain Architecture

## Objective

Extend the Actual Budget fork into a personal financial operating system without weakening Actual's local-first account, transaction, sync, or budgeting foundations.

The first Financial Brain release is recommendation-only. It may read local financial state and produce deterministic recommendations, forecasts, and explanations. It may not move money, place trades, initiate bank transfers, alter external financial accounts, or make autonomous purchases.

## Architecture decision

Keep Actual's existing storage and synchronization stack authoritative for accounts, transactions, schedules, categories, and budget data. Add the Financial Brain as a separate domain layer under `packages/loot-core/src/server/financial-brain/`.

The Financial Brain should consume normalized read models from existing Actual data rather than duplicating the ledger.

### Core modules we expect to own

- `types.ts` — Financial Brain domain types and recommendation contracts.
- `snapshot.ts` — read-only adapter that derives a normalized Financial Brain snapshot from Actual data.
- `policy.ts` — user-configurable policy, risk thresholds, and deterministic guardrails.
- `allocator.ts` — deterministic next-dollar allocation engine.
- `explain.ts` — presentation/explanation logic for deterministic outputs.
- `index.ts` — narrow public surface for the rest of the app.

### Reuse-first modules and capabilities

The following capabilities must not be assumed to require custom implementation:

- cash-flow forecasting;
- financial-health calculations;
- portfolio analytics and rebalancing;
- retirement and Monte Carlo modeling;
- market-data ingestion;
- transaction classification;
- investment performance calculations;
- debt amortization/payoff utilities.

Before implementing substantial infrastructure for these capabilities, consult `OPEN_SOURCE_REUSE_POLICY.md` and `docs/FINANCE_OPEN_SOURCE_REUSE_MANIFEST.md`, search for mature open-source implementations and permissive libraries, document the license/security/fit decision, and reuse or adapt suitable components where appropriate.

Custom code should focus on Financial Advisor's distinctive policy, orchestration, explanations, user experience, and integration boundaries rather than recreating solved financial infrastructure.

## Safety boundary

The initial Financial Brain is strictly read-only with respect to existing Actual ledger data except for Financial Brain-specific preferences/configuration introduced later.

No initial-phase module may:

- create, update, or delete transactions;
- initiate bank sync;
- store bank passwords;
- place securities orders;
- send transfers;
- create payment instructions;
- use an LLM to determine numeric allocations directly.

The allocator must be deterministic and testable. AI may later explain results or help users model scenarios, but the underlying calculations must remain inspectable.

## Initial snapshot contract

The snapshot should eventually include:

- liquid account balances;
- debt balances and APR metadata when available/configured;
- scheduled and recurring obligations;
- recent income history;
- average essential and discretionary spending;
- savings reserves;
- investment-account balances when represented in Actual;
- upcoming cash commitments;
- user financial goals;
- policy thresholds.

Missing inputs must be represented explicitly rather than guessed.

### Provenance requirement

Every major derived metric should carry enough provenance to explain where it came from. At minimum, the adapter should be able to identify relevant source account/category/schedule IDs or the derivation rule used for values such as liquid cash, checking balance, essential spending, income, debt balance, and upcoming obligations.

This allows later explanations such as "You have $X of liquid cash" to be traced back to authoritative Actual records rather than opaque calculations.

### Monetary-unit requirement

Financial Brain adapters must use Actual's existing monetary-unit conventions exactly. Before aggregation, verify whether values are stored as integer minor units and do not mix dollars with cents/minor units.

### Deployable cash invariant

`deployableAmount` is external or otherwise unallocated cash that is not already included in `snapshot.liquidCash`. Adapters must not pass the same cash in both places. This invariant prevents double counting when calculating checking and near-term cash coverage.

## Next-dollar policy v1

Given `deployableAmount`, route money in this order unless user policy overrides it:

1. Restore minimum checking buffer.
2. Cover known near-term cash shortfall.
3. Pay debt above the configured high-interest APR threshold.
4. Restore emergency reserve toward the configured target.
5. Fund required goal contributions.
6. Fund target long-term investing contribution.
7. Leave remainder unallocated/discretionary.

Each recommendation must return:

- action type;
- amount;
- priority;
- reason code;
- source inputs used or traceable provenance;
- remaining deployable cash;
- warnings/unknowns.

## Development phases

### Phase 1 — Deterministic domain engine

Create pure types, policy validation, allocator, and unit tests using synthetic snapshots. No UI and no mutation of Actual data.

Status: implemented in PR #1.

### Phase 2 — Actual read adapter

Build `snapshot.ts` against existing Actual query/database APIs and validate against test fixtures. Reuse Actual's ledger/account/query infrastructure rather than building parallel aggregation or storage systems. Preserve provenance and explicit missing-data states.

### Reuse gate for Phase 3 and later

Before beginning each substantial subsystem after the read adapter:

1. Read `OPEN_SOURCE_REUSE_POLICY.md`.
2. Review `docs/FINANCE_OPEN_SOURCE_REUSE_MANIFEST.md`.
3. Search current open-source projects/libraries for the capability.
4. Verify license compatibility, maintenance, security, test quality, architectural fit, and integration cost.
5. Record whether the chosen approach is direct reuse, wrapped dependency, selective adaptation where licensing permits, reference/behavior validation only, or custom implementation.
6. Build custom infrastructure only when reuse is unsuitable or the capability is genuinely part of Financial Advisor's differentiation.

### Phase 3 — Financial Brain dashboard

Add a dedicated UI route showing liquidity, monthly surplus, debt exposure, emergency reserve, forecast, and next-dollar recommendations. Reuse existing Actual UI/component infrastructure where practical.

### Phase 4 — Scenario engine

Support questions such as "Can I afford this?", "What if I pay $500 toward this card?", and "What happens if I invest $300 per paycheck?" without changing the ledger. Forecasting/simulation math is reuse-first and must pass the reuse gate before implementation.

### Phase 5 — AI explanation layer

Add natural-language interpretation on top of deterministic outputs. No AI-generated transaction execution. AI may explain or query deterministic models but may not become the authoritative numeric allocation engine.

### Phase 6 — Controlled integrations

Only after extensive validation: evaluate external read-only financial integrations and explicit approval-gated execution interfaces. Any integration that can move money or place trades requires a separate security, regulatory, failure-mode, and approval-boundary review.

## Engineering rules

- Do not modify Actual's account, transaction, sync, or budgeting behavior merely to make the Financial Brain easier to implement. Prefer adapters and narrow interfaces so upstream Actual changes remain easier to merge.
- Do not create a second ledger when Actual already stores the authoritative financial state.
- Do not recreate mature commodity infrastructure solely to make it "ours." Ownership comes from the integrated product, policy, architecture, user experience, and distinctive decision intelligence—not from rewriting every underlying algorithm.
- Do not copy incompatible-license code into the MIT-derived fork without an explicit licensing decision.
- Missing financial semantics must be surfaced as missing configuration/data rather than guessed.
