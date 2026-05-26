# Workflow

## SDLC Pipeline

Follow this order strictly:
1. `harness plan --scan` → `--from` — Define features, priorities, milestones
2. `harness analyze --scan` → `--from` — Domain glossary + feature specs
3. `harness design --scan` → `--from` — Interfaces, mocks, API contracts
4. `harness generate <type> <name>` — Scaffold then implement
5. `harness test` — Test with self-healing

**MANDATORY: When creating new files, ALWAYS run the scaffolder command first:**
```
harness generate <type> <name>
```
Available types: component, hook, util, service, model, test.

Do NOT create files manually. The scaffolder ensures:
- Correct directory placement per architecture style
- Proper naming conventions (PascalCase/camelCase)
- Automatic barrel export (index.ts) generation

After scaffolding, you may Edit the generated files to add implementation.

## Testing
- Runner: vitest
- Min coverage: statements=80%, branches=75%
- Run `harness test` for test execution with self-healing feedback

## Agent Scope
- Persona: senior-developer
- Allowed scopes: src/**/*, tests/**/*
- Do NOT modify files outside allowed scopes
