import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { generateHuskyHooks, generateLintStagedConfig } from '../../engines/policy/index.js';
import { getAdapter, getAdapterChoices } from '../../engines/adapters/index.js';
import { discoverProject } from '../../engines/discovery/index.js';
import { writeJson, writeText, ensureDir, resolvePath, fileExists } from '../../utils/index.js';
import { runCommand } from '../../utils/index.js';
import { createDefaultConfig } from '../../config/defaults.js';
import type {
  HarnessConfig,
  Framework,
  PackageManager,
  ArchitectureStyle,
  AgentType,
  RulesConfig,
  NamingConvention,
  CodingStandard,
} from '../../types/index.js';

const PKG_NAME = '@wonseok-han/harness-core';
const LOCAL_SCHEMA = `node_modules/${PKG_NAME}/schema/harness.config.schema.json`;

function getPkgVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require('../../package.json') as { version: string };
  return pkg.version;
}

function getRemoteSchema(): string {
  const version = getPkgVersion();
  return `https://raw.githubusercontent.com/wonseok-han/harness-core/v${version}/schema/harness.config.schema.json`;
}

async function resolveSchemaRef(root: string): Promise<string> {
  const exists = await fileExists(resolvePath(root, LOCAL_SCHEMA));
  return exists ? `./${LOCAL_SCHEMA}` : getRemoteSchema();
}

function withSchema(config: HarnessConfig, schemaRef: string): Record<string, unknown> {
  return { $schema: schemaRef, ...config };
}

function isPathArg(arg: string): boolean {
  return arg === '.' || arg.startsWith('./') || arg.startsWith('/') || arg.startsWith('..');
}

export const initCommand = new Command('init')
  .description('Initialize a new project or adopt harness into an existing one')
  .argument('[name-or-path]', 'Project name (creates directory) or path to existing project (e.g., ".")')
  .option('--root <path>', 'Alias for path argument (backward compat)')
  .option('--from <file>', 'Import config from JSON file (AI agent workflow)')
  .action(async (nameOrPath: string | undefined, options: { root?: string; from?: string }) => {
    // ─── Step 1: Determine project root and mode ───
    let root: string;
    let isNewProject: boolean;

    if (options.from) {
      const fromPath = resolve(options.from);
      if (nameOrPath && !isPathArg(nameOrPath)) {
        // harness init my-app --from config.json → new project
        root = resolve(process.cwd(), nameOrPath);
        await handleNewProjectFrom(root, nameOrPath, fromPath);
      } else {
        // harness init . --from config.json → adopt existing
        root = nameOrPath ? resolve(nameOrPath) : (options.root ? resolve(options.root) : process.cwd());
        await handleAdoptFrom(root, fromPath);
      }
      return;
    }

    if (options.root) {
      root = resolve(options.root);
      isNewProject = false;
    } else if (nameOrPath && isPathArg(nameOrPath)) {
      root = resolve(nameOrPath);
      isNewProject = false;
    } else if (nameOrPath) {
      root = resolve(process.cwd(), nameOrPath);
      isNewProject = true;
    } else {
      const { projectName } = await inquirer.prompt<{ projectName: string }>([{
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        validate: (v: string) => v.trim().length > 0 || 'Name is required',
      }]);
      nameOrPath = projectName.trim();
      root = resolve(process.cwd(), nameOrPath);
      isNewProject = true;
    }

    // Detect existing project → adopt mode
    const hasPackageJson = await fileExists(resolvePath(root, 'package.json'));
    if (!isNewProject && hasPackageJson) {
      await handleAdoptInteractive(root);
      return;
    }

    console.log(chalk.blue('\n🚀 Harness Project Initializer\n'));

    if (isNewProject) {
      if (await fileExists(root)) {
        const { proceed } = await inquirer.prompt<{ proceed: boolean }>([{
          type: 'confirm',
          name: 'proceed',
          message: `Directory "${nameOrPath}" already exists. Initialize inside it?`,
          default: false,
        }]);
        if (!proceed) {
          console.log(chalk.yellow('Aborted.'));
          return;
        }
      } else {
        await ensureDir(root);
        console.log(chalk.green(`📁 Created ${root}\n`));
      }
    }

    // ─── Step 2: Interactive setup ───
    const answers = await inquirer.prompt<{
      framework: Framework;
      packageManager: PackageManager;
      language: 'typescript' | 'javascript';
      styling: string;
      architecture: ArchitectureStyle;
      testRunner: string;
      linter: string;
      formatter: string;
      persona: string;
    }>([
      {
        type: 'list',
        name: 'framework',
        message: 'Framework:',
        choices: [
          { name: 'Next.js', value: 'nextjs' },
          { name: 'Nuxt', value: 'nuxt' },
          { name: 'SvelteKit', value: 'svelte' },
          { name: 'Remix', value: 'remix' },
          { name: 'Astro', value: 'astro' },
          { name: 'Vite + React', value: 'vite-react' },
          { name: 'Vite + Vue', value: 'vite-vue' },
          { name: 'Express', value: 'express' },
          { name: 'Fastify', value: 'fastify' },
          { name: 'NestJS', value: 'nest' },
          { name: 'None (vanilla)', value: 'unknown' },
        ],
      },
      {
        type: 'list',
        name: 'packageManager',
        message: 'Package manager:',
        choices: ['pnpm', 'npm', 'yarn', 'bun'],
        default: 'pnpm',
      },
      {
        type: 'list',
        name: 'language',
        message: 'Language:',
        choices: ['typescript', 'javascript'],
        default: 'typescript',
      },
      {
        type: 'list',
        name: 'styling',
        message: 'Styling:',
        choices: [
          { name: 'Tailwind CSS v4', value: 'tailwind-v4' },
          { name: 'Tailwind CSS v3', value: 'tailwind-v3' },
          { name: 'styled-components', value: 'styled-components' },
          { name: 'Emotion', value: 'emotion' },
          { name: 'Sass', value: 'sass' },
          { name: 'CSS Modules (built-in)', value: 'css-modules' },
          { name: 'None', value: '' },
        ],
        default: 'tailwind-v4',
      },
      {
        type: 'list',
        name: 'architecture',
        message: 'Architecture style:',
        choices: [
          { name: 'Modular (feature-based)', value: 'modular' },
          { name: 'FSD (Feature-Sliced Design)', value: 'fsd' },
          { name: 'Clean Architecture', value: 'clean' },
          { name: 'MVC', value: 'mvc' },
          { name: 'Flat', value: 'flat' },
          { name: 'Custom', value: 'custom' },
        ],
        default: 'modular',
      },
      {
        type: 'list',
        name: 'testRunner',
        message: 'Test runner:',
        choices: ['vitest', 'jest', 'mocha', 'playwright'],
        default: 'vitest',
      },
      {
        type: 'list',
        name: 'linter',
        message: 'Linter:',
        choices: [
          { name: 'ESLint', value: 'eslint' },
          { name: 'Biome', value: 'biome' },
        ],
        default: 'eslint',
      },
      {
        type: 'list',
        name: 'formatter',
        message: 'Formatter:',
        choices: (prev: Record<string, string>) => {
          if (prev['linter'] === 'biome') {
            return [{ name: 'Biome (included)', value: 'biome' }];
          }
          return [
            { name: 'Prettier', value: 'prettier' },
            { name: 'Biome', value: 'biome' },
          ];
        },
        default: 'prettier',
      },
      {
        type: 'list',
        name: 'persona',
        message: 'AI agent persona:',
        choices: [
          { name: 'Senior Fullstack Developer', value: 'senior-fullstack-developer' },
          { name: 'Senior Frontend Developer', value: 'senior-frontend-developer' },
          { name: 'Senior Backend Developer', value: 'senior-backend-developer' },
          { name: 'Senior Architect', value: 'senior-architect' },
          { name: 'Junior Developer', value: 'junior-developer' },
        ],
        default: 'senior-fullstack-developer',
      },
    ]);

    const { aiAdapters } = await inquirer.prompt<{ aiAdapters: AgentType[] }>([
      {
        type: 'checkbox',
        name: 'aiAdapters',
        message: 'AI agent(s) to configure (select one or more):',
        choices: getAdapterChoices(),
        validate: (v: AgentType[]) => v.length > 0 || 'Select at least one AI agent',
      },
    ]);

    // ─── Step 2b: Rules preset ───
    const rules = await promptRulesPreset(answers.architecture);

    const projectName = (nameOrPath && !isPathArg(nameOrPath) ? nameOrPath : null) ?? root.split('/').pop() ?? 'my-project';

    // ─── Step 3: Build config ───
    const config = createDefaultConfig({
      project: {
        name: projectName,
        framework: answers.framework,
        packageManager: answers.packageManager,
        language: answers.language,
      },
      architecture: {
        style: answers.architecture,
        enforceIndexGen: true,
        forbiddenImports: getDefaultForbiddenImports(answers.architecture),
      },
      development: {
        linter: answers.linter,
        formatter: answers.formatter,
        styling: answers.styling,
      },
      testing: {
        runner: answers.testRunner,
        minCoverage: { statements: 80, branches: 75, functions: 80, lines: 80 },
        requireTestFileWithImplementation: true,
      },
      agent: {
        persona: answers.persona,
        allowedScopes: ['src/**/*', 'tests/**/*', 'public/**/*'],
        adapters: aiAdapters,
      },
      rules,
    });

    console.log('');

    // ─── Step 4: Create project with framework CLI ───
    const pm = answers.packageManager;
    const pmx = pm === 'pnpm' ? 'pnpx' : pm === 'bun' ? 'bunx' : 'npx';

    if (isNewProject) {
      console.log(chalk.blue('📦 Creating project...\n'));
      const createResult = await createFrameworkProject(root, projectName, answers.framework, pm, pmx);
      if (!createResult.success) {
        console.log(chalk.yellow(`⚠️  Framework scaffolding skipped: ${createResult.reason}`));
        console.log(chalk.dim('   Setting up a minimal project structure instead.\n'));
        await createMinimalProject(root, projectName, config);
      }
    }

    // ─── Step 5: Install dev dependencies ───
    console.log(chalk.blue('📦 Installing dev dependencies...\n'));
    const devDeps = collectDevDependencies(config);
    if (devDeps.length > 0) {
      const installCmd = buildInstallCommand(pm, devDeps, true);
      console.log(chalk.dim(`$ ${installCmd}\n`));
      const installResult = await runCommand(installCmd, root, 120_000);
      if (installResult.exitCode !== 0) {
        console.log(chalk.yellow(`⚠️  Some packages failed to install. You may need to run manually.`));
        console.log(chalk.dim(installResult.stderr.slice(0, 500)));
      } else {
        console.log(chalk.green(`✅ Installed ${devDeps.length} dev dependencies`));
      }
    }

    // ─── Step 6: Create directory structure ───
    console.log('');
    console.log(chalk.blue('📂 Creating directory structure...\n'));
    await createDirectoryStructure(root, config);
    console.log(chalk.green('✅ Directory structure created'));

    // ─── Step 7: Generate harness config + guardrail files ───
    await writeJson(resolvePath(root, 'harness.config.json'), withSchema(config, await resolveSchemaRef(root)));
    console.log(chalk.green('✅ harness.config.json'));

    for (const adapterType of aiAdapters) {
      const adapter = getAdapter(adapterType);
      const result = await adapter.generate(root, config);
      console.log(chalk.green(`✅ ${adapter.name}: ${result.description}`));
    }

    await generateHuskyHooks(root, config);
    console.log(chalk.green('✅ .husky/ (pre-commit, pre-push, post-merge, post-checkout)'));

    const lintStagedConfig = generateLintStagedConfig(config);
    await writeJson(resolvePath(root, '.lintstagedrc.json'), lintStagedConfig);
    console.log(chalk.green('✅ .lintstagedrc.json'));

    // ─── Step 8: Init git if needed ───
    if (!(await fileExists(resolvePath(root, '.git')))) {
      await runCommand('git init', root);
      console.log(chalk.green('✅ git init'));
    }

    // ─── Step 9: Generate tsconfig if TypeScript ───
    if (answers.language === 'typescript' && !(await fileExists(resolvePath(root, 'tsconfig.json')))) {
      await writeJson(resolvePath(root, 'tsconfig.json'), getTsConfig(answers.framework));
      console.log(chalk.green('✅ tsconfig.json'));
    }

    // ─── Done ───
    console.log(chalk.blue(`\n🎉 Project "${projectName}" is ready!\n`));
    console.log('Next steps:');
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan(`  harness analyze`) + chalk.dim('       — Define domain terms & feature specs'));
    console.log(chalk.cyan(`  harness sync --watch`) + chalk.dim('  — Start auto-sync (run alongside dev server)'));
    console.log(chalk.cyan(`  harness generate <type> <name>`) + chalk.dim('  — Scaffold files'));
    console.log(chalk.cyan(`  harness test`) + chalk.dim('          — Run tests with self-healing'));
    console.log('');
  });

// ─── Adopt mode handlers ───

async function handleNewProjectFrom(root: string, projectName: string, configPath: string): Promise<void> {
  const { readJson: readJ } = await import('../../utils/index.js');

  if (!(await fileExists(configPath))) {
    console.log(chalk.red(`\n❌ File not found: ${configPath}\n`));
    process.exitCode = 1;
    return;
  }

  const config = await readJ<HarnessConfig>(configPath);
  config.project.name = projectName;

  console.log(chalk.blue('\n🚀 Harness Project Initializer (non-interactive)\n'));

  // Create directory
  if (!(await fileExists(root))) {
    await ensureDir(root);
    console.log(chalk.green(`📁 Created ${root}\n`));
  }

  // Framework scaffolding
  const pm = config.project.packageManager;
  const pmx = pm === 'pnpm' ? 'pnpx' : pm === 'bun' ? 'bunx' : 'npx';

  console.log(chalk.blue('📦 Creating project...\n'));
  const createResult = await createFrameworkProject(root, projectName, config.project.framework, pm, pmx);
  if (!createResult.success) {
    console.log(chalk.yellow(`⚠️  Framework scaffolding skipped: ${createResult.reason}`));
    console.log(chalk.dim('   Setting up a minimal project structure instead.\n'));
    await createMinimalProject(root, projectName, config);
  }

  // Install dev dependencies
  console.log(chalk.blue('📦 Installing dev dependencies...\n'));
  const devDeps = collectDevDependencies(config);
  if (devDeps.length > 0) {
    const installCmd = buildInstallCommand(pm, devDeps, true);
    console.log(chalk.dim(`$ ${installCmd}\n`));
    const installResult = await runCommand(installCmd, root, 120_000);
    if (installResult.exitCode !== 0) {
      console.log(chalk.yellow(`⚠️  Some packages failed to install.`));
    } else {
      console.log(chalk.green(`✅ Installed ${devDeps.length} dev dependencies`));
    }
  }

  // Directory structure
  console.log(chalk.blue('\n📂 Creating directory structure...\n'));
  await createDirectoryStructure(root, config);
  console.log(chalk.green('✅ Directory structure created'));

  // Write config + adapter files
  await writeJson(resolvePath(root, 'harness.config.json'), withSchema(config, await resolveSchemaRef(root)));
  console.log(chalk.green('✅ harness.config.json'));

  const adapters = config.agent?.adapters ?? ['generic'];
  for (const adapterType of adapters) {
    const adapter = getAdapter(adapterType);
    const result = await adapter.generate(root, config);
    console.log(chalk.green(`✅ ${adapter.name}: ${result.description}`));
  }

  // Husky + lint-staged
  await generateHuskyHooks(root, config);
  console.log(chalk.green('✅ .husky/'));

  const lintStagedConfig = generateLintStagedConfig(config);
  await writeJson(resolvePath(root, '.lintstagedrc.json'), lintStagedConfig);
  console.log(chalk.green('✅ .lintstagedrc.json'));

  // Git init
  if (!(await fileExists(resolvePath(root, '.git')))) {
    await runCommand('git init', root);
    console.log(chalk.green('✅ git init'));
  }

  // tsconfig
  if (config.project.language === 'typescript' && !(await fileExists(resolvePath(root, 'tsconfig.json')))) {
    await writeJson(resolvePath(root, 'tsconfig.json'), getTsConfig(config.project.framework));
    console.log(chalk.green('✅ tsconfig.json'));
  }

  console.log(chalk.blue(`\n🎉 Project "${projectName}" is ready!\n`));
}

async function handleAdoptFrom(root: string, configPath: string): Promise<void> {
  const { readJson: readJ } = await import('../../utils/index.js');
  const resolvedPath = resolve(configPath);

  if (!(await fileExists(resolvedPath))) {
    console.log(chalk.red(`\n❌ File not found: ${resolvedPath}\n`));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.blue('\n🔧 Adopting harness into existing project\n'));

  const config = await readJ<HarnessConfig>(resolvedPath);

  // Write harness.config.json
  await writeJson(resolvePath(root, 'harness.config.json'), withSchema(config, await resolveSchemaRef(root)));
  console.log(chalk.green('✅ harness.config.json'));

  // Generate adapter files only (safe — no husky, no lint-staged, no deps)
  const adapters = config.agent?.adapters ?? ['generic'];
  for (const adapterType of adapters) {
    const adapter = getAdapter(adapterType);
    const result = await adapter.generate(root, config);
    console.log(chalk.green(`✅ ${adapter.name}: ${result.description}`));
  }

  console.log(chalk.blue('\n🎉 Harness adopted successfully!\n'));
  console.log(chalk.dim('What was created:'));
  console.log(chalk.dim('  - harness.config.json'));
  console.log(chalk.dim('  - AI agent instruction files'));
  console.log('');
  console.log(chalk.dim('What was NOT touched:'));
  console.log(chalk.dim('  - Existing husky hooks'));
  console.log(chalk.dim('  - Existing lint-staged config'));
  console.log(chalk.dim('  - Existing ESLint/Prettier config'));
  console.log(chalk.dim('  - Existing directory structure'));
  console.log('');
  console.log('Next steps:');
  console.log(chalk.cyan('  harness sync --watch') + chalk.dim('  — Auto-sync on config changes'));
  console.log(chalk.cyan('  harness generate <type> <name>') + chalk.dim('  — Scaffold files'));
  console.log('');
}

async function handleAdoptInteractive(root: string): Promise<void> {
  console.log(chalk.blue('\n🔧 Existing project detected — adopting harness\n'));

  const { config, detected } = await discoverProject(root);

  console.log(chalk.dim('Detected:'));
  console.log(chalk.dim(`  Framework: ${detected.framework} | PM: ${detected.packageManager} | Language: ${detected.language}`));
  console.log(chalk.dim(`  Linter: ${detected.linter} | Formatter: ${detected.formatter} | Test: ${detected.testRunner}`));
  console.log(chalk.dim(`  Architecture: ${detected.architecture} | Monorepo: ${detected.monorepo}`));
  console.log(chalk.dim(`  AI agents: ${detected.adapters}`));
  console.log('');

  // Write config only — adapter files are generated by `harness sync`
  await writeJson(resolvePath(root, 'harness.config.json'), withSchema(config, await resolveSchemaRef(root)));
  console.log(chalk.green('✅ harness.config.json'));

  console.log(chalk.blue('\n🎉 Harness adopted successfully!\n'));
  console.log(chalk.dim('Existing husky/lint-staged/ESLint configs were NOT modified.'));
  console.log('');
  console.log('Next steps:');
  console.log(chalk.cyan('  1.') + ' Customize rules in ' + chalk.cyan('harness.config.json'));
  console.log(chalk.dim('     rules.codingStandards, rules.fileNaming, rules.scaffolderTypes, rules.testScope'));
  console.log(chalk.cyan('  2.') + ' Generate adapter files: ' + chalk.cyan('harness sync'));
  console.log('');
}

// ─── Rules presets ───

type RulesPreset = 'default' | 'strict' | 'minimal' | 'custom';

const STRICT_STANDARDS: CodingStandard[] = [
  { id: 'no-enum', description: 'Do not use enum. Use as const object instead', severity: 'error' },
  { id: 'no-any', description: 'Do not use any type. Use unknown instead', severity: 'error' },
  { id: 'no-non-null-assertion', description: 'Do not use non-null assertion (!). Use proper null checks', severity: 'error' },
  { id: 'strict-equality', description: 'Always use === and !== instead of == and !=', severity: 'error' },
  { id: 'sort-imports', description: 'Keep imports sorted alphabetically', severity: 'warn' },
];

const AVAILABLE_STANDARDS: Array<{ name: string; value: CodingStandard }> = [
  { name: 'no-enum (use as const instead)', value: { id: 'no-enum', description: 'Do not use enum. Use as const object instead', severity: 'error' } },
  { name: 'no-any (use unknown instead)', value: { id: 'no-any', description: 'Do not use any type. Use unknown instead', severity: 'error' } },
  { name: 'no-non-null-assertion (no ! operator)', value: { id: 'no-non-null-assertion', description: 'Do not use non-null assertion (!). Use proper null checks', severity: 'error' } },
  { name: 'strict-equality (=== only)', value: { id: 'strict-equality', description: 'Always use === and !== instead of == and !=', severity: 'error' } },
  { name: 'sort-imports (alphabetical)', value: { id: 'sort-imports', description: 'Keep imports sorted alphabetically', severity: 'warn' } },
  { name: 'prefer-optional-chaining (?. operator)', value: { id: 'prefer-optional-chaining', description: 'Use optional chaining (?.) instead of manual null checks', severity: 'warn' } },
  { name: 'template-literals (no string concatenation)', value: { id: 'template-literals', description: 'Use template literals instead of string concatenation', severity: 'warn' } },
  { name: 'no-inline-styles (CSS classes only)', value: { id: 'no-inline-styles', description: 'Do not use inline styles. Use CSS classes or utility framework', severity: 'warn' } },
];

function getArchitectureScaffolderTypes(style: ArchitectureStyle): Record<string, { directory: string; naming: NamingConvention }> {
  switch (style) {
    case 'fsd':
      return {
        feature: { directory: 'src/features', naming: 'kebab-case' },
        entity: { directory: 'src/entities', naming: 'kebab-case' },
        widget: { directory: 'src/widgets', naming: 'kebab-case' },
      };
    case 'clean':
      return {
        usecase: { directory: 'src/application/usecases', naming: 'PascalCase' },
        repository: { directory: 'src/domain/repositories', naming: 'PascalCase' },
      };
    default:
      return {};
  }
}

function buildPresetRules(preset: RulesPreset, architecture: ArchitectureStyle): RulesConfig {
  const archTypes = getArchitectureScaffolderTypes(architecture);

  switch (preset) {
    case 'strict':
      return {
        fileNaming: {
          components: 'PascalCase',
          hooks: 'camelCase',
          utils: 'camelCase',
          services: 'camelCase',
          models: 'camelCase',
          testSuffix: '.test',
        },
        codingStandards: STRICT_STANDARDS,
        testScope: {},
        scaffolderTypes: archTypes,
      };
    case 'minimal':
      return {
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
        scaffolderTypes: archTypes,
      };
    case 'default':
    default:
      return {
        fileNaming: {
          components: 'PascalCase',
          hooks: 'camelCase',
          utils: 'camelCase',
          services: 'camelCase',
          models: 'camelCase',
          testSuffix: '.test',
        },
        codingStandards: [
          { id: 'no-enum', description: 'Do not use enum. Use as const object instead', severity: 'error' },
          { id: 'no-any', description: 'Do not use any type. Use unknown instead', severity: 'error' },
        ],
        testScope: {},
        scaffolderTypes: archTypes,
      };
  }
}

async function promptRulesPreset(architecture: ArchitectureStyle): Promise<RulesConfig> {
  const { preset } = await inquirer.prompt<{ preset: RulesPreset }>([{
    type: 'list',
    name: 'preset',
    message: 'Rules preset:',
    choices: [
      { name: 'Default — opinionated defaults (no-enum, no-any)', value: 'default' },
      { name: 'Strict — all recommended coding standards', value: 'strict' },
      { name: 'Minimal — no coding standards enforced', value: 'minimal' },
      { name: 'Custom — pick individual rules', value: 'custom' },
    ],
    default: 'default',
  }]);

  if (preset !== 'custom') {
    return buildPresetRules(preset, architecture);
  }

  // ─── Custom mode ───
  const { fileNaming } = await inquirer.prompt<{ fileNaming: NamingConvention }>([{
    type: 'list',
    name: 'fileNaming',
    message: 'Component file naming:',
    choices: [
      { name: 'PascalCase (UserProfile.tsx)', value: 'PascalCase' },
      { name: 'kebab-case (user-profile.tsx)', value: 'kebab-case' },
      { name: 'camelCase (userProfile.tsx)', value: 'camelCase' },
      { name: 'snake_case (user_profile.tsx)', value: 'snake_case' },
    ],
    default: 'PascalCase',
  }]);

  const { selectedStandards } = await inquirer.prompt<{ selectedStandards: CodingStandard[] }>([{
    type: 'checkbox',
    name: 'selectedStandards',
    message: 'Coding standards to enforce:',
    choices: AVAILABLE_STANDARDS,
  }]);

  const { testSuffix } = await inquirer.prompt<{ testSuffix: string }>([{
    type: 'list',
    name: 'testSuffix',
    message: 'Test file suffix:',
    choices: [
      { name: '.test (UserProfile.test.tsx)', value: '.test' },
      { name: '.spec (UserProfile.spec.tsx)', value: '.spec' },
    ],
    default: '.test',
  }]);

  const archTypes = getArchitectureScaffolderTypes(architecture);

  return {
    fileNaming: {
      components: fileNaming,
      hooks: 'camelCase',
      utils: 'camelCase',
      services: 'camelCase',
      models: 'camelCase',
      testSuffix,
    },
    codingStandards: selectedStandards,
    testScope: {},
    scaffolderTypes: archTypes,
  };
}

// ─── Framework project creators ───

interface CreateResult {
  success: boolean;
  reason?: string;
}

async function createFrameworkProject(
  root: string,
  _name: string,
  framework: Framework,
  pm: PackageManager,
  pmx: string,
): Promise<CreateResult> {
  const parentDir = resolve(root, '..');
  const dirName = root.split('/').pop()!;

  const commandMap: Partial<Record<Framework, string>> = {
    'nextjs': `${pmx} create-next-app@latest ${dirName} --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-${pm} --no-turbopack`,
    'vite-react': `${pmx} create-vite@latest ${dirName} -- --template react-ts`,
    'vite-vue': `${pmx} create-vite@latest ${dirName} -- --template vue-ts`,
    'nuxt': `${pmx} nuxi@latest init ${dirName}`,
    'svelte': `${pmx} sv create ${dirName}`,
    'remix': `${pmx} create-remix@latest ${dirName}`,
    'astro': `${pmx} create-astro@latest ${dirName}`,
    'nest': `${pmx} @nestjs/cli@latest new ${dirName} --package-manager ${pm}`,
  };

  const cmd = commandMap[framework];
  if (!cmd) {
    return { success: false, reason: `No scaffolding template for "${framework}"` };
  }

  console.log(chalk.dim(`$ ${cmd}\n`));
  const result = await runCommand(cmd, parentDir, 180_000);

  if (result.exitCode !== 0) {
    return { success: false, reason: result.stderr.slice(0, 300) };
  }

  return { success: true };
}

async function createMinimalProject(
  root: string,
  projectName: string,
  config: HarnessConfig,
): Promise<void> {
  const pm = config.project.packageManager;

  if (!(await fileExists(resolvePath(root, 'package.json')))) {
    const pkgJson = {
      name: projectName,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: getDefaultScripts(config),
    };
    await writeJson(resolvePath(root, 'package.json'), pkgJson);
  }

  const initCmd = pm === 'pnpm' ? 'pnpm install' : pm === 'bun' ? 'bun install' : pm === 'yarn' ? 'yarn' : 'npm install';
  await runCommand(initCmd, root, 60_000);
}

// ─── Dev dependency collector ───

function collectDevDependencies(config: HarnessConfig): string[] {
  const deps: string[] = [];

  // Test runner
  switch (config.testing.runner) {
    case 'vitest': deps.push('vitest', '@vitest/coverage-v8'); break;
    case 'jest': deps.push('jest', '@types/jest', 'ts-jest'); break;
    case 'mocha': deps.push('mocha', '@types/mocha', 'chai'); break;
    case 'playwright': deps.push('@playwright/test'); break;
  }

  // Linter
  if (config.development.linter === 'biome') {
    deps.push('@biomejs/biome');
  } else {
    deps.push('eslint');
  }

  // Formatter
  if (config.development.formatter === 'prettier' && config.development.linter !== 'biome') {
    deps.push('prettier');
  }

  // TypeScript
  if (config.project.language === 'typescript') {
    deps.push('typescript', '@types/node');
  }

  // Git hooks
  deps.push('husky', 'lint-staged');

  return deps;
}

function buildInstallCommand(pm: PackageManager, packages: string[], dev: boolean): string {
  const devFlag = dev ? '-D' : '';
  switch (pm) {
    case 'pnpm': return `pnpm add ${devFlag} ${packages.join(' ')}`;
    case 'yarn': return `yarn add ${dev ? '--dev' : ''} ${packages.join(' ')}`;
    case 'bun': return `bun add ${dev ? '-d' : ''} ${packages.join(' ')}`;
    default: return `npm install ${devFlag} ${packages.join(' ')}`;
  }
}

// ─── Directory structure ───

async function createDirectoryStructure(root: string, config: HarnessConfig): Promise<void> {
  const dirs = ['src', 'tests', 'public', 'docs'];

  switch (config.architecture.style) {
    case 'fsd':
      dirs.push(
        'src/app', 'src/pages', 'src/widgets', 'src/features',
        'src/entities', 'src/shared', 'src/shared/ui', 'src/shared/lib',
      );
      break;
    case 'clean':
      dirs.push(
        'src/domain', 'src/application', 'src/infrastructure', 'src/presentation',
      );
      break;
    case 'mvc':
      dirs.push('src/models', 'src/views', 'src/controllers', 'src/routes');
      break;
    case 'modular':
    default:
      dirs.push(
        'src/components', 'src/hooks', 'src/utils', 'src/services',
        'src/models', 'src/types',
      );
      break;
  }

  for (const dir of dirs) {
    await ensureDir(resolvePath(root, dir));
  }

  // Create .gitkeep in empty dirs
  for (const dir of dirs) {
    const fullDir = resolvePath(root, dir);
    const gitkeep = resolvePath(fullDir, '.gitkeep');
    if (!(await fileExists(gitkeep))) {
      await writeText(gitkeep, '');
    }
  }
}

// ─── Default forbidden imports per architecture ───

function getDefaultForbiddenImports(style: ArchitectureStyle): Record<string, string[]> {
  switch (style) {
    case 'fsd':
      return {
        'shared/*': ['features/*', 'entities/*', 'pages/*', 'widgets/*'],
        'entities/*': ['features/*', 'pages/*', 'widgets/*'],
        'features/*': ['pages/*', 'widgets/*'],
      };
    case 'clean':
      return {
        'domain/*': ['application/*', 'infrastructure/*', 'presentation/*'],
        'application/*': ['infrastructure/*', 'presentation/*'],
      };
    case 'mvc':
      return {
        'models/*': ['controllers/*', 'views/*'],
      };
    default:
      return {};
  }
}

// ─── Default scripts per framework ───

function getDefaultScripts(config: HarnessConfig): Record<string, string> {
  const lint = config.development.linter === 'biome' ? 'biome check .' : 'eslint src/';
  const test = `${config.testing.runner} run`;

  const scriptMap: Partial<Record<Framework, { dev: string; build: string }>> = {
    'nextjs': { dev: 'next dev', build: 'next build' },
    'nuxt': { dev: 'nuxt dev', build: 'nuxt build' },
    'svelte': { dev: 'vite dev', build: 'vite build' },
    'remix': { dev: 'remix vite:dev', build: 'remix vite:build' },
    'astro': { dev: 'astro dev', build: 'astro build' },
    'vite-react': { dev: 'vite', build: 'vite build' },
    'vite-vue': { dev: 'vite', build: 'vite build' },
    'express': { dev: 'tsx watch src/index.ts', build: 'tsc' },
    'fastify': { dev: 'tsx watch src/index.ts', build: 'tsc' },
    'nest': { dev: 'nest start --watch', build: 'nest build' },
  };

  const match = scriptMap[config.project.framework];

  return {
    dev: match?.dev ?? 'tsx watch src/index.ts',
    build: match?.build ?? 'tsc',
    test,
    lint,
  };
}

// ─── TypeScript config ───

function getTsConfig(framework: Framework): Record<string, unknown> {
  const base = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
      declaration: true,
      paths: { '@/*': ['./src/*'] },
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  if (framework === 'nextjs') {
    return {
      ...base,
      compilerOptions: {
        ...base.compilerOptions,
        jsx: 'preserve',
        plugins: [{ name: 'next' }],
      },
    };
  }

  if (['vite-react', 'remix'].includes(framework)) {
    return {
      ...base,
      compilerOptions: { ...base.compilerOptions, jsx: 'react-jsx' },
    };
  }

  return base;
}
