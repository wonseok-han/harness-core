import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/index.js';
import { scaffold, getAvailableTypes } from '../../engines/agent-tools/index.js';

const BUILTIN_TYPES = ['component', 'hook', 'util', 'service', 'model'];

export const generateCommand = new Command('generate')
  .description('Scaffold a new file with standardized structure')
  .argument('<type>', `Type to generate (built-in: ${BUILTIN_TYPES.join(', ')}, or custom types from rules.scaffolderTypes)`)
  .argument('<name>', 'Name for the generated entity (e.g., UserProfile)')
  .option('--root <path>', 'Project root directory', process.cwd())
  .action(async (type: string, name: string, options: { root: string }) => {
    const root = options.root;
    const config = await loadConfig(root);
    const validTypes = getAvailableTypes(config);

    if (!validTypes.includes(type)) {
      console.log(chalk.red(`\n❌ Invalid type "${type}". Must be one of: ${validTypes.join(', ')}\n`));
      process.exitCode = 1;
      return;
    }

    console.log(chalk.blue(`\n🏗️  Generating ${type}: ${name}\n`));

    const result = await scaffold(root, config, type, name);

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
