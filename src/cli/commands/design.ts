import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { readdir } from 'node:fs/promises';
import { loadConfig } from '../../config/index.js';
import { writeText, readJson, readText, fileExists, resolvePath, ensureDir } from '../../utils/index.js';
import type { DesignSpec, InterfaceDef, MockDef } from '../../types/index.js';

interface DesignInput {
  designs: DesignSpec[];
}

export const designCommand = new Command('design')
  .description('Define design contracts — interfaces, mocks, API contracts (before implementation)')
  .option('--root <path>', 'Project root directory', process.cwd())
  .option('--scan', 'Scan plan and specs, output context as JSON (for AI agents)')
  .option('--from <file>', 'Import design from JSON file (for AI agents)')
  .option('--check', 'Check if design artifacts exist for planned features')
  .action(async (options: { root: string; scan?: boolean; from?: string; check?: boolean }) => {
    const root = options.root;
    const config = await loadConfig(root);

    if (options.scan) {
      await runScan(root, config.project.name);
      return;
    }

    if (options.from) {
      await runFromFile(root, options.from);
      return;
    }

    if (options.check) {
      await runCheck(root);
      return;
    }

    await runInteractive(root);
  });

// ─── --scan: Output context for AI agent ───

async function runScan(root: string, projectName: string): Promise<void> {
  const scan: Record<string, unknown> = {
    project: projectName,
    instructions: 'Create design contracts (interfaces, mocks, API contracts) for each planned feature. Then run: harness design --from <file>',
  };

  // Existing plan
  const planPath = resolvePath(root, 'docs', 'plan.json');
  if (await fileExists(planPath)) {
    scan.plan = await readJson(planPath);
  }

  // Feature specs
  const featuresDir = resolvePath(root, 'docs', 'features');
  if (await fileExists(featuresDir)) {
    const files = await listMdFiles(featuresDir);
    const specs: Record<string, string> = {};
    for (const file of files) {
      specs[file.replace('.md', '')] = await readText(resolvePath(featuresDir, file));
    }
    scan.featureSpecs = specs;
  }

  // Existing glossary
  const glossaryPath = resolvePath(root, 'domain-glossary.json');
  if (await fileExists(glossaryPath)) {
    scan.glossary = await readJson(glossaryPath);
  }

  // Existing designs
  const designsDir = resolvePath(root, 'docs', 'designs');
  if (await fileExists(designsDir)) {
    const files = await listMdFiles(designsDir);
    scan.existingDesigns = files.map((f) => f.replace('.md', ''));
  }

  scan.expectedFormat = {
    designs: [
      {
        feature: 'string — feature name from plan',
        interfaces: [
          {
            name: 'string — interface name (PascalCase)',
            description: 'string',
            properties: {
              propertyName: { type: 'string', required: true, description: 'string' },
            },
          },
        ],
        mocks: [
          {
            name: 'string — mock variable name',
            interfaceName: 'string — which interface this mocks',
            data: { '...': 'sample data matching the interface' },
          },
        ],
        apiContracts: [
          {
            method: 'GET | POST | PUT | PATCH | DELETE',
            path: '/api/example',
            description: 'string',
            requestBody: 'optional — interface name for request',
            responseBody: 'interface name for response',
          },
        ],
      },
    ],
  };

  console.log(JSON.stringify(scan, null, 2));
}

// ─── --from: Import design from JSON ───

async function runFromFile(root: string, filePath: string): Promise<void> {
  const resolvedPath = resolvePath(root, filePath);

  if (!(await fileExists(resolvedPath))) {
    console.error(chalk.red(`File not found: ${resolvedPath}`));
    process.exitCode = 1;
    return;
  }

  const raw = await readText(resolvedPath);
  let input: DesignInput;
  try {
    input = JSON.parse(raw) as DesignInput;
  } catch {
    console.error(chalk.red('Invalid JSON file'));
    process.exitCode = 1;
    return;
  }

  if (!input.designs || input.designs.length === 0) {
    console.error(chalk.red('JSON must contain "designs" (non-empty array)'));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.blue('\n📐 Importing design contracts\n'));

  for (const design of input.designs) {
    await generateDesignArtifacts(root, design);
  }

  console.log(chalk.blue('\n✨ Design contracts created!\n'));
  console.log(`Next: Start implementation. The AI agent should use ${chalk.cyan('harness generate')} to create files.`);
}

// ─── --check: Verify design artifacts exist ───

async function runCheck(root: string): Promise<void> {
  const planPath = resolvePath(root, 'docs', 'plan.json');

  if (!(await fileExists(planPath))) {
    console.log(chalk.yellow('No plan found. Run harness plan first.'));
    process.exitCode = 1;
    return;
  }

  const plan = await readJson<{ features: Array<{ name: string }> }>(planPath);
  const missing: string[] = [];

  for (const feature of plan.features) {
    const designPath = resolvePath(root, 'docs', 'designs', `${feature.name}.md`);
    const typesPath = resolvePath(root, 'src', 'types', `${feature.name}.ts`);

    if (!(await fileExists(designPath)) && !(await fileExists(typesPath))) {
      missing.push(feature.name);
    }
  }

  if (missing.length > 0) {
    console.log(chalk.red(`\n❌ Missing design artifacts for ${missing.length} feature(s):\n`));
    for (const name of missing) {
      console.log(`  ${chalk.red('✗')} ${name} — no docs/designs/${name}.md or src/types/${name}.ts`);
    }
    console.log(`\nRun ${chalk.cyan('harness design')} to create them before implementing.`);
    process.exitCode = 1;
  } else {
    console.log(chalk.green('✅ All planned features have design artifacts.'));
  }
}

// ─── Generate design artifacts ───

async function generateDesignArtifacts(root: string, design: DesignSpec): Promise<void> {
  const featureSlug = design.feature.toLowerCase().replace(/\s+/g, '-');

  // 1. Generate TypeScript interfaces → src/types/{feature}.ts
  if (design.interfaces.length > 0) {
    const typesDir = resolvePath(root, 'src', 'types');
    await ensureDir(typesDir);

    const tsContent = renderInterfacesTs(design.interfaces);
    await writeText(resolvePath(typesDir, `${featureSlug}.ts`), tsContent);
    console.log(chalk.green(`✅ src/types/${featureSlug}.ts (${design.interfaces.length} interfaces)`));
  }

  // 2. Generate mock data → mocks/{feature}.ts
  if (design.mocks && design.mocks.length > 0) {
    const mocksDir = resolvePath(root, 'mocks');
    await ensureDir(mocksDir);

    const mockContent = renderMocksTs(design.mocks, featureSlug);
    await writeText(resolvePath(mocksDir, `${featureSlug}.ts`), mockContent);
    console.log(chalk.green(`✅ mocks/${featureSlug}.ts (${design.mocks.length} mocks)`));
  }

  // 3. Generate design doc → docs/designs/{feature}.md
  const designsDir = resolvePath(root, 'docs', 'designs');
  await ensureDir(designsDir);

  const markdown = renderDesignDoc(design);
  await writeText(resolvePath(designsDir, `${featureSlug}.md`), markdown);
  console.log(chalk.green(`✅ docs/designs/${featureSlug}.md`));
}

// ─── Renderers ───

function renderInterfacesTs(interfaces: InterfaceDef[]): string {
  const lines: string[] = [];

  for (const iface of interfaces) {
    lines.push(`/** ${iface.description} */`);
    lines.push(`export interface ${iface.name} {`);
    for (const [name, prop] of Object.entries(iface.properties)) {
      const opt = prop.required ? '' : '?';
      lines.push(`  ${name}${opt}: ${prop.type};`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

function renderMocksTs(mocks: MockDef[], featureSlug: string): string {
  const lines: string[] = [];

  lines.push(`import type { ${mocks.map((m) => m.interfaceName).filter((v, i, a) => a.indexOf(v) === i).join(', ')} } from '../src/types/${featureSlug}.js';`);
  lines.push('');

  for (const mock of mocks) {
    lines.push(`export const ${mock.name}: ${mock.interfaceName} = ${JSON.stringify(mock.data, null, 2)};`);
    lines.push('');
  }

  return lines.join('\n');
}

function renderDesignDoc(design: DesignSpec): string {
  const lines: string[] = [];

  lines.push(`# Design: ${design.feature}`);
  lines.push('');

  lines.push('## Interfaces');
  lines.push('');
  for (const iface of design.interfaces) {
    lines.push(`### ${iface.name}`);
    lines.push(iface.description);
    lines.push('');
    lines.push('| Property | Type | Required | Description |');
    lines.push('|----------|------|----------|-------------|');
    for (const [name, prop] of Object.entries(iface.properties)) {
      lines.push(`| ${name} | \`${prop.type}\` | ${prop.required ? 'Y' : 'N'} | ${prop.description} |`);
    }
    lines.push('');
  }

  if (design.apiContracts && design.apiContracts.length > 0) {
    lines.push('## API Contracts');
    lines.push('');
    lines.push('| Method | Path | Description | Request | Response |');
    lines.push('|--------|------|-------------|---------|----------|');
    for (const api of design.apiContracts) {
      lines.push(`| ${api.method} | \`${api.path}\` | ${api.description} | ${api.requestBody || '-'} | ${api.responseBody} |`);
    }
    lines.push('');
  }

  if (design.mocks && design.mocks.length > 0) {
    lines.push('## Mock Data');
    lines.push('');
    for (const mock of design.mocks) {
      lines.push(`- \`${mock.name}\` → \`${mock.interfaceName}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Interactive mode ───

async function runInteractive(root: string): Promise<void> {
  console.log(chalk.blue('\n📐 Design Contract Builder\n'));

  const planPath = resolvePath(root, 'docs', 'plan.json');
  let featureChoices: string[] = [];

  if (await fileExists(planPath)) {
    const plan = await readJson<{ features: Array<{ name: string }> }>(planPath);
    featureChoices = plan.features.map((f) => f.name);
    console.log(chalk.dim(`Found ${featureChoices.length} planned features\n`));
  }

  let designing = true;
  while (designing) {
    let featureName: string;

    if (featureChoices.length > 0) {
      const { selected } = await inquirer.prompt<{ selected: string }>([{
        type: 'list',
        name: 'selected',
        message: 'Design for which feature?',
        choices: [...featureChoices, new inquirer.Separator(), { name: 'Custom name', value: '__custom__' }, { name: 'Done', value: '__done__' }],
      }]);

      if (selected === '__done__') break;
      if (selected === '__custom__') {
        const { custom } = await inquirer.prompt<{ custom: string }>([{
          type: 'input', name: 'custom', message: 'Feature name:',
        }]);
        featureName = custom.trim();
      } else {
        featureName = selected;
      }
    } else {
      const { name } = await inquirer.prompt<{ name: string }>([{
        type: 'input',
        name: 'name',
        message: `Feature name ${chalk.dim('(empty to finish)')}:`,
      }]);
      if (!name.trim()) break;
      featureName = name.trim();
    }

    const interfaces = await collectInterfaces();
    const design: DesignSpec = { feature: featureName, interfaces };

    await generateDesignArtifacts(root, design);

    const { more } = await inquirer.prompt<{ more: boolean }>([{
      type: 'confirm', name: 'more', message: 'Design another feature?', default: true,
    }]);
    if (!more) designing = false;
  }

  console.log(chalk.blue('\n✨ Design phase complete!\n'));
}

async function collectInterfaces(): Promise<InterfaceDef[]> {
  const interfaces: InterfaceDef[] = [];
  let adding = true;

  while (adding) {
    const { name } = await inquirer.prompt<{ name: string }>([{
      type: 'input',
      name: 'name',
      message: `  Interface name ${chalk.dim('(PascalCase, empty to finish)')}:`,
    }]);

    if (!name.trim()) { adding = false; continue; }

    const { description } = await inquirer.prompt<{ description: string }>([{
      type: 'input', name: 'description', message: '    Description:',
    }]);

    const properties: Record<string, { type: string; required: boolean; description: string }> = {};
    let addingProps = true;

    while (addingProps) {
      const { prop } = await inquirer.prompt<{ prop: string }>([{
        type: 'input',
        name: 'prop',
        message: `    Property name ${chalk.dim('(empty to finish)')}:`,
      }]);

      if (!prop.trim()) { addingProps = false; continue; }

      const { type, required, desc } = await inquirer.prompt<{
        type: string; required: boolean; desc: string;
      }>([
        { type: 'input', name: 'type', message: '      Type:', default: 'string' },
        { type: 'confirm', name: 'required', message: '      Required?', default: true },
        { type: 'input', name: 'desc', message: '      Description:' },
      ]);

      properties[prop.trim()] = { type, required, description: desc };
    }

    interfaces.push({ name: name.trim(), description, properties });
    console.log(chalk.green(`  ✓ Added interface "${name.trim()}"\n`));
  }

  return interfaces;
}

async function listMdFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}
