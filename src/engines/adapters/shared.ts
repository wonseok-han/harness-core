import type { HarnessConfig } from '../../types/index.js';

export function buildProjectContext(config: HarnessConfig): string {
  const lines: string[] = [];

  lines.push(`# ${config.project.name}`);
  lines.push('');
  lines.push(`Framework: ${config.project.framework} | Language: ${config.project.language} | PM: ${config.project.packageManager}`);
  lines.push(`Architecture: ${config.architecture.style} | Test: ${config.testing.runner}`);
  lines.push('');

  return lines.join('\n');
}

export function buildConventionRules(config: HarnessConfig): string {
  const lines: string[] = [];

  lines.push('## Conventions');
  lines.push('');
  lines.push(`- Architecture style: ${config.architecture.style}`);
  if (config.architecture.enforceIndexGen) {
    lines.push('- Every directory under src/ MUST have an index.ts barrel export');
  }
  lines.push('');

  if (Object.keys(config.architecture.forbiddenImports).length > 0) {
    lines.push('## Import Restrictions');
    for (const [source, forbidden] of Object.entries(config.architecture.forbiddenImports)) {
      lines.push(`- \`${source}\` MUST NOT import from: ${forbidden.map((f) => `\`${f}\``).join(', ')}`);
    }
    lines.push('');
  }

  lines.push('## File Naming');
  lines.push('- Components: PascalCase (UserProfile.tsx)');
  lines.push('- Hooks: camelCase with use prefix (useAuth.ts)');
  lines.push('- Utils/Services: camelCase (formatDate.ts)');
  lines.push('- Tests: same name + .test suffix (UserProfile.test.tsx)');
  lines.push('');

  return lines.join('\n');
}

export function buildWorkflowRules(config: HarnessConfig): string {
  const lines: string[] = [];

  lines.push('## SDLC Pipeline');
  lines.push('');
  lines.push('Follow this order strictly:');
  lines.push('1. `harness plan --scan` → `--from` — Define features, priorities, milestones');
  lines.push('2. `harness analyze --scan` → `--from` — Domain glossary + feature specs');
  lines.push('3. `harness design --scan` → `--from` — Interfaces, mocks, API contracts');
  lines.push('4. `harness generate <type> <name>` — Scaffold then implement');
  lines.push('5. `harness test` — Test with self-healing');
  lines.push('');
  lines.push('**MANDATORY: When creating new files, ALWAYS run the scaffolder command first:**');
  lines.push('```');
  lines.push('harness generate <type> <name>');
  lines.push('```');
  lines.push('Available types: component, hook, util, service, model.');
  lines.push('');
  lines.push('Do NOT create files manually. The scaffolder ensures:');
  lines.push('- Correct directory placement per architecture style');
  lines.push('- Proper naming conventions (PascalCase/camelCase)');
  lines.push('- Automatic barrel export (index.ts) generation');
  lines.push('');
  lines.push('After scaffolding, you may Edit the generated files to add implementation.');
  lines.push('');

  lines.push('## Testing');
  lines.push(`- Runner: ${config.testing.runner}`);
  lines.push(`- Min coverage: statements=${config.testing.minCoverage.statements}%, branches=${config.testing.minCoverage.branches}%`);
  if (config.testing.requireTestFileWithImplementation) {
    lines.push('- Every implementation file MUST have a corresponding .test file');
  }
  lines.push('- Run `harness test` for test execution with self-healing feedback');
  lines.push('');

  lines.push('## Agent Scope');
  lines.push(`- Persona: ${config.agent.persona}`);
  lines.push(`- Allowed scopes: ${config.agent.allowedScopes.join(', ')}`);
  lines.push('- Do NOT modify files outside allowed scopes');
  lines.push('');

  return lines.join('\n');
}

export function buildCodingPrinciplesSection(): string {
  const lines: string[] = [];

  lines.push('## Coding Principles');
  lines.push('');
  lines.push('Based on [Andrej Karpathy\'s guidelines](https://github.com/multica-ai/andrej-karpathy-skills).');
  lines.push('');
  lines.push('1. **Think Before Coding** — State assumptions explicitly. If uncertain, ask. Don\'t pick silently among multiple interpretations.');
  lines.push('2. **Simplicity First** — Minimum code that solves the problem. No speculative features, no premature abstractions, no error handling for impossible scenarios.');
  lines.push('3. **Surgical Changes** — Touch only what you must. Don\'t improve adjacent code. Match existing style. Every changed line should trace to the request.');
  lines.push('4. **Goal-Driven Execution** — Define verifiable success criteria before coding. Loop until verified.');
  lines.push('');

  return lines.join('\n');
}

export function buildToolsSection(config: HarnessConfig): string {
  const lines: string[] = [];

  lines.push('## Tools');
  lines.push(`- Linter: ${config.development.linter}`);
  lines.push(`- Formatter: ${config.development.formatter}`);
  if (config.development.styling) {
    lines.push(`- Styling: ${config.development.styling}`);
  }
  lines.push('');

  return lines.join('\n');
}
