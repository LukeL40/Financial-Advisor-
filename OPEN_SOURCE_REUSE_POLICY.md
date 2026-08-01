# Open-Source Reuse Policy

## Standing engineering rule

Before designing or implementing any meaningful subsystem, search for mature open-source implementations that may already solve all or part of the problem.

The default sequence is:

1. Define the capability needed.
2. Search for relevant open-source projects, libraries, modules, templates, engines, algorithms, and reference implementations.
3. Evaluate license obligations, project activity, maintenance history, security posture, dependency risk, architectural fit, test quality, and integration cost.
4. Prefer reuse, adaptation, wrapping, extension, or selective porting when that is safer and faster than writing the same capability from scratch.
5. Preserve attribution and all license requirements.
6. Do not indiscriminately copy unrelated code or combine incompatible projects.
7. Keep project-specific logic, differentiation, governance, UX, and strategy owned by this repository.
8. Write new code only when existing implementations are unsuitable, unsafe, incompatible, legally problematic, or materially inferior to a purpose-built implementation.

## Reuse is broader than whole-project forks

Valid reuse can include forking a mature project as a foundation, importing a permissively licensed library, adapting a subsystem or algorithm, wrapping an existing component behind our own interface, using a separate service, learning from an implementation where licensing requires clean separation, and using open standards, schemas, fixtures, or reference implementations.

## Decision record

For each substantial subsystem, record:

`Capability -> candidate source -> license -> security/activity assessment -> reuse method -> integration boundary -> custom work still required`

For this repository specifically, Actual Budget remains the foundation. Before implementing forecasting, debt optimization, portfolio analysis, retirement modeling, classification, AI financial chat, goal engines, or market-data infrastructure, audit existing open-source implementations first and reuse compatible components where appropriate.
