import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { planCommand } from './commands/plan.js';
import { analyzeCommand } from './commands/analyze.js';
import { designCommand } from './commands/design.js';
import { syncCommand } from './commands/sync.js';
import { testCommand } from './commands/test.js';
import { generateCommand } from './commands/generate.js';

const program = new Command();

program
  .name('harness')
  .description('Universal AI Harness Framework — SDLC guardrails for AI agents')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(planCommand);
program.addCommand(analyzeCommand);
program.addCommand(designCommand);
program.addCommand(syncCommand);
program.addCommand(testCommand);
program.addCommand(generateCommand);

program.parse();
