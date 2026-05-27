import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  scaffold,
  safeEditJson,
  safeEditEnv,
  safeEditI18n,
  isWithinScope,
  filterByScope,
} from '../../src/engines/agent-tools/index.js';
import { createDefaultConfig } from '../../src/config/defaults.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'harness-agent-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('scaffold', () => {
  it('should create component files', async () => {
    const config = createDefaultConfig();
    const result = await scaffold(tempDir, config, 'component', 'UserProfile');

    expect(result.created).toHaveLength(1);
    expect(result.created.some((f) => f.includes('UserProfile.tsx'))).toBe(true);

    const content = await readFile(join(tempDir, result.created[0]!), 'utf-8');
    expect(content).toContain('UserProfile');
  });

  it('should create util files', async () => {
    const config = createDefaultConfig();
    const result = await scaffold(tempDir, config, 'util', 'format-date');

    expect(result.created).toHaveLength(1);
    expect(result.created.some((f) => f.includes('formatDate.ts'))).toBe(true);
  });

  it('should skip existing files', async () => {
    const config = createDefaultConfig();
    await scaffold(tempDir, config, 'component', 'Button');
    const result = await scaffold(tempDir, config, 'component', 'Button');

    expect(result.created).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });

  it('should create service files', async () => {
    const config = createDefaultConfig();
    const result = await scaffold(tempDir, config, 'service', 'auth');

    expect(result.created.some((f) => f.includes('auth.ts'))).toBe(true);
    const content = await readFile(
      join(tempDir, result.created.find((f) => !f.includes('test'))!),
      'utf-8',
    );
    expect(content).toContain('AuthService');
  });
});

describe('safeEditJson', () => {
  it('should modify JSON file safely', async () => {
    const filePath = join(tempDir, 'data.json');
    await writeFile(filePath, JSON.stringify({ name: 'test', version: '1.0' }));

    const result = await safeEditJson(filePath, (data) => ({
      ...data,
      version: '2.0',
    }));

    expect(result.success).toBe(true);
    const updated = JSON.parse(await readFile(filePath, 'utf-8'));
    expect(updated.version).toBe('2.0');
    expect(updated.name).toBe('test');
  });

  it('should return error for non-existent file', async () => {
    const result = await safeEditJson(join(tempDir, 'missing.json'), (d) => d);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('safeEditEnv', () => {
  it('should add new env variable', async () => {
    const filePath = join(tempDir, '.env');
    await writeFile(filePath, 'EXISTING=value\n');

    const result = await safeEditEnv(filePath, 'NEW_VAR', 'new_value');

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('NEW_VAR=new_value');
    expect(content).toContain('EXISTING=value');
  });

  it('should update existing env variable', async () => {
    const filePath = join(tempDir, '.env');
    await writeFile(filePath, 'MY_VAR=old\n');

    const result = await safeEditEnv(filePath, 'MY_VAR', 'new');

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('MY_VAR=new');
    expect(content).not.toContain('MY_VAR=old');
  });

  it('should create .env if it does not exist', async () => {
    const filePath = join(tempDir, '.env.new');
    const result = await safeEditEnv(filePath, 'KEY', 'value');

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('KEY=value');
  });
});

describe('safeEditI18n', () => {
  it('should set nested i18n key', async () => {
    const filePath = join(tempDir, 'en.json');
    await writeFile(filePath, JSON.stringify({ common: { hello: 'Hello' } }));

    const result = await safeEditI18n(filePath, 'common.goodbye', 'Goodbye');

    expect(result.success).toBe(true);
    const data = JSON.parse(await readFile(filePath, 'utf-8'));
    expect(data.common.goodbye).toBe('Goodbye');
    expect(data.common.hello).toBe('Hello');
  });
});

describe('isWithinScope', () => {
  it('should allow files within scope', () => {
    expect(isWithinScope(join(tempDir, 'src/app.ts'), tempDir, ['src/**/*'])).toBe(true);
  });

  it('should deny files outside scope', () => {
    expect(isWithinScope(join(tempDir, 'config/secret.ts'), tempDir, ['src/**/*'])).toBe(false);
  });
});

describe('filterByScope', () => {
  it('should partition files by scope', () => {
    const files = [
      join(tempDir, 'src/app.ts'),
      join(tempDir, 'src/utils/helper.ts'),
      join(tempDir, 'config/db.ts'),
    ];

    const { allowed, denied } = filterByScope(files, tempDir, ['src/**/*']);

    expect(allowed).toHaveLength(2);
    expect(denied).toHaveLength(1);
    expect(denied[0]).toContain('config');
  });
});
