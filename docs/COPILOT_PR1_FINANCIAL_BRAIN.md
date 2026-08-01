# Copilot / Codex Work Package — PR 1

## Title

PR 1 — Financial Brain deterministic allocation engine

## Goal

Create the first isolated Financial Brain domain module inside Actual Budget. This PR must not touch bank sync, transaction mutation, external APIs, or UI behavior.

## Required files

Create under:

`packages/loot-core/src/server/financial-brain/`

- `types.ts`
- `policy.ts`
- `allocator.ts`
- `index.ts`
- `__tests__/allocator.test.ts`

## Domain types

Define explicit TypeScript types for:

- `FinancialSnapshot`
- `FinancialPolicy`
- `DebtPosition`
- `GoalPosition`
- `AllocationAction`
- `AllocationReasonCode`
- `AllocationRecommendation`
- `AllocationResult`

Amounts should use the same integer-money convention used by Actual core. Do not introduce floating-point dollars for allocation math.

## Minimum snapshot fields

The synthetic v1 snapshot should support:

- `liquidCash`
- `checkingBalance`
- `nearTermRequiredCash`
- `emergencySavings`
- `monthlyEssentialSpend`
- `monthlyNetIncome`
- `debts[]` with `id`, `name`, `balance`, and APR basis points
- `goals[]` with target/current/required contribution metadata as needed

## Policy fields

At minimum:

- minimum checking buffer
- emergency fund target months
- high-interest debt APR threshold in basis points
- target monthly investing amount

Validate impossible/negative policy inputs.

## Allocation priority

Given a non-negative `deployableAmount`, allocate deterministically:

1. checking buffer shortfall;
2. known near-term required cash shortfall;
3. high-interest debts, highest APR first;
4. emergency-fund shortfall;
5. required goal contribution shortfall;
6. target investing amount;
7. remaining cash as `UNALLOCATED`.

Never allocate more than the deployable amount or more than the need for a stage.

## Output requirements

Every recommendation includes:

- action;
- amount;
- priority;
- reason code;
- target identifier when relevant;
- human-readable deterministic explanation;
- remaining deployable amount after the action.

Return explicit warnings when inputs are insufficient for a stage instead of inventing values.

## Safety constraints

- Pure functions only for allocator/policy.
- No database writes.
- No network calls.
- No LLM calls.
- No transaction creation.
- No brokerage or bank integrations.
- No hidden side effects.

## Tests

Include at least these cases:

1. zero deployable cash;
2. checking buffer consumes all cash;
3. cash cascades through multiple priorities;
4. two high-interest debts are ordered by APR descending;
5. low-interest debt is not targeted under the threshold;
6. emergency target calculation;
7. investing occurs only after higher priorities are satisfied;
8. remainder becomes unallocated;
9. negative input is rejected;
10. exact conservation: sum(recommendations) == deployableAmount.

## Validation

Run the narrow test suite for the new module, then the `@actual-app/core` typecheck/test commands that are practical for the environment. Do not modify unrelated failing tests.

## Non-goals

Do not build UI, bank connections, investment price feeds, AI chat, forecast models, or automated money movement in this PR.

## Definition of done

The repository contains a deterministic, fully unit-tested allocation engine that accepts a synthetic FinancialSnapshot + policy + deployable amount and returns explainable recommendations without modifying any existing Actual Budget behavior.
