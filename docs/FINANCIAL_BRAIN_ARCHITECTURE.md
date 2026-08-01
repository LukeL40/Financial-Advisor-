# Financial Brain Architecture

## Objective

Extend the Actual Budget fork into a personal financial operating system without weakening Actual's local-first account, transaction, sync, or budgeting foundations.

The first Financial Brain release is recommendation-only. It may read local financial state and produce deterministic recommendations, forecasts, and explanations. It may not move money, place trades, initiate bank transfers, alter external financial accounts, or make autonomous purchases.

## Architecture decision

Keep Actual's existing storage and synchronization stack authoritative for accounts, transactions, schedules, categories, and budget data. Add the Financial Brain as a separate domain layer under `packages/loot-core/src/server/financial-brain/`.

The Financial Brain should consume normalized read models from existing Actual data rather than duplicating the ledger.

Before implementing any substantial new subsystem, read `OPEN_SOURCE_REUSE_POLICY.md` and `docs/FINANCE_OPEN_SOURCE_REUSE_MANIFEST.md`. Search for mature open-source implementations, libraries, algorithms, and reference architectures first. Document whether the capability will be reused directly, adapted, wrapped, used as a behavioral/reference source, or built custom. Do not recreate commodity infrastructure when a compatible, maintainable, license-appropriate implementation already exists.

### Initial modules and ownership expectations

- `types.ts` — Financial Brain-owned domain types and recommendation contracts.
- `snapshot.ts` — Financial Brain-owned read-only adapter over Actual's existing data/query APIs. It must not duplicate the ledger.
- `policy.ts` — Financial Brain-owned user policy and risk thresholds.
- `allocator.ts` — Financial Brain-owned deterministic next-dollar allocation logic.
- `forecast.ts` — reuse-first. Evaluate existing forecasting/cash-flow implementations and permissive libraries before custom implementation.
- `health.ts` — Financial Brain-owned policy/health interpretation may be custom, but underlying financial calculations should reuse or validate against established implementations where practical.
- `explain.ts` — Financial Brain-owned human-readable explanation layer over deterministic outputs.
- `index.ts` — narrow public surface for the rest of the app.

Portfolio analytics, retirement modeling, market-data adapters, transaction classification, and similar specialized infrastructure are not assumed to be custom Financial Brain modules. They require an explicit reuse/build decision first.

## Safety boundary

Phase 1 and Phase 2 are strictly read-only with respect to existing Actual ledger data except for Financial Brain-specific preferences/configuration introduced later.

No read-only Financial Brain module may:

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

### Snapshot provenance requirement

Every major derived value must be explainable. The snapshot/build result should retain enough provenance to identify the source accounts, categories, schedules, transactions, configuration mappings, or derivation rules used to compute values such as liquid cash, checking balance, required spending, income, debt, and emergency reserves.

The system should eventually be able to answer: "Where did this number come from?" without reconstructing the calculation from undocumented assumptions.

Monetary units must follow Actual's existing internal conventions. Adapters must verify and preserve minor-unit/integer-money semantics and must not silently mix dollars with cents.

## Next-dollar policy v1

Given `deployableAmount`, route money in this order unless user policy overrides it:

1. Restore minimum checking buffer.
2. Cover known near-term cash shortfall.
3. Pay debt above the configured high-interest APR threshold.
4. Restore emergency reserve toward the configured target.
5. Fund required goal contributions.
6. Fund target long-term investing contribution.
7. Leave remainder unallocated/discretionary.

`deployableAmount` must represent external or otherwise unallocated cash that is not already counted in `snapshot.liquidCash`. Adapters must not double-count the same cash in both values.

Each recommendation must return or make traceable:

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

Status: initial allocator implemented in PR #1.

### Phase 2 — Actual read adapter

Build `snapshot.ts` against existing Actual query/database APIs and validate against test fixtures. Reuse Actual's existing account, transaction, schedule, category, balance, and query infrastructure. Do not create parallel ledger/database abstractions.

The adapter must produce explicit warnings/missing mappings when financial semantics cannot be derived reliably.

### Mandatory reuse gate before Phase 3+

Before starting each substantial subsystem from Phase 3 onward:

1. Read the repository reuse policy and finance reuse manifest.
2. Search for mature open-source implementations or libraries for the exact capability.
3. Check license compatibility, maintenance, security posture, tests, runtime fit, and integration cost.
4. Record the decision: reuse directly, adapt/wrap, reference/validate only, or custom build.
5. Only write substantial custom infrastructure when reuse is unsuitable or the capability is genuinely product-specific differentiation.

### Phase 3 — Financial Brain dashboard

Add a dedicated UI route showing liquidity, monthly surplus, debt exposure, emergency reserve, forecast, and next-dollar recommendations.

Reuse existing Actual UI/component patterns before creating new design-system infrastructure.

### Phase 4 — Scenario engine

Support questions such as "Can I afford this?", "What if I pay $500 toward this card?", and "What happens if I invest $300 per paycheck?" without changing the ledger.

Forecasting, debt math, and simulation components are reuse-first and must pass the mandatory reuse gate before implementation.

### Phase 5 — AI explanation layer

Add natural-language interpretation on top of deterministic outputs. No AI-generated transaction execution. The AI layer may explain, summarize, compare scenarios, and identify missing data, but deterministic financial engines remain authoritative for numeric recommendations.

### Phase 6 — Controlled integrations

Only after extensive validation: evaluate external read-only financial integrations and explicit approval-gated execution interfaces.

Any bank, brokerage, market-data, or execution integration must use supported APIs and least-privilege credentials. Do not store raw financial institution passwords.

## Engineering rules

1. Do not modify Actual's account, transaction, sync, or budgeting behavior merely to make the Financial Brain easier to implement. Prefer adapters and narrow interfaces so upstream Actual changes remain easier to merge.
2. Actual remains the authoritative financial ledger unless an explicit architecture decision changes that boundary.
3. Reuse existing open-source infrastructure where it is technically and legally appropriate; do not copy incompatible-license code into this MIT-derived fork without an explicit licensing decision.
4. Preserve provenance and explainability for derived financial values and recommendations.
5. Missing or ambiguous financial semantics must be surfaced explicitly rather than guessed.
6. Keep financial execution approval-gated until a separately reviewed phase explicitly changes that policy.