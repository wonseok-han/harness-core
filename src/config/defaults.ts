import type { HarnessConfig } from '../types/index.js';

export function createDefaultConfig(overrides: Partial<HarnessConfig> = {}): HarnessConfig {
  const defaults: HarnessConfig = {
    project: {
      name: 'my-project',
      framework: 'unknown',
      packageManager: 'npm',
      language: 'typescript',
    },
    architecture: {
      style: 'modular',
      enforceIndexGen: true,
      forbiddenImports: {},
    },
    development: {
      linter: 'eslint',
      formatter: 'prettier',
      styling: '',
    },
    testing: {
      runner: 'vitest',
      minCoverage: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      requireTestFileWithImplementation: true,
    },
    agent: {
      persona: 'senior-developer',
      allowedScopes: ['src/**/*', 'tests/**/*'],
      adapters: ['generic'],
    },
    rules: {
      fileNaming: {
        components: 'PascalCase',
        hooks: 'camelCase',
        utils: 'camelCase',
        services: 'camelCase',
        models: 'camelCase',
        testSuffix: '.test',
      },
      codingStandards: [],
      testScope: {},
      scaffolderTypes: {},
    },
  };

  return deepMerge(defaults as unknown as Obj, overrides as unknown as Obj) as unknown as HarnessConfig;
}

type Obj = Record<string, unknown>;

function deepMerge(target: Obj, source: Obj): Obj {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal as Obj, sourceVal as Obj);
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}
