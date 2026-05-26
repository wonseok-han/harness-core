import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { resolve } from 'node:path';
import { generateHuskyHooks, generateLintStagedConfig } from '../../engines/policy/index.js';
import { getAdapter, getAdapterChoices } from '../../engines/adapters/index.js';
import { writeJson, writeText, ensureDir, resolvePath, fileExists } from '../../utils/index.js';
import { runCommand } from '../../utils/index.js';
import { createDefaultConfig } from '../../config/defaults.js';
import type {
  HarnessConfig,
  Framework,
  PackageManager,
  ArchitectureStyle,
  AgentType,
} from '../../types/index.js';

export const initCommand = new Command('init')
  .description('Create a new project with full environment setup')
  .argument('[name]', 'Project name (creates directory)')
  .option('--root <path>', 'Initialize in an existing directory instead of creating new one')
  .action(async (name: string | undefined, options: { root?: string }) => {
    console.log(chalk.blue('\n🚀 Harness Project Initializer\n'));

    // ─── Step 1: Determine project root ───
    let root: string;
    let isNewProject: boolean;

    if (options.root) {
      root = resolve(options.root);
      isNewProject = false;
      console.log(chalk.dim(`Initializing in existing directory: ${root}\n`));
    } else if (name) {
      root = resolve(process.cwd(), name);
      isNewProject = true;
    } else {
      const { projectName } = await inquirer.prompt<{ projectName: string }>([{
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        validate: (v: string) => v.trim().length > 0 || 'Name is required',
      }]);
      name = projectName.trim();
      root = resolve(process.cwd(), name);
      isNewProject = true;
    }

    if (isNewProject) {
      if (await fileExists(root)) {
        const { proceed } = await inquirer.prompt<{ proceed: boolean }>([{
          type: 'confirm',
          name: 'proceed',
          message: `Directory "${name}" already exists. Initialize inside it?`,
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

    const projectName = name ?? root.split('/').pop() ?? 'my-project';

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
    await writeJson(resolvePath(root, 'harness.config.json'), config);
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
