# Open-Source Leverage Plan

## Decision

Use this Actual Budget fork as the foundation. Do not rebuild commodity personal-finance infrastructure from scratch.

## Reuse from upstream

- account and transaction model
- budgeting infrastructure
- import/sync architecture where appropriate
- reporting and persistence primitives
- mature UI and application scaffolding

## Our differentiation

Create an isolated financial-brain layer for:

- next-dollar allocation
- cash-flow forecasting
- debt payoff optimization
- emergency-fund logic
- savings-goal prioritization
- investment allocation analysis
- scenario simulation (`Can I afford this?`)
- approval-required financial action packets

## Safety boundary

Initial releases are analysis/read-only with respect to external institutions. No autonomous transfers, purchases, bill payments, security trades, borrowing, leverage, or account-opening actions. Any future execution integration requires explicit approval gates, scoped credentials, audit logs, transaction limits, and independent security review.

## Upstream discipline

Preserve required license/copyright notices. Keep custom functionality behind clean boundaries so upstream changes can be merged with minimal conflict.

## Next engineering milestone

Audit the repository architecture and identify the cleanest extension points for a `financial_brain` module without scattering proprietary logic through upstream code.
