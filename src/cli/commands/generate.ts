import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/index.js';
import { scaffold } from '../../engines/agent-tools/index.js';
import type { ScaffoldType } from '../../engines/agent-tools/index.js';

const VALID_TYPES: ScaffoldType[] = ['component', 'hook', 'util', 'service', 'model', 'test'];

export const generateCommand = new Command('generate')
  .description('Scaffold a new file with standardized structure')
  .argument('<type>', `Type to generate: ${VALID_TYPES.join(', ')}`)
  .argument('<name>', 'Name for the generated entity (e.g., UserProfile)')
  .option('--root <path>', 'Project root directory', process.cwd())
  .action(async (type: string, name: string, options: { root: string }) => {
    const root = options.root;

    if (!VALID_TYPES.includes(type as ScaffoldType)) {
      console.log(chalk.red(`\n❌ Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}\n`));
      process.exitCode = 1;
      return;
    }

    const config = await loadConfig(root);

    console.log(chalk.blue(`\n🏗️  Generating ${type}: ${name}\n`));

    const result = await scaffold(root, config, type as ScaffoldType, name);

    if (result.created.length > 0) {
      console.log(chalk.green('Created:'));
      for (const file of result.created) {
        console.log(`  ${chalk.green('+')} ${file}`);
      }
    }

    if (result.skipped.length > 0) {
      console.log(chalk.yellow('\nSkipped (already exists):'));
      for (const file of result.skipped) {
        console.log(`  ${chalk.yellow('⏭')} ${file}`);
      }
    }

    console.log('');
  });
