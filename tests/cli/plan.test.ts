import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultConfig } from '../../src/config/defaults.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'harness-plan-'));
  const config = createDefaultConfig({ project: { name: 'plan-test', framework: 'nextjs', packageManager: 'npm', language: 'typescript' } });
  await writeFile(join(tempDir, 'harness.config.json'), JSON.stringify(config));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function runPlan(args: string[]): Promise<{ stdout: string; exitCode: number }> {
  const { runCommand } = await import('../../src/utils/exec.js');
  const cliPath = join(process.cwd(), 'dist', 'cli', 'index.js');
  const result = await runCommand(`node ${cliPath} plan ${args.join(' ')} --root ${tempDir}`, tempDir);
  return { stdout: result.stdout, exitCode: result.exitCode };
}

describe('plan --scan', () => {
  it('should output JSON with project name and expected format', async () => {
    const { stdout } = await runPlan(['--scan']);
    const output = JSON.parse(stdout);

    expect(output.project).toBe('plan-test');
    expect(output.instructions).toContain('harness plan --from');
    expect(output.expectedFormat).toBeDefined();
    expect(output.expectedFormat.features).toBeInstanceOf(Array);
  });

  it('should include existing glossary when present', async () => {
    await writeFile(join(tempDir, 'domain-glossary.json'), JSON.stringify({
      domain: 'test',
      terms: [{ term: 'user', definition: 'a person' }],
    }));

    const { stdout } = await runPlan(['--scan']);
    const output = JSON.parse(stdout);

    expect(output.glossary).toBeDefined();
    expect(output.glossary.terms).toHaveLength(1);
  });

  it('should include existing plan when present', async () => {
    await mkdir(join(tempDir, 'docs'), { recursive: true });
    await writeFile(join(tempDir, 'docs', 'plan.json'), JSON.stringify({
      goal: 'existing goal',
      features: [{ name: 'auth', priority: 'high', description: 'auth feature' }],
    }));

    const { stdout } = await runPlan(['--scan']);
    const output = JSON.parse(stdout);

    expect(output.existingPlan).toBeDefined();
    expect(output.existingPlan.goal).toBe('existing goal');
  });
});

describe('plan --from', () => {
  it('should create plan.json and plan.md from valid input', async () => {
    const planInput = {
      goal: 'Build a todo app',
      features: [
        { name: 'task-list', priority: 'high', description: 'Display tasks' },
        { name: 'task-create', priority: 'medium', description: 'Create tasks' },
      ],
      milestones: [
        { name: 'MVP', targetDate: '2025-06-01', features: ['task-list', 'task-create'] },
      ],
    };
    const inputPath = join(tempDir, 'plan-input.json');
    await writeFile(inputPath, JSON.stringify(planInput));

    await runPlan(['--from', inputPath]);

    const planJson = JSON.parse(await readFile(join(tempDir, 'docs', 'plan.json'), 'utf-8'));
    expect(planJson.goal).toBe('Build a todo app');
    expect(planJson.features).toHaveLength(2);
    expect(planJson.milestones).toHaveLength(1);

    const planMd = await readFile(join(tempDir, 'docs', 'plan.md'), 'utf-8');
    expect(planMd).toContain('Build a todo app');
    expect(planMd).toContain('task-list');
    expect(planMd).toContain('MVP');
  });

  it('should sort features by priority in markdown', async () => {
    const planInput = {
      goal: 'Test priority sort',
      features: [
        { name: 'low-feat', priority: 'low', description: 'low priority' },
        { name: 'high-feat', priority: 'high', description: 'high priority' },
        { name: 'med-feat', priority: 'medium', description: 'medium priority' },
      ],
    };
    const inputPath = join(tempDir, 'plan-input.json');
    await writeFile(inputPath, JSON.stringify(planInput));

    await runPlan(['--from', inputPath]);

    const planMd = await readFile(join(tempDir, 'docs', 'plan.md'), 'utf-8');
    const highIdx = planMd.indexOf('high-feat');
    const medIdx = planMd.indexOf('med-feat');
    const lowIdx = planMd.indexOf('low-feat');
    expect(highIdx).toBeLessThan(medIdx);
    expect(medIdx).toBeLessThan(lowIdx);
  });

  it('should fail on missing file', async () => {
    const { exitCode } = await runPlan(['--from', join(tempDir, 'nonexistent.json')]);
    expect(exitCode).not.toBe(0);
  });

  it('should fail on invalid JSON', async () => {
    const inputPath = join(tempDir, 'bad.json');
    await writeFile(inputPath, 'not json');

    const { exitCode } = await runPlan(['--from', inputPath]);
    expect(exitCode).not.toBe(0);
  });

  it('should fail on missing goal or features', async () => {
    const inputPath = join(tempDir, 'empty.json');
    await writeFile(inputPath, JSON.stringify({ goal: 'no features' }));

    const { exitCode } = await runPlan(['--from', inputPath]);
    expect(exitCode).not.toBe(0);
  });
});
