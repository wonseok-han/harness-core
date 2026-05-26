import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { readdir } from 'node:fs/promises';
import { loadConfig } from '../../config/index.js';
import { writeJson, writeText, readJson, readText, fileExists, resolvePath, ensureDir } from '../../utils/index.js';
import type { PlanSpec, PlannedFeature, Milestone } from '../../types/index.js';

interface PlanInput {
  goal: string;
  features: PlannedFeature[];
  milestones?: Milestone[];
}

export const planCommand = new Command('plan')
  .description('Define project plan — features, priorities, milestones')
  .option('--root <path>', 'Project root directory', process.cwd())
  .option('--scan', 'Scan existing specs and output context as JSON (for AI agents)')
  .option('--from <file>', 'Import plan from JSON file (for AI agents)')
  .action(async (options: { root: string; scan?: boolean; from?: string }) => {
    const root = options.root;
    const config = await loadConfig(root);

    if (options.scan) {
      await runScan(root, config.project.name);
      return;
    }

    if (options.from) {
      await runFromFile(root, options.from, config.project.name);
      return;
    }

    await runInteractive(root, config.project.name);
  });

// ─── --scan: Output context for AI agent ───

async function runScan(root: string, projectName: string): Promise<void> {
  const scan: Record<string, unknown> = {
    project: projectName,
    instructions: 'Create a project plan with features, priorities, and milestones. Then run: harness plan --from <file>',
  };

  // Existing glossary
  const glossaryPath = resolvePath(root, 'domain-glossary.json');
  if (await fileExists(glossaryPath)) {
    scan.glossary = await readJson(glossaryPath);
  }

  // Existing feature specs
  const featuresDir = resolvePath(root, 'docs', 'features');
  if (await fileExists(featuresDir)) {
    const files = await listMdFiles(featuresDir);
    const specs: Record<string, string> = {};
    for (const file of files) {
      const content = await readText(resolvePath(featuresDir, file));
      specs[file.replace('.md', '')] = content.split('\n').slice(0, 5).join('\n');
    }
    scan.existingFeatureSpecs = specs;
  }

  // Existing plan
  const planPath = resolvePath(root, 'docs', 'plan.json');
  if (await fileExists(planPath)) {
    scan.existingPlan = await readJson(planPath);
  }

  scan.expectedFormat = {
    goal: 'string — overall project goal',
    features: [
      {
        name: 'string — feature name (should match docs/features/*.md)',
        priority: 'high | medium | low',
        description: 'string — what this feature does',
        dependencies: ['optional — other feature names this depends on'],
        milestone: 'optional — milestone name',
      },
    ],
    milestones: [
      {
        name: 'string — milestone name',
        targetDate: 'optional — YYYY-MM-DD',
        features: ['feature names included in this milestone'],
      },
    ],
  };

  console.log(JSON.stringify(scan, null, 2));
}

// ─── --from: Import plan from JSON ───

async function runFromFile(root: string, filePath: string, projectName: string): Promise<void> {
  const resolvedPath = resolvePath(root, filePath);

  if (!(await fileExists(resolvedPath))) {
    console.error(chalk.red(`File not found: ${resolvedPath}`));
    process.exitCode = 1;
    return;
  }

  const raw = await readText(resolvedPath);
  let input: PlanInput;
  try {
    input = JSON.parse(raw) as PlanInput;
  } catch {
    console.error(chalk.red('Invalid JSON file'));
    process.exitCode = 1;
    return;
  }

  if (!input.goal || !input.features || input.features.length === 0) {
    console.error(chalk.red('JSON must contain "goal" and "features" (non-empty array)'));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.blue(`\n📋 Importing plan for ${projectName}\n`));

  const plan: PlanSpec = {
    goal: input.goal,
    features: input.features,
    milestones: input.milestones,
  };

  // Save plan.json
  const docsDir = resolvePath(root, 'docs');
  await ensureDir(docsDir);
  await writeJson(resolvePath(docsDir, 'plan.json'), plan);
  console.log(chalk.green(`✅ docs/plan.json (${plan.features.length} features)`));

  // Generate plan.md
  const markdown = renderPlanMarkdown(plan, projectName);
  await writeText(resolvePath(docsDir, 'plan.md'), markdown);
  console.log(chalk.green('✅ docs/plan.md'));

  console.log(chalk.blue('\n✨ Plan created!\n'));
  printPlanSummary(plan);
}

// ─── Interactive mode ───

async function runInteractive(root: string, projectName: string): Promise<void> {
  console.log(chalk.blue(`\n📋 Project Planning for ${projectName}\n`));

  const { goal } = await inquirer.prompt<{ goal: string }>([{
    type: 'input',
    name: 'goal',
    message: 'What is the overall goal of this project?',
  }]);

  const features: PlannedFeature[] = [];
  let adding = true;

  console.log(chalk.blue('\n📝 Define features to build:\n'));

  while (adding) {
    const { name } = await inquirer.prompt<{ name: string }>([{
      type: 'input',
      name: 'name',
      message: `Feature name ${chalk.dim('(empty to finish)')}:`,
    }]);

    if (!name.trim()) {
      adding = false;
      continue;
    }

    const { priority, description } = await inquirer.prompt<{
      priority: 'high' | 'medium' | 'low';
      description: string;
    }>([
      {
        type: 'list',
        name: 'priority',
        message: '  Priority:',
        choices: ['high', 'medium', 'low'],
        default: 'medium',
      },
      {
        type: 'input',
        name: 'description',
        message: '  Description:',
      },
    ]);

    features.push({ name: name.trim(), priority, description });
    console.log(chalk.green(`  ✓ Added "${name.trim()}" [${priority}]\n`));
  }

  if (features.length === 0) {
    console.log(chalk.yellow('No features defined. Aborted.'));
    return;
  }

  const plan: PlanSpec = { goal, features };

  const docsDir = resolvePath(root, 'docs');
  await ensureDir(docsDir);
  await writeJson(resolvePath(docsDir, 'plan.json'), plan);
  await writeText(resolvePath(docsDir, 'plan.md'), renderPlanMarkdown(plan, projectName));

  console.log(chalk.green('\n✅ docs/plan.json + docs/plan.md'));
  console.log(chalk.blue('\n✨ Plan created!\n'));
  printPlanSummary(plan);
}

// ─── Rendering ───

function renderPlanMarkdown(plan: PlanSpec, projectName: string): string {
  const lines: string[] = [];

  lines.push(`# Project Plan: ${projectName}`);
  lines.push('');
  lines.push(`## Goal`);
  lines.push(plan.goal);
  lines.push('');

  lines.push('## Features');
  lines.push('');
  lines.push('| # | Feature | Priority | Description |');
  lines.push('|---|---------|----------|-------------|');

  const sorted = [...plan.features].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  sorted.forEach((f, i) => {
    const deps = f.dependencies?.length ? ` (depends: ${f.dependencies.join(', ')})` : '';
    lines.push(`| ${i + 1} | ${f.name} | ${f.priority} | ${f.description}${deps} |`);
  });
  lines.push('');

  if (plan.milestones && plan.milestones.length > 0) {
    lines.push('## Milestones');
    lines.push('');
    for (const m of plan.milestones) {
      const date = m.targetDate ? ` (target: ${m.targetDate})` : '';
      lines.push(`### ${m.name}${date}`);
      for (const f of m.features) {
        lines.push(`- [ ] ${f}`);
      }
      lines.push('');
    }
  }

  lines.push('## Implementation Order');
  lines.push('');
  lines.push('Follow this order based on priority and dependencies:');
  sorted.forEach((f, i) => {
    lines.push(`${i + 1}. **${f.name}** [${f.priority}]`);
  });
  lines.push('');

  return lines.join('\n');
}

function printPlanSummary(plan: PlanSpec): void {
  const high = plan.features.filter((f) => f.priority === 'high').length;
  const medium = plan.features.filter((f) => f.priority === 'medium').length;
  const low = plan.features.filter((f) => f.priority === 'low').length;

  console.log(`Features: ${plan.features.length} total (${high} high, ${medium} medium, ${low} low)`);
  if (plan.milestones?.length) {
    console.log(`Milestones: ${plan.milestones.length}`);
  }
  console.log('');
  console.log(`Next: Run ${chalk.cyan('harness analyze')} to define domain terms and detailed specs.`);
}

async function listMdFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}
