import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectPackageManager,
  detectFramework,
  detectLanguage,
  detectTestRunner,
  detectLinter,
  detectFormatter,
  detectStyling,
  detectProjectName,
  detectMonorepo,
} from '../../src/engines/discovery/index.js';
import { discoverProject } from '../../src/engines/discovery/index.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'harness-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('detectPackageManager', () => {
  it('should detect pnpm from lock file', async () => {
    await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');
    expect(await detectPackageManager(tempDir)).toBe('pnpm');
  });

  it('should detect yarn from lock file', async () => {
    await writeFile(join(tempDir, 'yarn.lock'), '');
    expect(await detectPackageManager(tempDir)).toBe('yarn');
  });

  it('should detect bun from lock file', async () => {
    await writeFile(join(tempDir, 'bun.lockb'), '');
    expect(await detectPackageManager(tempDir)).toBe('bun');
  });

  it('should default to npm', async () => {
    expect(await detectPackageManager(tempDir)).toBe('npm');
  });
});

describe('detectFramework', () => {
  it('should detect nextjs', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ dependencies: { next: '^14.0.0' } }),
    );
    expect(await detectFramework(tempDir)).toBe('nextjs');
  });

  it('should detect nuxt', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ dependencies: { nuxt: '^3.0.0' } }),
    );
    expect(await detectFramework(tempDir)).toBe('nuxt');
  });

  it('should detect express', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ dependencies: { express: '^4.0.0' } }),
    );
    expect(await detectFramework(tempDir)).toBe('express');
  });

  it('should return unknown when no package.json', async () => {
    expect(await detectFramework(tempDir)).toBe('unknown');
  });

  it('should return unknown when no known framework', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ dependencies: {} }),
    );
    expect(await detectFramework(tempDir)).toBe('unknown');
  });
});

describe('detectLanguage', () => {
  it('should detect typescript from tsconfig.json', async () => {
    await writeFile(join(tempDir, 'tsconfig.json'), '{}');
    expect(await detectLanguage(tempDir)).toBe('typescript');
  });

  it('should detect javascript from jsconfig.json', async () => {
    await writeFile(join(tempDir, 'jsconfig.json'), '{}');
    expect(await detectLanguage(tempDir)).toBe('javascript');
  });

  it('should default to javascript', async () => {
    expect(await detectLanguage(tempDir)).toBe('javascript');
  });
});

describe('detectTestRunner', () => {
  it('should detect vitest', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }),
    );
    expect(await detectTestRunner(tempDir)).toBe('vitest');
  });

  it('should detect jest', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ devDependencies: { jest: '^29.0.0' } }),
    );
    expect(await detectTestRunner(tempDir)).toBe('jest');
  });
});

describe('detectLinter', () => {
  it('should detect biome', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ devDependencies: { '@biomejs/biome': '^1.0.0' } }),
    );
    expect(await detectLinter(tempDir)).toBe('biome');
  });

  it('should default to eslint', async () => {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ devDependencies: {} }));
    expect(await detectLinter(tempDir)).toBe('eslint');
  });
});

describe('detectFormatter', () => {
  it('should detect prettier', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ devDependencies: { prettier: '^3.0.0' } }),
    );
    expect(await detectFormatter(tempDir)).toBe('prettier');
  });
});

describe('detectStyling', () => {
  it('should detect tailwind v4', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ dependencies: { tailwindcss: '^4.0.0' } }),
    );
    expect(await detectStyling(tempDir)).toBe('tailwind-v4');
  });

  it('should detect styled-components', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ dependencies: { 'styled-components': '^6.0.0' } }),
    );
    expect(await detectStyling(tempDir)).toBe('styled-components');
  });
});

describe('detectProjectName', () => {
  it('should read name from package.json', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'my-awesome-app' }),
    );
    expect(await detectProjectName(tempDir)).toBe('my-awesome-app');
  });

  it('should fall back to directory name', async () => {
    const name = await detectProjectName(tempDir);
    expect(name).toBeTruthy();
  });
});

describe('detectMonorepo', () => {
  it('should detect pnpm workspace', async () => {
    await writeFile(join(tempDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*');
    expect(await detectMonorepo(tempDir)).toBe(true);
  });

  it('should return false for non-monorepo', async () => {
    expect(await detectMonorepo(tempDir)).toBe(false);
  });
});

describe('discoverProject', () => {
  it('should return complete config for a Next.js project', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-nextjs-app',
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
        devDependencies: { vitest: '^1.0.0', prettier: '^3.0.0' },
      }),
    );
    await writeFile(join(tempDir, 'tsconfig.json'), '{}');

    const result = await discoverProject(tempDir);

    expect(result.config.project.framework).toBe('nextjs');
    expect(result.config.project.language).toBe('typescript');
    expect(result.config.project.name).toBe('test-nextjs-app');
    expect(result.config.testing.runner).toBe('vitest');
    expect(result.detected['framework']).toBe('nextjs');
  });
});
