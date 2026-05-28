import type { HarnessConfig, NamingConvention } from '../../types/index.js';
import { writeText, ensureDir, resolvePath, fileExists, toNamingCase, toPascalCase } from '../../utils/index.js';
import { dirname, join } from 'node:path';

export type BuiltinScaffoldType = 'component' | 'hook' | 'util' | 'service' | 'model';
export type ScaffoldType = string;

interface ScaffoldResult {
  created: string[];
  skipped: string[];
}

export function getAvailableTypes(config: HarnessConfig): string[] {
  const builtins: BuiltinScaffoldType[] = ['component', 'hook', 'util', 'service', 'model'];
  const custom = Object.keys(config.rules?.scaffolderTypes ?? {});
  return [...new Set([...builtins, ...custom])];
}

export async function scaffold(
  root: string,
  config: HarnessConfig,
  type: ScaffoldType,
  name: string,
): Promise<ScaffoldResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  const files = getTemplateFiles(config, type, name);

  for (const { path, content } of files) {
    const fullPath = resolvePath(root, path);
    if (await fileExists(fullPath)) {
      skipped.push(path);
      continue;
    }
    await ensureDir(dirname(fullPath));
    await writeText(fullPath, content);
    created.push(path);
  }

  if (config.architecture.enforceIndexGen) {
    const dirs = new Set(files.map((f) => dirname(f.path)));
    for (const dir of dirs) {
      await generateBarrelExport(root, dir);
    }
  }

  return { created, skipped };
}

interface TemplateFile {
  path: string;
  content: string;
}

function resolveNaming(config: HarnessConfig, type: ScaffoldType): NamingConvention {
  const customType = config.rules?.scaffolderTypes?.[type];
  if (customType?.naming) return customType.naming;

  const naming = config.rules?.fileNaming;
  switch (type) {
    case 'component': return naming?.components ?? 'PascalCase';
    case 'hook': return naming?.hooks ?? 'camelCase';
    case 'util': return naming?.utils ?? 'camelCase';
    case 'service': return naming?.services ?? 'camelCase';
    case 'model': return naming?.models ?? 'camelCase';
    default: return 'camelCase';
  }
}

function resolveDirectory(config: HarnessConfig, type: ScaffoldType): string {
  const customType = config.rules?.scaffolderTypes?.[type];
  if (customType?.directory) return customType.directory;

  switch (type) {
    case 'component': return 'src/components';
    case 'hook': return 'src/hooks';
    case 'util': return 'src/utils';
    case 'service': return 'src/services';
    case 'model': return 'src/models';
    default: return `src/${type}s`;
  }
}

function getTemplateFiles(
  config: HarnessConfig,
  type: ScaffoldType,
  name: string,
): TemplateFile[] {
  const lang = config.project.language;
  const ext = lang === 'typescript' ? 'ts' : 'js';
  const extx = lang === 'typescript' ? 'tsx' : 'jsx';

  const naming = resolveNaming(config, type);
  const dir = resolveDirectory(config, type);
  const named = toNamingCase(name, naming);
  const pascal = toPascalCase(name);

  switch (type) {
    case 'component':
      return [
        {
          path: `${dir}/${named}/${named}.${extx}`,
          content: generateComponentTemplate(pascal, config),
        },
      ];
    case 'hook':
      return [
        {
          path: `${dir}/use${pascal}.${ext}`,
          content: `export function use${pascal}() {\n  // TODO: implement\n}\n`,
        },
      ];
    case 'util':
      return [
        {
          path: `${dir}/${named}.${ext}`,
          content: `export function ${toNamingCase(name, 'camelCase')}() {\n  // TODO: implement\n}\n`,
        },
      ];
    case 'service':
      return [
        {
          path: `${dir}/${named}.${ext}`,
          content: `export class ${pascal}Service {\n  // TODO: implement\n}\n`,
        },
      ];
    case 'model':
      return [
        {
          path: `${dir}/${named}.${ext}`,
          content: lang === 'typescript'
            ? `export interface ${pascal} {\n  id: string;\n  // TODO: define fields\n}\n`
            : `/** @typedef {Object} ${pascal}\n * @property {string} id\n */\n`,
        },
      ];
    default:
      return [
        {
          path: `${dir}/${named}.${ext}`,
          content: `// ${type}: ${named}\n// TODO: implement\n`,
        },
      ];
  }
}

function generateComponentTemplate(name: string, config: HarnessConfig): string {
  if (config.project.language === 'typescript') {
    return `interface ${name}Props {\n  // TODO: define props\n}\n\nexport function ${name}({ }: ${name}Props) {\n  return (\n    <div>\n      <h1>${name}</h1>\n    </div>\n  );\n}\n`;
  }
  return `export function ${name}() {\n  return (\n    <div>\n      <h1>${name}</h1>\n    </div>\n  );\n}\n`;
}

async function generateBarrelExport(root: string, dir: string): Promise<void> {
  const { readdir } = await import('node:fs/promises');
  const fullDir = resolvePath(root, dir);

  try {
    const entries = await readdir(fullDir);
    const exportables = entries.filter(
      (e) =>
        (e.endsWith('.ts') || e.endsWith('.tsx')) &&
        !e.endsWith('.test.ts') &&
        !e.endsWith('.test.tsx') &&
        e !== 'index.ts',
    );

    if (exportables.length === 0) return;

    const exports = exportables
      .map((f) => {
        const name = f.replace(/\.(tsx?|jsx?)$/, '');
        return `export * from './${name}';`;
      })
      .join('\n');

    await writeText(join(fullDir, 'index.ts'), exports + '\n');
  } catch {
    // directory might not exist yet
  }
}

