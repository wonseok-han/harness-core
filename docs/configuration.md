# Configuration Reference

`harness.config.json` is the single source of truth for the entire harness framework. It controls project settings, architecture rules, development tools, testing policies, and AI agent integration.

This file is created automatically by `harness init` and can be edited manually at any time. Changes are picked up by `harness sync` (or automatically via the `config-sync` hook in Claude Code).

## Schema

The JSON Schema file is located at `schema/harness.config.schema.json`.

To enable editor validation, add this to the top of your config file:

```json
{
  "$schema": "./schema/harness.config.schema.json"
}
```

## Sections

### `project` (required)

Basic project metadata. Used by auto-discovery and all adapters.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | Y | `"my-project"` | Project name. Used in generated docs and agent context. |
| `framework` | `Framework` | Y | `"unknown"` | Web framework. Determines scaffolding commands, dev/build scripts, and directory conventions. |
| `packageManager` | `PackageManager` | Y | `"npm"` | Package manager. Used for `install`, `run`, and lock file detection. |
| `language` | `Language` | Y | `"typescript"` | Primary language. Affects file extensions, lint rules, and scaffolder templates. |

**Framework values:**

| Value | Category | Description |
|-------|----------|-------------|
| `nextjs` | Frontend | Next.js (App Router / Pages Router) |
| `nuxt` | Frontend | Nuxt 3 (Vue) |
| `svelte` | Frontend | SvelteKit |
| `remix` | Frontend | Remix |
| `astro` | Frontend | Astro |
| `vite-react` | Frontend | Vite + React |
| `vite-vue` | Frontend | Vite + Vue |
| `express` | Backend | Express.js |
| `fastify` | Backend | Fastify |
| `nest` | Backend | NestJS |
| `unknown` | None | No framework detected or vanilla project |

**PackageManager values:** `npm`, `yarn`, `pnpm`, `bun`

**Language values:** `typescript`, `javascript`

---

### `architecture`

Controls directory structure enforcement and import restrictions.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `style` | `ArchitectureStyle` | N | `"modular"` | Architecture pattern. Determines expected directory structure and scaffolder behavior. |
| `enforceIndexGen` | `boolean` | N | `true` | When `true`, every directory under `src/` must have an `index.ts` barrel export. |
| `forbiddenImports` | `Record<string, string[]>` | N | `{}` | Import restriction rules. Key = source glob, value = array of forbidden target globs. |

**ArchitectureStyle values:**

| Value | Directory Structure | Use Case |
|-------|-------------------|----------|
| `modular` | `components/`, `hooks/`, `utils/`, `services/`, `models/`, `types/` | General purpose, most React/Vue projects |
| `fsd` | `app/`, `pages/`, `widgets/`, `features/`, `entities/`, `shared/` | Feature-Sliced Design, large frontend apps |
| `clean` | `domain/`, `application/`, `infrastructure/`, `presentation/` | Clean Architecture, DDD-oriented |
| `mvc` | `models/`, `views/`, `controllers/`, `routes/` | MVC pattern, backend APIs |
| `flat` | No enforced structure | Small projects, prototypes |
| `custom` | User-defined | When none of the above fits |

**forbiddenImports example:**

```json
{
  "forbiddenImports": {
    "features/*": ["pages/*", "app/*"],
    "entities/*": ["features/*", "pages/*"],
    "shared/*": ["features/*", "entities/*", "pages/*"]
  }
}
```

This means: files under `features/` cannot import from `pages/` or `app/`. Violations are detected by `harness sync --check` and the `post-write` hook.

---

### `development`

Development tooling configuration. Used by hook generators and adapter rules.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `linter` | `string` | N | `"eslint"` | Linter tool. Supported: `eslint`, `biome`. |
| `formatter` | `string` | N | `"prettier"` | Formatter tool. Supported: `prettier`, `biome`. |
| `styling` | `string` | N | `""` | CSS framework. Supported: `tailwind-v3`, `tailwind-v4`, `styled-components`, `emotion`, `sass`, `css-modules`. Empty string for none. |

When both `linter` and `formatter` are set to `biome`, a single `biome check --fix` command is used instead of separate lint + format steps.

---

### `testing`

Testing policies. Enforced via hooks, scaffolder, and the `harness test` command.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `runner` | `string` | N | `"vitest"` | Test runner. Supported: `vitest`, `jest`, `mocha`, `playwright`. |
| `minCoverage` | `CoverageThresholds` | N | See below | Minimum coverage thresholds. |
| `requireTestFileWithImplementation` | `boolean` | N | `true` | When `true`, the `post-write` hook warns if an implementation file has no corresponding `.test` file. |

**CoverageThresholds defaults:**

| Metric | Default |
|--------|---------|
| `statements` | `80` |
| `branches` | `75` |
| `functions` | `80` |
| `lines` | `80` |

---

### `agent`

AI agent configuration. Controls which adapters generate config files and what scope the agent operates in.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `persona` | `string` | N | `"senior-developer"` | AI persona hint. Injected into agent context to guide tone and expertise level. |
| `allowedScopes` | `string[]` | N | `["src/**/*", "tests/**/*"]` | Glob patterns for files the AI agent is allowed to modify. The `scope-guard` hook blocks writes outside these paths. |
| `adapters` | `AgentType[]` | N | `["generic"]` | Which AI agent adapters to generate config files for. Multiple can be selected. |

**AgentType values:**

| Value | Generated Files | Enforcement |
|-------|----------------|-------------|
| `claude` | `CLAUDE.md`, `.claude/*.md`, `.claude/hooks/*`, `.claude/settings.json` | Hooks (PreToolUse, PostToolUse, SessionStart, FileChanged) |
| `cursor` | `.cursorrules`, `.cursor/rules/*.mdc` | Rules always applied |
| `copilot` | `.github/copilot-instructions.md` | Custom instructions |
| `windsurf` | `.windsurfrules` | Rules file |
| `aider` | `CONVENTIONS.md`, `.aider.conf.yml` | auto-lint, auto-test |
| `generic` | `AI_CONTEXT.md` | Manual — feed to any agent |

---

### `rules`

Injectable convention rules. Override defaults or add project-specific standards that get injected into all AI agent context files.

#### `rules.fileNaming`

Override file naming conventions per scaffold type.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `components` | `NamingConvention` | `"PascalCase"` | Component file naming (e.g., `UserProfile.tsx` vs `user-profile.tsx`) |
| `hooks` | `NamingConvention` | `"camelCase"` | Hook file naming |
| `utils` | `NamingConvention` | `"camelCase"` | Utility file naming |
| `services` | `NamingConvention` | `"camelCase"` | Service file naming |
| `models` | `NamingConvention` | `"camelCase"` | Model file naming |
| `testSuffix` | `string` | `".test"` | Test file suffix (`.test` or `.spec`) |

**NamingConvention values:** `PascalCase`, `camelCase`, `kebab-case`, `snake_case`

#### `rules.codingStandards`

Custom coding rules injected into AI agent context. These are text-based rules that the AI agent follows — not enforced by hooks, but always visible in the generated instruction files.

```json
{
  "codingStandards": [
    { "id": "no-enum", "description": "Do not use enum. Use as const instead", "severity": "error" },
    { "id": "korean-comments", "description": "All code comments must be in Korean", "severity": "error" },
    { "id": "spdx-header", "description": "SPDX license header required on every source file", "severity": "warn" },
    { "id": "no-inline-styles", "description": "Use Tailwind CSS classes only, no inline styles", "severity": "error" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Y | Short identifier (e.g., `no-enum`, `korean-comments`) |
| `description` | `string` | Y | Human-readable rule text shown to AI agent |
| `severity` | `"error" \| "warn" \| "info"` | N | Visual indicator in generated output (default: `"error"`) |

#### `rules.testScope`

Control which files require test companions. By default, all `src/**/*.ts` files (except index, types, .d.ts) need tests. Use this to narrow the scope.

```json
{
  "testScope": {
    "include": ["src/**/hooks/**/*.ts", "src/**/lib/**/*.ts"],
    "exclude": ["src/**/index.ts"]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `include` | `string[]` | Glob patterns for files that need tests |
| `exclude` | `string[]` | Glob patterns to exclude from test requirement |

#### `rules.scaffolderTypes`

Add custom scaffold types or override built-in type directories. Custom types are available via `harness generate <type> <name>`.

```json
{
  "scaffolderTypes": {
    "feature": { "directory": "src/features", "naming": "kebab-case" },
    "entity": { "directory": "src/entities", "naming": "kebab-case" },
    "widget": { "directory": "src/widgets", "naming": "kebab-case" }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `directory` | `string` | Y | Target directory relative to project root |
| `naming` | `NamingConvention` | N | Naming convention for this type (overrides `fileNaming` defaults) |

Built-in types (`component`, `hook`, `util`, `service`, `model`) can also be overridden by specifying them here.

---

## Full Example

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
    "enforceIndexGen": false,
    "forbiddenImports": {
      "shared/*": ["features/*", "entities/*", "pages/*", "widgets/*"],
      "entities/*": ["features/*", "pages/*", "widgets/*"],
      "features/*": ["pages/*", "widgets/*"]
    }
  },
  "development": {
    "linter": "eslint",
    "formatter": "prettier",
    "styling": "tailwind-v4"
  },
  "testing": {
    "runner": "vitest",
    "minCoverage": {
      "statements": 80,
      "branches": 75,
      "functions": 80,
      "lines": 80
    },
    "requireTestFileWithImplementation": true
  },
  "agent": {
    "persona": "senior-frontend-developer",
    "allowedScopes": ["src/**/*", "tests/**/*"],
    "adapters": ["claude", "cursor"]
  },
  "rules": {
    "fileNaming": {
      "components": "kebab-case",
      "utils": "kebab-case",
      "services": "kebab-case",
      "testSuffix": ".test"
    },
    "codingStandards": [
      { "id": "no-enum", "description": "Do not use enum. Use as const instead", "severity": "error" },
      { "id": "korean-comments", "description": "All code comments must be in Korean", "severity": "error" }
    ],
    "testScope": {
      "include": ["src/**/hooks/**/*.ts", "src/**/lib/**/*.ts"]
    },
    "scaffolderTypes": {
      "feature": { "directory": "src/features", "naming": "kebab-case" },
      "entity": { "directory": "src/entities", "naming": "kebab-case" },
      "widget": { "directory": "src/widgets", "naming": "kebab-case" }
    }
  }
}
```

## Auto-Discovery

When `harness init` runs, it scans the project to auto-detect values:

| Detected From | Fields Set |
|---------------|-----------|
| `package.json` name | `project.name` |
| `package.json` dependencies | `project.framework` |
| Lock file (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`) | `project.packageManager` |
| `tsconfig.json` existence | `project.language` |
| `package.json` devDependencies | `testing.runner`, `development.linter`, `development.formatter` |

Detected values are used as defaults in the interactive prompts. Manual overrides always take priority.
