import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultConfig } from '../../src/config/defaults.js';
import { scaffold, getAvailableTypes } from '../../src/engines/agent-tools/index.js';
import { getAdapter } from '../../src/engines/adapters/index.js';
import type { HarnessConfig } from '../../src/types/index.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'harness-rules-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('rules.fileNaming', () => {
  it('should use default PascalCase for components when no rules set', async () => {
    const config = createDefaultConfig();
    const result = await scaffold(tempDir, config, 'component', 'user-profile');
    expect(result.created[0]).toContain('UserProfile/UserProfile.tsx');
  });

  it('should use kebab-case for components when configured', async () => {
    const config = createDefaultConfig({
      rules: { fileNaming: { components: 'kebab-case' } },
    });
    const result = await scaffold(tempDir, config, 'component', 'UserProfile');
    expect(result.created[0]).toContain('user-profile/user-profile.tsx');
  });

  it('should use kebab-case for utils when configured', async () => {
    const config = createDefaultConfig({
      rules: { fileNaming: { utils: 'kebab-case' } },
    });
    const result = await scaffold(tempDir, config, 'util', 'formatDate');
    expect(result.created[0]).toContain('format-date.ts');
  });

  it('should use snake_case for services when configured', async () => {
    const config = createDefaultConfig({
      rules: { fileNaming: { services: 'snake_case' } },
    });
    const result = await scaffold(tempDir, config, 'service', 'paymentGateway');
    expect(result.created[0]).toContain('payment_gateway.ts');
  });

  it('should reflect fileNaming in adapter output', async () => {
    const config = createDefaultConfig({
      rules: { fileNaming: { components: 'kebab-case', utils: 'snake_case' } },
    });
    const adapter = getAdapter('generic');
    const result = await adapter.generate(tempDir, config);
    const content = result.files['AI_CONTEXT.md'];
    expect(content).toContain('kebab-case');
    expect(content).toContain('snake_case');
  });
});

describe('rules.codingStandards', () => {
  it('should inject custom standards into adapter output', async () => {
    const config = createDefaultConfig({
      rules: {
        codingStandards: [
          { id: 'no-enum', description: 'Use as const instead of enum', severity: 'error' },
          { id: 'korean-comments', description: 'All comments must be in Korean', severity: 'warn' },
        ],
      },
    });
    const adapter = getAdapter('generic');
    const result = await adapter.generate(tempDir, config);
    const content = result.files['AI_CONTEXT.md'];

    expect(content).toContain('no-enum');
    expect(content).toContain('Use as const instead of enum');
    expect(content).toContain('korean-comments');
    expect(content).toContain('All comments must be in Korean');
  });

  it('should show severity indicators', async () => {
    const config = createDefaultConfig({
      rules: {
        codingStandards: [
          { id: 'rule-error', description: 'Error rule', severity: 'error' },
          { id: 'rule-warn', description: 'Warn rule', severity: 'warn' },
          { id: 'rule-info', description: 'Info rule', severity: 'info' },
        ],
      },
    });
    const adapter = getAdapter('cursor');
    const result = await adapter.generate(tempDir, config);
    const content = result.files['.cursor/rules/harness-conventions.mdc'];

    expect(content).toContain('🚫');
    expect(content).toContain('⚠️');
    expect(content).toContain('💡');
  });

  it('should include standards in all non-claude adapters', async () => {
    const config = createDefaultConfig({
      rules: {
        codingStandards: [
          { id: 'test-rule', description: 'Injected rule', severity: 'error' },
        ],
      },
    });

    for (const type of ['cursor', 'copilot', 'windsurf', 'aider', 'generic'] as const) {
      const adapter = getAdapter(type);
      const result = await adapter.generate(tempDir, config);
      const allContent = Object.values(result.files).join('\n');
      expect(allContent).toContain('test-rule');
      expect(allContent).toContain('Injected rule');
    }
  });

  it('should not render coding standards section when empty', async () => {
    const config = createDefaultConfig();
    const adapter = getAdapter('generic');
    const result = await adapter.generate(tempDir, config);
    expect(result.files['AI_CONTEXT.md']).not.toContain('Project Coding Standards');
  });
});

describe('rules.scaffolderTypes', () => {
  it('should support custom scaffold types', async () => {
    const config = createDefaultConfig({
      rules: {
        scaffolderTypes: {
          feature: { directory: 'src/features', naming: 'kebab-case' },
          entity: { directory: 'src/entities', naming: 'kebab-case' },
        },
      },
    });

    const result = await scaffold(tempDir, config, 'feature', 'viewKeys');
    expect(result.created[0]).toBe('src/features/view-keys.ts');
  });

  it('should include custom types in getAvailableTypes', () => {
    const config = createDefaultConfig({
      rules: {
        scaffolderTypes: {
          feature: { directory: 'src/features' },
          widget: { directory: 'src/widgets' },
        },
      },
    });
    const types = getAvailableTypes(config);
    expect(types).toContain('component');
    expect(types).toContain('feature');
    expect(types).toContain('widget');
    expect(types.length).toBe(7);
  });

  it('should override built-in type directory', async () => {
    const config = createDefaultConfig({
      rules: {
        scaffolderTypes: {
          component: { directory: 'src/shared/ui', naming: 'PascalCase' },
        },
      },
    });
    const result = await scaffold(tempDir, config, 'component', 'Button');
    expect(result.created[0]).toContain('src/shared/ui/Button/Button.tsx');
  });

  it('should include custom types in adapter Available types text', async () => {
    const config = createDefaultConfig({
      rules: {
        scaffolderTypes: {
          feature: { directory: 'src/features' },
        },
      },
    });
    const adapter = getAdapter('generic');
    const result = await adapter.generate(tempDir, config);
    expect(result.files['AI_CONTEXT.md']).toContain('feature');
  });
});

describe('rules.testScope', () => {
  it('should default to full src/ scope when no testScope set', () => {
    const config = createDefaultConfig();
    expect(config.rules?.testScope).toEqual({});
  });

  it('should allow narrowing test scope to specific directories', () => {
    const config = createDefaultConfig({
      rules: {
        testScope: {
          include: ['src/hooks/**/*.ts', 'src/lib/**/*.ts'],
          exclude: ['src/hooks/index.ts'],
        },
      },
    });
    expect(config.rules?.testScope?.include).toHaveLength(2);
    expect(config.rules?.testScope?.exclude).toHaveLength(1);
  });
});

describe('rules integration — enterprise-app-like config', () => {
  it('should handle a complex real-world configuration', async () => {
    const config: HarnessConfig = createDefaultConfig({
      project: { name: 'enterprise-app', framework: 'nextjs', packageManager: 'pnpm', language: 'typescript' },
      architecture: {
        style: 'fsd',
        enforceIndexGen: false,
        forbiddenImports: {
          'shared/*': ['features/*', 'entities/*', 'pages/*', 'widgets/*'],
          'entities/*': ['features/*', 'pages/*', 'widgets/*'],
          'features/*': ['pages/*', 'widgets/*'],
        },
      },
      rules: {
        fileNaming: {
          components: 'kebab-case',
          hooks: 'camelCase',
          utils: 'kebab-case',
          services: 'kebab-case',
          models: 'kebab-case',
          testSuffix: '.test',
        },
        codingStandards: [
          { id: 'no-enum', description: 'Do not use enum. Use as const instead', severity: 'error' },
          { id: 'no-any', description: 'Do not use any type. Use unknown instead', severity: 'error' },
          { id: 'korean-comments', description: 'All code comments must be written in Korean', severity: 'error' },
          { id: 'spdx-header', description: 'SPDX license header required on every source file', severity: 'warn' },
          { id: 'no-inline-styles', description: 'Use Tailwind CSS classes only, no inline styles', severity: 'error' },
        ],
        testScope: {
          include: ['src/**/hooks/**/*.ts', 'src/**/lib/**/*.ts'],
          exclude: ['src/**/index.ts'],
        },
        scaffolderTypes: {
          feature: { directory: 'src/features', naming: 'kebab-case' },
          entity: { directory: 'src/entities', naming: 'kebab-case' },
          widget: { directory: 'src/widgets', naming: 'kebab-case' },
        },
      },
    });

    const adapter = getAdapter('generic');
    const result = await adapter.generate(tempDir, config);
    const content = result.files['AI_CONTEXT.md'];

    expect(content).toContain('enterprise-app');
    expect(content).toContain('fsd');
    expect(content).toContain('kebab-case');
    expect(content).toContain('no-enum');
    expect(content).toContain('korean-comments');
    expect(content).toContain('spdx-header');
    expect(content).toContain('feature');
    expect(content).toContain('entity');
    expect(content).toContain('widget');

    const featureResult = await scaffold(tempDir, config, 'feature', 'viewInvoices');
    expect(featureResult.created[0]).toBe('src/features/view-invoices.ts');
  });
});
