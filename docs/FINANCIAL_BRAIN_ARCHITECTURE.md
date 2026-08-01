# Financial Brain Architecture

## Objective

Extend the Actual Budget fork into a personal financial operating system without weakening Actual's local-first account, transaction, sync, or budgeting foundations.

The first Financial Brain release is recommendation-only. It may read local financial state and produce deterministic recommendations, forecasts, and explanations. It may not move money, place trades, initiate bank transfers, alter external financial accounts, or make autonomous purchases.

## Architecture decision

Keep Actual's existing storage and synchronization stack authoritative for accounts, transactions, schedules, categories, and budget data. Add the Financial Brain as a separate domain layer under `packages/loot-core/src/server/financial-brain/`.

The Financial Brain should consume normalized read models from existing Actual data rather than duplicating the ledger.

### Initial modules

- `types.ts` — domain types and recommendation contracts.
- `snapshot.ts` — builds a read-only financial snapshot from Actual data.
- `policy.ts` — user-configurable policy and risk thresholds.
- `allocator.ts` — deterministic next-dollar allocation engine.
- `forecast.ts` — cash-flow forecast over configurable horizons.
- `health.ts` — financial health metrics and warnings.
- `explain.ts` — converts deterministic outputs into human-readable reasons.
- `index.ts` — narrow public surface for the rest of the app.

## Safety boundary

Phase 1 is strictly read-only with respect to existing Actual ledger data except for Financial Brain-specific preferences/configuration introduced later.

No phase-1 module may:

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
- source inputs used;
- remaining deployable cash;
- warnings/unknowns.

## Development phases

### Phase 1 — Deterministic domain engine

Create pure types, policy validation, allocator, and unit tests using synthetic snapshots. No UI and no mutation of Actual data.

### Phase 2 — Actual read adapter

Build `snapshot.ts` against existing Actual query/database APIs and validate against test fixtures.

### Phase 3 — Financial Brain dashboard

Add a dedicated UI route showing liquidity, monthly surplus, debt exposure, emergency reserve, forecast, and next-dollar recommendations.

### Phase 4 — Scenario engine

Support questions such as "Can I afford this?", "What if I pay $500 toward this card?", and "What happens if I invest $300 per paycheck?" without changing the ledger.

### Phase 5 — AI explanation layer

Add natural-language interpretation on top of deterministic outputs. No AI-generated transaction execution.

### Phase 6 — Controlled integrations

Only after extensive validation: evaluate external read-only financial integrations and explicit approval-gated execution interfaces.

## Engineering rule

Do not modify Actual's account, transaction, sync, or budgeting behavior merely to make the Financial Brain easier to implement. Prefer adapters and narrow interfaces so upstream Actual changes remain easier to merge.
