import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter, getAllAdapterTypes, getAdapterChoices } from '../../src/engines/adapters/index.js';
import { createDefaultConfig } from '../../src/config/defaults.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'harness-adapters-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('adapter registry', () => {
  it('should return all 6 adapter types', () => {
    const types = getAllAdapterTypes();
    expect(types).toHaveLength(6);
    expect(types).toContain('claude');
    expect(types).toContain('cursor');
    expect(types).toContain('copilot');
    expect(types).toContain('windsurf');
    expect(types).toContain('aider');
    expect(types).toContain('generic');
  });

  it('should return adapter choices with name and value', () => {
    const choices = getAdapterChoices();
    expect(choices).toHaveLength(6);
    for (const choice of choices) {
      expect(choice).toHaveProperty('name');
      expect(choice).toHaveProperty('value');
      expect(typeof choice.name).toBe('string');
    }
  });

  it('should return correct adapter for each type', () => {
    for (const type of getAllAdapterTypes()) {
      const adapter = getAdapter(type);
      expect(adapter.type).toBe(type);
      expect(typeof adapter.name).toBe('string');
      expect(typeof adapter.generate).toBe('function');
    }
  });
});

describe('cursor adapter', () => {
  it('should generate .cursorrules and .cursor/rules/*.mdc', async () => {
    const config = createDefaultConfig({
      project: { name: 'test-app', framework: 'nextjs', packageManager: 'pnpm', language: 'typescript' },
    });
    const adapter = getAdapter('cursor');
    const result = await adapter.generate(tempDir, config);

    expect(result.files).toHaveProperty('.cursorrules');
    expect(result.files).toHaveProperty('.cursor/rules/conventions.mdc');
    expect(result.files).toHaveProperty('.cursor/rules/workflow.mdc');

    expect(result.files['.cursorrules']).toContain('test-app');
    expect(result.files['.cursor/rules/conventions.mdc']).toContain('alwaysApply: true');

    const written = await readFile(join(tempDir, '.cursorrules'), 'utf-8');
    expect(written).toBe(result.files['.cursorrules']);
  });
});

describe('copilot adapter', () => {
  it('should generate .github/copilot-instructions.md', async () => {
    const config = createDefaultConfig({
      project: { name: 'copilot-app', framework: 'vite-react', packageManager: 'npm', language: 'typescript' },
    });
    const adapter = getAdapter('copilot');
    const result = await adapter.generate(tempDir, config);

    expect(result.files).toHaveProperty('.github/copilot-instructions.md');
    expect(result.files['.github/copilot-instructions.md']).toContain('copilot-app');
    expect(result.files['.github/copilot-instructions.md']).toContain('harness generate');

    const written = await readFile(join(tempDir, '.github', 'copilot-instructions.md'), 'utf-8');
    expect(written).toBe(result.files['.github/copilot-instructions.md']);
  });
});

describe('windsurf adapter', () => {
  it('should generate .windsurfrules', async () => {
    const config = createDefaultConfig();
    const adapter = getAdapter('windsurf');
    const result = await adapter.generate(tempDir, config);

    expect(result.files).toHaveProperty('.windsurfrules');
    expect(result.files['.windsurfrules']).toContain('harness generate');

    const written = await readFile(join(tempDir, '.windsurfrules'), 'utf-8');
    expect(written).toBe(result.files['.windsurfrules']);
  });
});

describe('aider adapter', () => {
  it('should generate CONVENTIONS.md and .aider.conf.yml', async () => {
    const config = createDefaultConfig({
      development: { linter: 'eslint', formatter: 'prettier', styling: '' },
    });
    const adapter = getAdapter('aider');
    const result = await adapter.generate(tempDir, config);

    expect(result.files).toHaveProperty('CONVENTIONS.md');
    expect(result.files).toHaveProperty('.aider.conf.yml');

    expect(result.files['.aider.conf.yml']).toContain('auto-lint: true');
    expect(result.files['.aider.conf.yml']).toContain('auto-test: true');
    expect(result.files['.aider.conf.yml']).toContain('eslint');
  });

  it('should use biome lint command when configured', async () => {
    const config = createDefaultConfig({
      development: { linter: 'biome', formatter: 'biome', styling: '' },
    });
    const adapter = getAdapter('aider');
    const result = await adapter.generate(tempDir, config);

    expect(result.files['.aider.conf.yml']).toContain('biome check');
  });
});

describe('generic adapter', () => {
  it('should generate AI_CONTEXT.md', async () => {
    const config = createDefaultConfig({
      project: { name: 'gen-app', framework: 'express', packageManager: 'npm', language: 'typescript' },
    });
    const adapter = getAdapter('generic');
    const result = await adapter.generate(tempDir, config);

    expect(result.files).toHaveProperty('AI_CONTEXT.md');
    expect(result.files['AI_CONTEXT.md']).toContain('gen-app');
    expect(result.files['AI_CONTEXT.md']).toContain('harness-core');

    const written = await readFile(join(tempDir, 'AI_CONTEXT.md'), 'utf-8');
    expect(written).toBe(result.files['AI_CONTEXT.md']);
  });
});

describe('shared content', () => {
  it('should include project context in all adapters', async () => {
    const config = createDefaultConfig({
      project: { name: 'shared-test', framework: 'nextjs', packageManager: 'pnpm', language: 'typescript' },
      architecture: { style: 'fsd', enforceIndexGen: true, forbiddenImports: { 'features/*': ['pages/*'] } },
    });

    const nonClaude = ['cursor', 'copilot', 'windsurf', 'aider', 'generic'] as const;
    for (const type of nonClaude) {
      const adapter = getAdapter(type);
      const result = await adapter.generate(tempDir, config);
      const allContent = Object.values(result.files).join('\n');

      expect(allContent).toContain('shared-test');
      expect(allContent).toContain('fsd');
      expect(allContent).toContain('features/*');
      expect(allContent).toContain('harness generate');
    }
  });
});
