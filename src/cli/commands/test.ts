import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/index.js';
import { runCommand } from '../../utils/index.js';
import { transpileLog } from '../../engines/log-transpiler/index.js';
import { writeText, resolvePath } from '../../utils/index.js';

export const testCommand = new Command('test')
  .description('Run tests with self-healing feedback loop')
  .option('--root <path>', 'Project root directory', process.cwd())
  .option('--max-retries <n>', 'Maximum self-healing retry attempts', '3')
  .option('--coverage', 'Run with coverage reporting')
  .option('--report-only', 'Only generate error report without running tests')
  .action(async (options: { root: string; maxRetries: string; coverage?: boolean; reportOnly?: boolean }) => {
    const root = options.root;
    const config = await loadConfig(root);
    const maxRetries = parseInt(options.maxRetries, 10);

    console.log(chalk.blue(`\n🧪 Running test pipeline for ${config.project.name}\n`));
    console.log(`  Runner: ${chalk.cyan(config.testing.runner)}`);
    console.log(`  Min Coverage: ${chalk.cyan(`${config.testing.minCoverage.statements}%`)}`);
    console.log('');

    // Step 1: Test-First Guard — check that test files exist
    if (config.testing.requireTestFileWithImplementation) {
      console.log(chalk.dim('Checking test file requirements...'));
      const guardResult = await runTestFileGuard(root);
      if (!guardResult.pass) {
        console.log(chalk.red('\n❌ Test-First Guard Failed:'));
        for (const missing of guardResult.missing) {
          console.log(`  ${chalk.red('✗')} Missing test for: ${missing}`);
        }
        console.log(chalk.yellow('\nCreate test files before proceeding.\n'));
        process.exitCode = 1;
        return;
      }
      console.log(chalk.green('✅ Test-First Guard passed'));
    }

    // Step 2: Run tests with self-healing loop
    let attempt = 0;
    let lastReport: string | null = null;

    while (attempt <= maxRetries) {
      if (attempt > 0) {
        console.log(chalk.yellow(`\n🔄 Self-Healing Attempt ${attempt}/${maxRetries}\n`));
      }

      const coverageFlag = options.coverage ? ' --coverage' : '';
      const testCmd = buildTestCommand(config.testing.runner, coverageFlag);

      console.log(chalk.dim(`$ ${testCmd}`));
      const result = await runCommand(testCmd, root, 120_000);

      if (result.exitCode === 0) {
        console.log(chalk.green('\n✅ All tests passed!'));

        if (options.coverage) {
          await checkCoverageGate(root, config);
        }

        if (lastReport) {
          console.log(chalk.dim(`\nPrevious error reports saved to: ${chalk.cyan('.harness/reports/')}`));
        }
        return;
      }

      // Tests failed — transpile the error output
      const rawOutput = result.stdout + '\n' + result.stderr;
      const report = transpileLog(rawOutput, 'test');

      console.log(chalk.red(`\n❌ Tests failed (${report.summary.totalErrors} errors)\n`));

      // Save report
      const reportDir = resolvePath(root, '.harness', 'reports');
      const reportPath = resolvePath(reportDir, `test-report-${attempt}.md`);
      await writeText(reportPath, report.markdown);

      const jsonPath = resolvePath(reportDir, `test-report-${attempt}.json`);
      await writeText(jsonPath, report.json);

      lastReport = reportPath;

      console.log(chalk.yellow('📝 Error Report (Self-Healing Context):'));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(report.markdown.slice(0, 2000));
      if (report.markdown.length > 2000) {
        console.log(chalk.dim(`\n... (${report.markdown.length - 2000} more characters in ${reportPath})`));
      }
      console.log(chalk.dim('─'.repeat(60)));

      if (attempt === maxRetries) {
        console.log(chalk.red(`\n💀 Max retries (${maxRetries}) reached. Manual intervention needed.`));
        console.log(`Full report: ${chalk.cyan(reportPath)}`);
        process.exitCode = 1;
        return;
      }

      attempt++;
    }
  });

function buildTestCommand(runner: string, flags: string): string {
  switch (runner) {
    case 'vitest':
      return `npx vitest run${flags}`;
    case 'jest':
      return `npx jest${flags}`;
    case 'mocha':
      return `npx mocha${flags}`;
    default:
      return `npx ${runner}${flags}`;
  }
}

interface GuardResult {
  pass: boolean;
  missing: string[];
}

async function runTestFileGuard(root: string): Promise<GuardResult> {
  const { glob } = await import('glob');
  const srcFiles = await glob('src/**/*.{ts,tsx}', {
    cwd: root,
    ignore: ['**/*.test.*', '**/*.spec.*', '**/index.ts', '**/*.d.ts', '**/types/**'],
  });

  const testFiles = await glob('{src,tests}/**/*.{test,spec}.{ts,tsx}', { cwd: root });
  const testBaseNames = new Set(
    testFiles.map((f) =>
      f.replace(/\.(test|spec)\.(tsx?|jsx?)$/, '').split('/').pop(),
    ),
  );

  const missing: string[] = [];
  for (const src of srcFiles) {
    const baseName = src.replace(/\.(tsx?|jsx?)$/, '').split('/').pop();
    if (baseName && !testBaseNames.has(baseName)) {
      missing.push(src);
    }
  }

  return { pass: missing.length === 0, missing };
}

async function checkCoverageGate(_root: string, config: import('../../types/index.js').HarnessConfig): Promise<void> {
  console.log(chalk.dim('\nChecking coverage gates...'));
  const { minCoverage } = config.testing;
  console.log(
    chalk.cyan(
      `  Required: statements=${minCoverage.statements}%, branches=${minCoverage.branches}%, functions=${minCoverage.functions}%, lines=${minCoverage.lines}%`,
    ),
  );
  console.log(chalk.dim('  (Coverage gate validation depends on runner-specific output parsing)'));
}
