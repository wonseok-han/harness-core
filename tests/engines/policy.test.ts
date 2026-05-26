import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkForbiddenImports,
  generateLintStagedConfig,
  generateClaudeRules,
  generateClaudeMd,
} from '../../src/engines/policy/index.js';
import { createDefaultConfig } from '../../src/config/defaults.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'harness-policy-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('checkForbiddenImports', () => {
  it('should detect forbidden imports', async () => {
    const srcDir = join(tempDir, 'src', 'features', 'auth');
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      join(srcDir, 'login.ts'),
      `import { something } from '../../pages/home';\n`,
    );

    const violations = await checkForbiddenImports(tempDir, {
      'features/*': ['pages/*'],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toContain('features/*');
  });

  it('should return empty for valid imports', async () => {
    const srcDir = join(tempDir, 'src', 'features', 'auth');
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      join(srcDir, 'login.ts'),
      `import { something } from '../../shared/utils';\n`,
    );

    const violations = await checkForbiddenImports(tempDir, {
      'features/*': ['pages/*'],
    });

    expect(violations).toHaveLength(0);
  });
});

describe('generateLintStagedConfig', () => {
  it('should generate eslint + prettier config', () => {
    const config = createDefaultConfig({
      development: { linter: 'eslint', formatter: 'prettier', styling: '' },
    });
    const rules = generateLintStagedConfig(config);

    expect(rules['*.{ts,tsx}']).toContain('eslint --fix');
    expect(rules['*']).toContain('prettier --write --ignore-unknown');
  });

  it('should generate biome-only config', () => {
    const config = createDefaultConfig({
      development: { linter: 'biome', formatter: 'biome', styling: '' },
    });
    const rules = generateLintStagedConfig(config);

    expect(rules['*.{ts,tsx}']).toContain('biome check --fix');
    expect(rules['*']).toBeUndefined();
  });
});

describe('generateClaudeRules', () => {
  it('should create CLAUDE.md and .claude/*.md files', async () => {
    const config = createDefaultConfig({
      architecture: {
        style: 'fsd',
        enforceIndexGen: true,
        forbiddenImports: { 'features/*': ['pages/*'] },
      },
    });

    const files = await generateClaudeRules(tempDir, config);

    // CLAUDE.md
    expect(files['CLAUDE.md']).toContain('fsd');
    const claudeMd = await readFile(join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toBe(files['CLAUDE.md']);

    // conventions.md
    expect(files['.claude/conventions.md']).toContain('features/*');
    expect(files['.claude/conventions.md']).toContain('barrel export');
    const conventions = await readFile(join(tempDir, '.claude', 'conventions.md'), 'utf-8');
    expect(conventions).toBe(files['.claude/conventions.md']);

    // tech-stack.md
    const techStack = await readFile(join(tempDir, '.claude', 'tech-stack.md'), 'utf-8');
    expect(techStack).toContain('vitest');

    // workflow.md
    const workflow = await readFile(join(tempDir, '.claude', 'workflow.md'), 'utf-8');
    expect(workflow).toContain('harness generate');
  });
});

describe('generateClaudeMd', () => {
  it('should create standalone CLAUDE.md file', async () => {
    const config = createDefaultConfig({
      project: { name: 'test-app', framework: 'nextjs', packageManager: 'pnpm', language: 'typescript' },
    });

    const content = await generateClaudeMd(tempDir, config);

    expect(content).toContain('test-app');
    expect(content).toContain('nextjs');
    expect(content).toContain('pnpm');

    const fileContent = await readFile(join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(fileContent).toBe(content);
  });
});
