# Copilot PR #3 — Read-Only Actual → Financial Brain Snapshot Adapter

## Objective

Connect the deterministic Financial Brain allocator from PR #1 to real Actual Budget data without creating a second ledger, duplicating transaction storage, or enabling money movement.

## Mandatory reuse-first rule

Read `OPEN_SOURCE_REUSE_POLICY.md` and `docs/FINANCE_OPEN_SOURCE_REUSE_MANIFEST.md` before implementation. Reuse Actual Budget's existing internal account, balance, transaction, schedule, and budget/query APIs wherever possible. Do not recreate generic ledger/account aggregation infrastructure that Actual already provides.

## Scope

Implement a read-only adapter in `packages/loot-core/src/server/financial-brain/` that produces a `FinancialSnapshot` suitable for `allocateFinancialRecommendations`.

### Required outputs

The adapter must derive, using existing Actual data/query primitives where available:

- checking balance
- liquid cash
- near-term required cash
- monthly essential spend
- monthly net income
- debts that can be reliably identified from Actual account metadata/data
- goals only when reliable goal/contribution metadata exists

Emergency savings may initially require explicit configuration/mapping if Actual does not expose a reliable semantic distinction. Do not infer emergency savings from arbitrary savings accounts.

## Safety / correctness constraints

1. READ ONLY. No transaction creation, mutation, transfer, bank-sync mutation, schedule mutation, or account mutation.
2. Actual remains the authoritative ledger and source of truth.
3. Do not add a parallel database or duplicate transaction/account tables.
4. Do not guess financial semantics. If a value cannot be derived reliably, return an explicit missing-data/warning condition or require configuration.
5. Preserve the PR #1 invariant: `deployableAmount` must be external/unallocated cash not already counted in `snapshot.liquidCash`.
6. Monetary units must match Actual's existing internal conventions. Verify whether values are integer cents/minor units before performing aggregation; do not silently mix dollars and cents.
7. Exclude off-budget/closed accounts only according to explicit documented rules; do not make hidden assumptions.
8. No LLM/AI calls in this PR.
9. No external market-data or bank-data dependencies in this PR.

## Design expectation

Prefer a narrow adapter boundary such as:

```ts
buildFinancialSnapshot(options): Promise<FinancialSnapshotBuildResult>
```

where `FinancialSnapshotBuildResult` may include:

- `snapshot`
- `warnings`
- `missingMappings` / `missingData`
- source/provenance metadata sufficient to explain how each major value was derived

Exact naming may follow repository conventions.

## Configuration

If semantic mappings are required (for example which account is the emergency fund, which accounts count as checking/liquid, or which categories are essential), define a small typed configuration object. Do not build a settings UI in this PR.

## Provenance

For each major derived metric, make it possible to trace the source IDs or derivation rule. The Financial Brain must eventually be able to explain why it believes a user has a given amount of liquid cash or required spending.

## Tests

Add focused tests covering at minimum:

- correct aggregation across multiple eligible cash accounts
- exclusion behavior according to the adapter rules
- monetary-unit correctness
- debt extraction/normalization
- missing emergency-fund mapping does not fabricate a value
- essential-spend derivation or explicit missing configuration
- income derivation
- no double counting between checking balance and liquid cash
- deterministic output for identical source data
- adapter has no write side effects

Use existing Actual test helpers/fixtures when available rather than inventing a parallel fake ledger framework.

## Non-goals

Do NOT implement:

- forecasting engine
- debt payoff optimization beyond PR #1
- portfolio analytics
- investment market data
- retirement simulation
- AI financial chat
- automatic transaction classification
- bank transfers/trades/payments
- UI/dashboard

## Validation before completion

Run the most targeted relevant formatter/linter, Financial Brain tests, adapter tests, and `@actual-app/core` typecheck. Report exact commands and results on the PR.

## Completion criteria

PR #3 is complete when real or representative Actual ledger data can be transformed into a validated, explainable `FinancialSnapshot` through a read-only adapter, with tests proving unit correctness and no mutation of Actual data.
