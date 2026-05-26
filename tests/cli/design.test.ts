import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultConfig } from '../../src/config/defaults.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'harness-design-'));
  const config = createDefaultConfig({ project: { name: 'design-test', framework: 'nextjs', packageManager: 'npm', language: 'typescript' } });
  await writeFile(join(tempDir, 'harness.config.json'), JSON.stringify(config));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function runDesign(args: string[]): Promise<{ stdout: string; exitCode: number }> {
  const { runCommand } = await import('../../src/utils/exec.js');
  const cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');
  const result = await runCommand(`node ${cliPath} design ${args.join(' ')} --root ${tempDir}`, tempDir);
  return { stdout: result.stdout, exitCode: result.exitCode };
}

describe('design --scan', () => {
  it('should output JSON with project name and expected format', async () => {
    const { stdout } = await runDesign(['--scan']);
    const output = JSON.parse(stdout);

    expect(output.project).toBe('design-test');
    expect(output.instructions).toContain('harness design --from');
    expect(output.expectedFormat).toBeDefined();
    expect(output.expectedFormat.designs).toBeInstanceOf(Array);
  });

  it('should include existing plan when present', async () => {
    await mkdir(join(tempDir, 'docs'), { recursive: true });
    await writeFile(join(tempDir, 'docs', 'plan.json'), JSON.stringify({
      goal: 'test',
      features: [{ name: 'auth', priority: 'high', description: 'auth' }],
    }));

    const { stdout } = await runDesign(['--scan']);
    const output = JSON.parse(stdout);

    expect(output.plan).toBeDefined();
    expect(output.plan.features).toHaveLength(1);
  });

  it('should include existing feature specs when present', async () => {
    await mkdir(join(tempDir, 'docs', 'features'), { recursive: true });
    await writeFile(join(tempDir, 'docs', 'features', 'auth.md'), '# Auth Feature\nLogin and signup');

    const { stdout } = await runDesign(['--scan']);
    const output = JSON.parse(stdout);

    expect(output.featureSpecs).toBeDefined();
    expect(output.featureSpecs.auth).toContain('Auth Feature');
  });
});

describe('design --from', () => {
  it('should generate interfaces, mocks, and design doc', async () => {
    const designInput = {
      designs: [{
        feature: 'User Profile',
        interfaces: [{
          name: 'UserProfile',
          description: 'User profile data',
          properties: {
            id: { type: 'string', required: true, description: 'Unique ID' },
            name: { type: 'string', required: true, description: 'Display name' },
            bio: { type: 'string', required: false, description: 'User bio' },
          },
        }],
        mocks: [{
          name: 'mockUserProfile',
          interfaceName: 'UserProfile',
          data: { id: '1', name: 'Test User', bio: 'Hello' },
        }],
        apiContracts: [{
          method: 'GET',
          path: '/api/profile/:id',
          description: 'Get user profile',
          responseBody: 'UserProfile',
        }],
      }],
    };
    const inputPath = join(tempDir, 'design-input.json');
    await writeFile(inputPath, JSON.stringify(designInput));

    await runDesign(['--from', inputPath]);

    // TypeScript interfaces
    const typesContent = await readFile(join(tempDir, 'src', 'types', 'user-profile.ts'), 'utf-8');
    expect(typesContent).toContain('export interface UserProfile');
    expect(typesContent).toContain('id: string');
    expect(typesContent).toContain('bio?: string');

    // Mock data
    const mocksContent = await readFile(join(tempDir, 'mocks', 'user-profile.ts'), 'utf-8');
    expect(mocksContent).toContain('mockUserProfile');
    expect(mocksContent).toContain('UserProfile');

    // Design doc
    const designDoc = await readFile(join(tempDir, 'docs', 'designs', 'user-profile.md'), 'utf-8');
    expect(designDoc).toContain('# Design: User Profile');
    expect(designDoc).toContain('UserProfile');
    expect(designDoc).toContain('GET');
    expect(designDoc).toContain('/api/profile/:id');
  });

  it('should handle design without mocks or apiContracts', async () => {
    const designInput = {
      designs: [{
        feature: 'Settings',
        interfaces: [{
          name: 'AppSettings',
          description: 'Application settings',
          properties: {
            theme: { type: "'light' | 'dark'", required: true, description: 'UI theme' },
          },
        }],
      }],
    };
    const inputPath = join(tempDir, 'design-input.json');
    await writeFile(inputPath, JSON.stringify(designInput));

    await runDesign(['--from', inputPath]);

    const typesContent = await readFile(join(tempDir, 'src', 'types', 'settings.ts'), 'utf-8');
    expect(typesContent).toContain('export interface AppSettings');

    const designDoc = await readFile(join(tempDir, 'docs', 'designs', 'settings.md'), 'utf-8');
    expect(designDoc).toContain('# Design: Settings');
    expect(designDoc).not.toContain('API Contracts');
    expect(designDoc).not.toContain('Mock Data');
  });

  it('should fail on missing file', async () => {
    const { exitCode } = await runDesign(['--from', join(tempDir, 'nonexistent.json')]);
    expect(exitCode).not.toBe(0);
  });

  it('should fail on empty designs array', async () => {
    const inputPath = join(tempDir, 'empty.json');
    await writeFile(inputPath, JSON.stringify({ designs: [] }));

    const { exitCode } = await runDesign(['--from', inputPath]);
    expect(exitCode).not.toBe(0);
  });
});

describe('design --check', () => {
  it('should pass when all planned features have design artifacts', async () => {
    await mkdir(join(tempDir, 'docs', 'designs'), { recursive: true });
    await mkdir(join(tempDir, 'docs'), { recursive: true });
    await writeFile(join(tempDir, 'docs', 'plan.json'), JSON.stringify({
      features: [{ name: 'auth' }, { name: 'profile' }],
    }));
    await writeFile(join(tempDir, 'docs', 'designs', 'auth.md'), '# Auth design');
    await writeFile(join(tempDir, 'docs', 'designs', 'profile.md'), '# Profile design');

    const { stdout, exitCode } = await runDesign(['--check']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('All planned features have design artifacts');
  });

  it('should fail when design artifacts are missing', async () => {
    await mkdir(join(tempDir, 'docs'), { recursive: true });
    await writeFile(join(tempDir, 'docs', 'plan.json'), JSON.stringify({
      features: [{ name: 'auth' }, { name: 'profile' }],
    }));

    const { exitCode } = await runDesign(['--check']);
    expect(exitCode).not.toBe(0);
  });

  it('should accept types file as alternative to design doc', async () => {
    await mkdir(join(tempDir, 'docs'), { recursive: true });
    await mkdir(join(tempDir, 'src', 'types'), { recursive: true });
    await writeFile(join(tempDir, 'docs', 'plan.json'), JSON.stringify({
      features: [{ name: 'auth' }],
    }));
    await writeFile(join(tempDir, 'src', 'types', 'auth.ts'), 'export interface Auth {}');

    const { exitCode } = await runDesign(['--check']);
    expect(exitCode).toBe(0);
  });

  it('should fail when no plan exists', async () => {
    const { exitCode } = await runDesign(['--check']);
    expect(exitCode).not.toBe(0);
  });
});
