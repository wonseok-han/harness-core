import { Command } from 'commander';
import chalk from 'chalk';
import { watch } from 'node:fs';
import { loadConfig } from '../../config/index.js';
import {
  generateHuskyHooks,
  generateLintStagedConfig,
  checkForbiddenImports,
} from '../../engines/policy/index.js';
import { getAdapter } from '../../engines/adapters/index.js';
import { writeJson, resolvePath } from '../../utils/index.js';

export const syncCommand = new Command('sync')
  .description('Synchronize architecture rules and regenerate guardrail files')
  .option('--root <path>', 'Project root directory', process.cwd())
  .option('--check', 'Only check for violations without regenerating files')
  .option('--watch', 'Watch harness.config.json and auto-sync on changes')
  .action(async (options: { root: string; check?: boolean; watch?: boolean }) => {
    const root = options.root;

    if (options.watch) {
      await runWatchMode(root);
      return;
    }

    await runSync(root, options.check ?? false);
  });

async function runSync(root: string, checkOnly: boolean): Promise<boolean> {
  const config = await loadConfig(root);

  console.log(chalk.blue(`\n🔄 Syncing guardrails for ${config.project.name}\n`));

  const violations = await checkForbiddenImports(root, config.architecture.forbiddenImports);
  if (violations.length > 0) {
    console.log(chalk.red(`❌ ${violations.length} import violation(s) found:\n`));
    for (const v of violations) {
      console.log(`  ${chalk.red('✗')} ${v.file}: imports "${v.importPath}"`);
      console.log(`    Rule: ${chalk.dim(v.rule)}`);
    }
    console.log('');
  } else {
    console.log(chalk.green('✅ No import violations'));
  }

  if (checkOnly) {
    process.exitCode = violations.length > 0 ? 1 : 0;
    return violations.length === 0;
  }

  const adapters = config.agent.adapters ?? ['generic'];
  for (const adapterType of adapters) {
    const adapter = getAdapter(adapterType);
    const result = await adapter.generate(root, config);
    console.log(chalk.green(`✅ ${adapter.name}: ${result.description}`));
  }

  await generateHuskyHooks(root, config);
  console.log(chalk.green('✅ .husky/ (pre-commit, pre-push, post-merge, post-checkout)'));

  const lintStagedConfig = generateLintStagedConfig(config);
  await writeJson(resolvePath(root, '.lintstagedrc.json'), lintStagedConfig);
  console.log(chalk.green('✅ Generated .lintstagedrc.json'));

  console.log(chalk.blue('\n✨ Architecture rules synchronized!\n'));
  return violations.length === 0;
}

async function runWatchMode(root: string): Promise<void> {
  const configPath = resolvePath(root, 'harness.config.json');

  console.log(chalk.blue('\n👁  Watch mode — monitoring harness.config.json for changes'));
  console.log(chalk.dim('   Press Ctrl+C to stop\n'));

  // Initial sync
  await runSync(root, false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  watch(configPath, (_eventType) => {
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      console.log(chalk.yellow(`\n⚡ harness.config.json changed — re-syncing...\n`));
      try {
        await runSync(root, false);
      } catch (err) {
        console.log(chalk.red(`Sync error: ${err instanceof Error ? err.message : err}`));
      }
    }, 300);
  });

  // Keep process alive
  await new Promise(() => {});
}
