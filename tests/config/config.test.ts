import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, validateConfig, createDefaultConfig } from '../../src/config/index.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'harness-config-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('createDefaultConfig', () => {
  it('should create config with sensible defaults', () => {
    const config = createDefaultConfig();

    expect(config.project.name).toBe('my-project');
    expect(config.project.framework).toBe('unknown');
    expect(config.project.packageManager).toBe('npm');
    expect(config.project.language).toBe('typescript');
    expect(config.testing.runner).toBe('vitest');
    expect(config.testing.minCoverage.statements).toBe(80);
    expect(config.agent.persona).toBe('senior-developer');
  });

  it('should merge overrides deeply', () => {
    const config = createDefaultConfig({
      project: {
        name: 'my-app',
        framework: 'nextjs',
        packageManager: 'pnpm',
        language: 'typescript',
      },
      testing: {
        runner: 'jest',
        minCoverage: { statements: 90, branches: 85, functions: 90, lines: 90 },
        requireTestFileWithImplementation: true,
      },
    });

    expect(config.project.name).toBe('my-app');
    expect(config.project.framework).toBe('nextjs');
    expect(config.testing.runner).toBe('jest');
    expect(config.testing.minCoverage.statements).toBe(90);
    expect(config.architecture.style).toBe('modular');
  });
});

describe('validateConfig', () => {
  it('should validate a valid config', () => {
    const config = createDefaultConfig();
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject config missing required project field', () => {
    const result = validateConfig({ architecture: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject config with invalid framework', () => {
    const result = validateConfig({
      project: {
        name: 'test',
        framework: 'invalid-framework',
        packageManager: 'npm',
        language: 'typescript',
      },
    });
    expect(result.valid).toBe(false);
  });
});

describe('loadConfig', () => {
  it('should load valid config from file', async () => {
    const config = createDefaultConfig({ project: { name: 'test-app', framework: 'nextjs', packageManager: 'pnpm', language: 'typescript' } });
    await writeFile(join(tempDir, 'harness.config.json'), JSON.stringify(config));

    const loaded = await loadConfig(tempDir);
    expect(loaded.project.name).toBe('test-app');
    expect(loaded.project.framework).toBe('nextjs');
  });

  it('should throw on missing config file', async () => {
    await expect(loadConfig(tempDir)).rejects.toThrow('Configuration file not found');
  });

  it('should throw on invalid config', async () => {
    await writeFile(
      join(tempDir, 'harness.config.json'),
      JSON.stringify({ project: { name: 'test', framework: 'bad' } }),
    );
    await expect(loadConfig(tempDir)).rejects.toThrow('Invalid harness.config.json');
  });
});
