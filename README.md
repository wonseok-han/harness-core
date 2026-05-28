# @wonseok-han/harness-core

Service-agnostic universal AI harness framework for SDLC guardrails.

Any web framework. Any AI agent. Any directory structure. One configuration.

## Install

```bash
npm install -D @wonseok-han/harness-core

# or globally
npm install -g @wonseok-han/harness-core
```

## Quick Start

You run **one command**. The AI agent does the rest.

```bash
harness init          # new project (interactive)
harness init .        # existing project (adopt mode — safe, no overwrites)
```

For new projects, this creates the project, installs dependencies, and configures your AI agent(s).
After init, the AI agent automatically follows the SDLC pipeline:

1. **Plan** — `harness plan --scan` → `--from` (features, priorities, milestones)
2. **Analyze** — `harness analyze --scan` → `--from` (domain glossary, feature specs)
3. **Design** — `harness design --scan` → `--from` (interfaces, mocks, API contracts)
4. **Develop** — `harness generate <type> <name>` (scaffold then implement)
5. **Test** — `harness test` (self-healing loop)

The session-init hook detects which stage is complete and tells the agent what to do next.

Enforcement:
- **Claude Code:** Hooks in `.claude/settings.json` auto-trigger on session start, file write, and config change
- **Cursor/Copilot/Windsurf/Aider:** Rules injected into agent-specific config files

### Manual Commands (optional)

```bash
harness plan                 # interactive planning (human in terminal)
harness analyze              # interactive domain analysis
harness design               # interactive design contract builder
harness design --check       # verify design artifacts exist before implementing
harness sync                 # manually re-sync all guardrail files
harness sync --watch         # auto-sync on config changes
harness sync --check         # CI mode — check violations only
harness test                 # run tests with self-healing loop
```

## Usage Guide

### Step 0. Create a project (run in terminal)

```bash
harness init
```

Interactive prompts will ask for: project name, framework, package manager, language, architecture style, test runner, linter, formatter, AI persona, **which AI agent(s) to configure**, and **rules preset**.

### Step 1. Open the project in your AI agent

```bash
cd my-project
claude          # for Claude Code
# or open in Cursor, VS Code (Copilot), Windsurf, etc.
```

For Claude Code, the session-init hook automatically:
- Injects project config, architecture rules, and import restrictions
- Detects which SDLC stage is complete
- Tells the agent what to do next

### Step 2. Tell the agent what to build

```
"Build a pinball game"
```

The agent follows the SDLC pipeline automatically:

1. Runs `harness plan --scan`, generates a plan, imports with `harness plan --from`
2. Runs `harness analyze --scan`, generates domain analysis, imports with `harness analyze --from`
3. Runs `harness design --scan`, generates design contracts, imports with `harness design --from`
4. Creates files via `harness generate <type> <name>`, then implements
5. Tests with `harness test` (auto-retries on failure via self-healing)

### What happens automatically (Claude Code)

| Hook | Trigger | What it does |
|------|---------|-------------|
| session-init | Session start | Injects project context + SDLC status + next step guidance |
| scaffold-guard | New file creation | Blocks manual file creation, suggests `harness generate` |
| scope-guard | Any file write/edit | Blocks writes outside allowed scopes |
| post-write | After file write/edit | Checks import violations + test file companion |
| config-sync | `harness.config.json` change | Auto re-syncs all guardrail files |

### Tips

- **SDLC commands have 3 modes:** interactive (human in terminal), `--scan` (JSON output for AI), `--from` (JSON import for AI)
- **`harness init`** has 2 modes: interactive (human in terminal), `--from` (AI agent imports config JSON)
- **`harness sync`** is not a stage — it's a utility that re-generates all guardrail files. Runs automatically via hooks.
- **`harness design --check`** verifies all planned features have design artifacts before implementation.
- For **non-Claude agents** (Cursor, Copilot, etc.), there are no hooks — rules are injected as text in agent config files. The agent follows them voluntarily.

## Applying to an Existing Project

`harness init .` auto-detects existing projects and switches to **adopt mode** — it scans your setup and only generates harness config + AI agent files. It does NOT touch your existing husky, lint-staged, ESLint, or directory structure.

### Option A: Interactive (human in terminal)

```bash
# in your existing project root
pnpm add -D @wonseok-han/harness-core
harness init .
```

Harness auto-detects your framework, package manager, linter, test runner, and architecture — then generates `harness.config.json` only. No adapter files are generated yet.

```
🔧 Existing project detected — adopting harness

Detected:
  Framework: nextjs | PM: pnpm | Language: typescript
  Linter: eslint | Formatter: prettier | Test: vitest
  Architecture: fsd | Monorepo: true

✅ harness.config.json

🎉 Harness adopted successfully!

Next steps:
  1. Customize rules in harness.config.json
     rules.codingStandards, rules.fileNaming, rules.scaffolderTypes, rules.testScope
  2. Generate adapter files: harness sync
```

### Option B: AI agent workflow (detect → edit → sync)

Both humans and AI agents follow the same flow:

```bash
# 1. Auto-detect + generate harness.config.json (config only, no adapter files)
harness init .

# 2. Customize rules in harness.config.json (human or AI agent)
#    (coding standards, file naming, scaffold types, test scope, etc.)

# 3. Re-generate adapter files with updated config
harness sync
```

For new projects, AI agents can use `--from` with a pre-built config:

```bash
# Creates project directory, installs deps, generates all files
harness init my-app --from harness.config.json
```

### What adopt mode does vs doesn't

| `harness init .` creates | `harness sync` creates | Neither touches |
|--------------------------|----------------------|----------------|
| `harness.config.json` | `.claude/rules/harness-*.mdc` | Existing `CLAUDE.md` / `.claude/CLAUDE.md` |
| | `.cursor/rules/harness-*.mdc` | Existing `.github/copilot-instructions.md` |
| | `.claude/hooks/` + settings | Existing `.windsurfrules` |
| | `.husky/` + `.lintstagedrc.json` | Existing `CONVENTIONS.md` / `.aider.conf.yml` |
| | | Existing ESLint / Prettier config |
| | | Existing directory structure |
| | | `package.json` dependencies |

**Existing file strategy:** Claude and Cursor use modular rules (`*.mdc` with `alwaysApply: true`) so harness rules coexist with your existing config. Other agents skip file generation if their config file already exists.

**Why two steps?** `harness init .` generates config from auto-detection — these are starting values. You (or your AI agent) should review and customize the config before `harness sync` generates the actual adapter files.

### After adoption

```bash
harness sync --watch                 # auto-sync on config changes
harness generate feature view-keys   # scaffold with custom types
harness test                         # run tests with self-healing
```

### Tips for existing projects

- Set `enforceIndexGen: false` if you use an external index generator (e.g., `indexgen-cli`)
- Adjust `agent.allowedScopes` for monorepo paths (e.g., `apps/space/src/**/*`)
- Add team coding standards to `rules.codingStandards` so AI agents follow them
- Narrow `rules.testScope.include` to directories that actually need tests
- Add custom `rules.scaffolderTypes` for your architecture (FSD → feature/entity/widget)

### Monorepo note

Place `harness.config.json` at the **workspace root**. Adjust `allowedScopes` to cover all relevant packages. Claude Code hooks (`.claude/`) only work at the project root — they cannot be per-package.

## Supported AI Agents

`harness init` asks which AI agent(s) to configure. Multiple agents can be selected simultaneously.

| Agent | Generated Files | Existing file preserved? | Auto-enforcement |
|-------|----------------|-------------------------|-----------------|
| **Claude Code** | `.claude/rules/harness-*.mdc` + `.claude/hooks/` + `.claude/settings.json` | `CLAUDE.md` / `.claude/CLAUDE.md` | Hooks + modular rules (alwaysApply) |
| **Cursor** | `.cursor/rules/harness-*.mdc` | `.cursorrules` (deprecated) | Modular rules (alwaysApply) |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Yes — skipped if exists | Custom instructions |
| **Windsurf** | `.windsurfrules` | Yes — skipped if exists | Rules file |
| **Aider** | `CONVENTIONS.md` + `.aider.conf.yml` | Yes — each skipped if exists | auto-lint, auto-test |
| **Generic** | `AI_CONTEXT.md` | Yes — skipped if exists | Feed to any AI agent |

## What It Does

### 4 Core Engines

| Engine | Purpose |
|--------|---------|
| **Auto-Discovery** | Scans `package.json`, `tsconfig.json`, lock files to detect framework, package manager, test runner, linter, formatter |
| **Policy & Hook Orchestrator** | Enforces architecture rules via agent-specific configs, generates Husky hooks, checks forbidden imports |
| **Universal Agent Tools** | Safe scaffolding (5 built-in + custom types), JSON/ENV/i18n safe editing, file scope guards for AI agents |
| **Log Transpiler** | Converts raw build/lint/test errors into structured Markdown+JSON reports for AI self-healing |

### SDLC Pipeline (5 stages + setup)

| Stage | Command | Purpose |
|-------|---------|---------|
| 0. Setup | `harness init` | Project scaffolding + config + AI agent integration |
| 1. Plan | `harness plan` | Features, priorities, milestones |
| 2. Analyze | `harness analyze` | Domain glossary + feature specs |
| 3. Design | `harness design` | Interfaces, mocks, API contracts |
| 4. Develop | `harness generate` | Scaffold + implement (scaffolder enforced) |
| 5. Test | `harness test` | Test-first guard + self-healing loop |

`harness sync` runs automatically via hooks or manually to re-sync guardrail files.

## Configuration

`harness.config.json` controls everything. See [docs/configuration.md](docs/configuration.md) for the full reference.

```json
{
  "project": {
    "name": "my-app",
    "framework": "nextjs",
    "packageManager": "pnpm",
    "language": "typescript"
  },
  "architecture": {
    "style": "fsd",
    "enforceIndexGen": true,
    "forbiddenImports": {
      "shared/*": ["features/*", "entities/*"],
      "entities/*": ["features/*"]
    }
  },
  "development": {
    "linter": "eslint",
    "formatter": "prettier",
    "styling": "tailwind-v4"
  },
  "testing": {
    "runner": "vitest",
    "minCoverage": { "statements": 80, "branches": 75, "functions": 80, "lines": 80 },
    "requireTestFileWithImplementation": true
  },
  "agent": {
    "persona": "senior-frontend-developer",
    "allowedScopes": ["src/**/*", "tests/**/*"],
    "adapters": ["claude", "cursor"]
  },
  "rules": {
    "fileNaming": { "components": "PascalCase", "utils": "camelCase", "testSuffix": ".test" },
    "codingStandards": [
      { "id": "no-enum", "description": "Use as const instead of enum", "severity": "error" },
      { "id": "no-any", "description": "Use unknown instead of any", "severity": "error" }
    ],
    "scaffolderTypes": {
      "feature": { "directory": "src/features", "naming": "kebab-case" }
    }
  }
}
```

### Rules — Injectable Conventions

The `rules` section allows you to customize conventions without modifying harness internals. Rules are injected into all AI agent context files.

| Field | Purpose | Example |
|-------|---------|---------|
| `fileNaming` | Naming convention per type | `{ "components": "kebab-case" }` |
| `codingStandards` | Custom rules for AI agents | `[{ "id": "no-enum", "description": "Use as const" }]` |
| `testScope` | Which files need test companions | `{ "include": ["src/hooks/**/*.ts"] }` |
| `scaffolderTypes` | Custom scaffold types | `{ "feature": { "directory": "src/features" } }` |

During `harness init`, choose from presets:

| Preset | Description |
|--------|-------------|
| **Default** | Opinionated defaults (no-enum, no-any) |
| **Strict** | All recommended standards (no-enum, no-any, no-non-null-assertion, strict-equality, sort-imports) |
| **Minimal** | No coding standards enforced |
| **Custom** | Pick individual rules interactively |

Architecture-aware scaffolder types are auto-added: FSD gets `feature`/`entity`/`widget`, Clean gets `usecase`/`repository`.

See [docs/configuration.md](docs/configuration.md) for full `rules` reference.

### Agent-Driven Mode

Every stage supports `--scan` and `--from` for non-interactive AI agent usage:

```bash
# Pattern: scan → agent generates JSON → import
harness plan --scan          # outputs project context as JSON
harness plan --from plan.json    # imports plan

harness analyze --scan       # outputs project + plan context
harness analyze --from analysis.json   # imports glossary + feature specs

harness design --scan        # outputs plan + specs context
harness design --from design.json   # generates interfaces, mocks, design docs

harness design --check       # verify all planned features have design artifacts
```

## Supported Stack

### AI Agents

| Agent | Config Files | Hook Enforcement |
|-------|-------------|-----------------|
| Claude Code | `CLAUDE.md`, `.claude/rules/harness-*.mdc`, `.claude/hooks/*`, `.claude/settings.json` | PreToolUse, PostToolUse, SessionStart, FileChanged |
| Cursor | `.cursor/rules/harness-*.mdc` | Rules always applied |
| GitHub Copilot | `.github/copilot-instructions.md` | Custom instructions |
| Windsurf | `.windsurfrules` | Rules file |
| Aider | `CONVENTIONS.md`, `.aider.conf.yml` | auto-lint, auto-test |
| Generic | `AI_CONTEXT.md` | Feed to any agent manually |

### Frameworks

| Category | Supported |
|----------|-----------|
| Frontend | Next.js, Nuxt, SvelteKit, Remix, Astro, Vite+React, Vite+Vue |
| Backend | Express, Fastify, NestJS |
| None | Vanilla (unknown) |

### Languages

TypeScript, JavaScript

### Architecture Styles

| Style | Directory Structure |
|-------|-------------------|
| Modular | `components/`, `hooks/`, `utils/`, `services/`, `models/`, `types/` |
| FSD (Feature-Sliced Design) | `app/`, `pages/`, `widgets/`, `features/`, `entities/`, `shared/` |
| Clean Architecture | `domain/`, `application/`, `infrastructure/`, `presentation/` |
| MVC | `models/`, `views/`, `controllers/`, `routes/` |
| Flat | No enforced structure |
| Custom | User-defined |

### Tooling

| Category | Supported |
|----------|-----------|
| Package Managers | npm, yarn, pnpm, bun |
| Test Runners | Vitest, Jest, Mocha, Playwright |
| Linters | ESLint, Biome |
| Formatters | Prettier, Biome |
| Styling | Tailwind CSS v3/v4, styled-components, Emotion, Sass, CSS Modules |

## Programmatic API

```typescript
import {
  discoverProject,
  loadConfig,
  transpileLog,
  scaffold,
  checkForbiddenImports,
  safeEditJson,
  getAdapter,
  getAllAdapterTypes,
} from '@wonseok-han/harness-core';

// Discover project environment
const { config, detected } = await discoverProject('./my-project');

// Generate AI agent config files
const claude = getAdapter('claude');
const result = await claude.generate('./my-project', config);

// Transpile error logs for AI self-healing
const report = transpileLog(rawErrorOutput, 'test');
console.log(report.markdown);

// Safe JSON editing
await safeEditJson('./package.json', (data) => ({ ...data, version: '2.0.0' }));
```