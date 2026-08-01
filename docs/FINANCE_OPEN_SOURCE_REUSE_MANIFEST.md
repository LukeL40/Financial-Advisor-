# Finance Open-Source Reuse Manifest

## Purpose

This manifest is the required reuse-first gate for Financial Advisor development after PR #1. Before implementing a substantial finance subsystem, compare it against the sources below and document whether we will reuse code, wrap a service/library, adapt architecture, or build custom logic.

The repository remains derived from Actual Budget. Actual is the default system of record for accounts, transactions, budgets, sync, browser/desktop/mobile foundations, and local-first storage unless a later ADR explicitly changes that.

## Governing rule

Do not copy code from a project into this repository merely because it is public. License compatibility, security, maintenance state, language/runtime fit, test quality, and integration cost must be evaluated first.

AGPL projects may be excellent architecture/reference sources but are not automatically safe to copy into this MIT-derived fork. EPL code likewise requires an explicit licensing decision before direct reuse. When licensing is uncertain, prefer interface-level interoperability, independent libraries with permissive licenses, or clean-room implementation from requirements and public behavior rather than source-level copying.

## Candidate systems

### Actual Budget — primary foundation

Role: authoritative application foundation.

Use directly for:

- account and transaction storage;
- budgeting primitives;
- SQLite/local-first data model;
- synchronization infrastructure;
- browser, desktop, and mobile shells;
- import/export and existing financial query infrastructure where applicable.

Default decision: KEEP AND EXTEND.

### Maybe Finance — architecture/reference source

License: AGPL-3.0.
Maintenance: upstream repository is no longer actively maintained.

High-value areas to study:

- household/net-worth presentation;
- investment account UX;
- financial planning flows;
- retirement/goal concepts;
- AI financial-assistant interaction patterns;
- financial dashboard information architecture.

Default decision: STUDY/ADAPT DESIGN. Do not copy source into this repository without an explicit AGPL licensing decision.

### Ghostfolio — investment/wealth architecture source

License: AGPL-3.0.
Maintenance: actively released in 2026.

High-value areas to study:

- portfolio holdings model;
- allocation calculations;
- investment performance and wealth views;
- asset and market-data abstractions;
- portfolio analytics and risk presentation;
- transaction-to-holdings workflows.

Default decision: STUDY/ADAPT DESIGN or use isolated interoperability where justified. Do not source-copy without explicit AGPL decision.

### Firefly III — rules/reporting/import architecture source

License: AGPL-3.0.
Maintenance: actively released in 2026.

High-value areas to study:

- rules engine concepts;
- recurring transactions;
- savings-goal concepts;
- reporting structures;
- financial categorization;
- import/data-normalization workflows;
- API boundary design.

Default decision: STUDY/ADAPT DESIGN. Consider interoperable external services only if they reduce total complexity. Do not source-copy without explicit AGPL decision.

### Portfolio Performance — investment calculation reference

License: EPL-1.0.
Language: Java.
Maintenance: active releases in 2026.

High-value areas to study:

- performance measurement semantics;
- cash-flow-aware returns;
- portfolio/account modeling;
- asset allocation and reporting;
- import patterns and investment analytics.

Default decision: REFERENCE/VALIDATION SOURCE. Direct code reuse is low-fit because of language/runtime and license; use it to validate formulas and expected behavior unless an explicit decision says otherwise.

## Capability decisions

| Capability                   | Primary source to examine first                                                                         | Reuse posture                                        | What remains ours                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| Ledger/accounts/transactions | Actual Budget                                                                                           | Directly reuse existing core                         | Financial Brain adapters and policy semantics             |
| Budget data                  | Actual Budget                                                                                           | Directly reuse                                       | Interpretation for advice/forecasting                     |
| Next-dollar allocation       | Financial Advisor PR #1                                                                                 | Custom                                               | Policy, priorities, explanations                          |
| Net-worth dashboard          | Actual + Maybe reference                                                                                | Reuse Actual data; adapt UX concepts                 | Our dashboard and decision context                        |
| Cash-flow forecasting        | Actual schedules/transactions + external permissive libraries if useful; compare Firefly/Maybe behavior | Reuse primitives, do not reinvent date/math plumbing | Forecast policy, uncertainty, alerts                      |
| Debt optimization            | Search permissive debt/amortization libraries before coding; use Firefly/Maybe as behavior references   | Prefer reusable math primitives                      | Our ranking policy, user constraints, explanation layer   |
| Savings goals                | Actual budget primitives + Firefly/Maybe reference                                                      | Reuse available data structures where practical      | Goal priority and next-dollar integration                 |
| Portfolio holdings           | Actual accounts + Ghostfolio/Portfolio Performance reference                                            | Reuse/adapt data model carefully                     | Unified household view and recommendation policy          |
| Portfolio performance        | Search permissive calculation libraries; validate against Ghostfolio/Portfolio Performance              | Prefer library/formula reuse                         | Presentation and household context                        |
| Rebalancing                  | Search permissive portfolio-allocation libraries first; compare Ghostfolio                              | Prefer reusable algorithms                           | Guardrails, target policy, explanations                   |
| Retirement modeling          | Search permissive retirement/Monte Carlo libraries first; study Maybe flows                             | Prefer reusable simulation/math                      | User assumptions, policies, scenario UX                   |
| Market data                  | Use established provider APIs/adapters; do not build a market-data stack from scratch                   | External service/library                             | Provider selection, caching/privacy controls              |
| Transaction classification   | Search permissive rules/ML classification components; study Actual/Firefly rules                        | Reuse rule infrastructure                            | Personalized classifications and confidence policy        |
| AI financial chat            | Reuse application data/query layer; study Maybe interaction design                                      | Build thin grounded assistant layer                  | Financial Brain tools, guardrails, citations/explanations |
| Bank connectivity            | Actual-supported sync paths / established aggregators                                                   | Reuse supported integrations                         | Consent/approval workflow                                 |
| Money movement/trading       | Regulated provider APIs only, future phase                                                              | No homemade execution infrastructure                 | Approval policy and audit trail                           |

## PR #2 deliverable

PR #2 is documentation/research only. It must not add portfolio, forecasting, debt, market-data, AI, bank-transfer, or trading implementation code.

Before PR #3, select exactly one next capability using this manifest. For that capability:

1. Search for permissively licensed libraries/components that can be directly reused.
2. Inspect Actual Budget for existing primitives we can leverage.
3. Compare relevant AGPL/EPL projects as architecture/behavior references.
4. Record exact candidate package/repository, license, maintenance state, integration boundary, and rejected alternatives.
5. Only then write the implementation work package.

## Initial recommendation for PR #3

Build the **Actual-to-Financial-Brain snapshot adapter** before adding a new major subsystem. PR #1 currently operates on synthetic `FinancialSnapshot` input. The next useful step is to map real Actual Budget read-only data into that snapshot without changing financial records.

This adapter should reuse Actual's existing queries/account/transaction/schedule infrastructure rather than introduce a second financial database or duplicate ledger logic.

No transaction execution, transfers, trades, external AI calls, or autonomous money movement should be introduced in that adapter PR.
