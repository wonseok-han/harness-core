import type { HarnessConfig } from '../../types/index.js';
import { writeText, ensureDir, resolvePath, fileExists } from '../../utils/index.js';
import { dirname, join } from 'node:path';

export type ScaffoldType = 'component' | 'hook' | 'util' | 'service' | 'model';

interface ScaffoldResult {
  created: string[];
  skipped: string[];
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

function getTemplateFiles(
  config: HarnessConfig,
  type: ScaffoldType,
  name: string,
): TemplateFile[] {
  const lang = config.project.language;
  const ext = lang === 'typescript' ? 'ts' : 'js';
  const extx = lang === 'typescript' ? 'tsx' : 'jsx';
  const pascal = toPascalCase(name);
  const camel = toCamelCase(name);

  switch (type) {
    case 'component':
      return [
        {
          path: `src/components/${pascal}/${pascal}.${extx}`,
          content: generateComponentTemplate(pascal, config),
        },
      ];
    case 'hook':
      return [
        {
          path: `src/hooks/use${pascal}.${ext}`,
          content: `export function use${pascal}() {\n  // TODO: implement\n}\n`,
        },
      ];
    case 'util':
      return [
        {
          path: `src/utils/${camel}.${ext}`,
          content: `export function ${camel}() {\n  // TODO: implement\n}\n`,
        },
      ];
    case 'service':
      return [
        {
          path: `src/services/${camel}.${ext}`,
          content: `export class ${pascal}Service {\n  // TODO: implement\n}\n`,
        },
      ];
    case 'model':
      return [
        {
          path: `src/models/${camel}.${ext}`,
          content: lang === 'typescript'
            ? `export interface ${pascal} {\n  id: string;\n  // TODO: define fields\n}\n`
            : `/** @typedef {Object} ${pascal}\n * @property {string} id\n */\n`,
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

function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toLowerCase());
}
