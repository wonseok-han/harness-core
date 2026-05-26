import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { readdir } from 'node:fs/promises';
import { loadConfig } from '../../config/index.js';
import { writeJson, writeText, readJson, readText, fileExists, resolvePath, ensureDir } from '../../utils/index.js';
import type { DomainGlossary, DomainTerm, AnalysisSpec } from '../../types/index.js';

// ─── Input schema for --from mode ───

interface AnalysisInput {
  domain: string;
  terms: Record<string, DomainTerm>;
  features?: AnalysisSpec[];
}

export const analyzeCommand = new Command('analyze')
  .description('Domain analysis — glossary and feature specs (interactive or agent-driven)')
  .option('--root <path>', 'Project root directory', process.cwd())
  .option('--scan', 'Scan project and output context as JSON (non-interactive, for AI agents)')
  .option('--from <file>', 'Import analysis from JSON file (non-interactive, for AI agents)')
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

// ─── --scan: Static project analysis → JSON stdout ───

async function runScan(root: string, projectName: string): Promise<void> {
  const scan: Record<string, unknown> = {
    project: projectName,
    instructions: 'Analyze this project context and generate an analysis JSON file. Then run: harness analyze --from <file>',
  };

  // package.json
  const pkgPath = resolvePath(root, 'package.json');
  if (await fileExists(pkgPath)) {
    const pkg = await readJson<Record<string, unknown>>(pkgPath);
    scan.package = {
      name: pkg.name,
      description: pkg.description ?? '',
      dependencies: Object.keys((pkg.dependencies as Record<string, string>) ?? {}),
      devDependencies: Object.keys((pkg.devDependencies as Record<string, string>) ?? {}),
    };
  }

  // README.md (first 100 lines)
  const readmePath = resolvePath(root, 'README.md');
  if (await fileExists(readmePath)) {
    const readme = await readText(readmePath);
    scan.readme = readme.split('\n').slice(0, 100).join('\n');
  }

  // Source file tree
  scan.sourceFiles = await collectFileTree(resolvePath(root, 'src'), root);

  // Existing glossary
  const glossaryPath = resolvePath(root, 'domain-glossary.json');
  if (await fileExists(glossaryPath)) {
    scan.existingGlossary = await readJson(glossaryPath);
  }

  // Existing feature specs
  const featuresDir = resolvePath(root, 'docs', 'features');
  if (await fileExists(featuresDir)) {
    const files = await listFiles(featuresDir);
    scan.existingFeatures = files;
  }

  // harness.config.json
  const configPath = resolvePath(root, 'harness.config.json');
  if (await fileExists(configPath)) {
    scan.harnessConfig = await readJson(configPath);
  }

  // Expected output format
  scan.expectedFormat = {
    domain: 'string — project domain name',
    terms: {
      'term-key': {
        definition: 'string — what this term means',
        aliases: ['optional', 'alternative names'],
        context: 'optional — where this term is used',
      },
    },
    features: [
      {
        feature: 'string — feature name',
        intent: 'string — why this feature is needed',
        input: {
          description: 'string',
          fields: { fieldName: { type: 'string', required: true, description: 'string' } },
        },
        output: {
          description: 'string',
          fields: { fieldName: { type: 'string', required: true, description: 'string' } },
        },
        exceptions: [{ condition: 'string', behavior: 'string', errorCode: 'optional string' }],
      },
    ],
  };

  console.log(JSON.stringify(scan, null, 2));
}

async function collectFileTree(dir: string, root: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolvePath(dir, entry.name);
      const relativePath = fullPath.replace(root + '/', '');
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        files.push(relativePath + '/');
        const sub = await collectFileTree(fullPath, root);
        files.push(...sub);
      } else {
        files.push(relativePath);
      }
    }
  } catch {
    // directory doesn't exist
  }
  return files;
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries;
  } catch {
    return [];
  }
}

// ─── --from: Import analysis from JSON file ───

async function runFromFile(root: string, filePath: string, projectName: string): Promise<void> {
  const resolvedPath = resolvePath(root, filePath);

  if (!(await fileExists(resolvedPath))) {
    console.error(chalk.red(`File not found: ${resolvedPath}`));
    process.exitCode = 1;
    return;
  }

  const raw = await readText(resolvedPath);
  let input: AnalysisInput;
  try {
    input = JSON.parse(raw) as AnalysisInput;
  } catch {
    console.error(chalk.red('Invalid JSON file'));
    process.exitCode = 1;
    return;
  }

  if (!input.domain || !input.terms) {
    console.error(chalk.red('JSON must contain "domain" and "terms" fields'));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.blue(`\n📋 Importing analysis for ${projectName}\n`));

  // Write glossary
  const glossary: DomainGlossary = { domain: input.domain, terms: input.terms };
  const glossaryPath = resolvePath(root, 'domain-glossary.json');
  await writeJson(glossaryPath, glossary);
  console.log(chalk.green(`✅ domain-glossary.json (${Object.keys(glossary.terms).length} terms)`));

  // Write feature specs
  if (input.features && input.features.length > 0) {
    const featuresDir = resolvePath(root, 'docs', 'features');
    await ensureDir(featuresDir);

    for (const spec of input.features) {
      const fileName = spec.feature.toLowerCase().replace(/\s+/g, '-');
      const markdown = renderFeatureSpecFromAnalysis(spec, glossary);
      const specPath = resolvePath(featuresDir, `${fileName}.md`);
      await writeText(specPath, markdown);
      console.log(chalk.green(`✅ docs/features/${fileName}.md`));
    }
  }

  // Write analysis schema template
  const templateDir = resolvePath(root, 'docs');
  const analysisSchemaPath = resolvePath(templateDir, 'analysis-spec.schema.json');
  if (!(await fileExists(analysisSchemaPath))) {
    await writeJson(analysisSchemaPath, ANALYSIS_SCHEMA);
    console.log(chalk.green('✅ docs/analysis-spec.schema.json'));
  }

  console.log(chalk.blue('\n✨ Analysis imported successfully!\n'));
  printSummary(glossary);
}

function renderFeatureSpecFromAnalysis(spec: AnalysisSpec, glossary: DomainGlossary): string {
  const lines: string[] = [];

  lines.push(`# Feature Specification: ${spec.feature}`);
  lines.push('');
  lines.push('## 기획 의도 (Intent)');
  lines.push(spec.intent);
  lines.push('');

  lines.push('## 인풋 데이터 (Input)');
  if (spec.input.description) lines.push(spec.input.description);
  const inputFields = Object.entries(spec.input.fields);
  if (inputFields.length > 0) {
    lines.push('| Field | Type | Required | Description |');
    lines.push('|-------|------|----------|-------------|');
    for (const [name, f] of inputFields) {
      lines.push(`| ${name} | ${f.type} | ${f.required ? 'Y' : 'N'} | ${f.description} |`);
    }
  } else {
    lines.push('_No input defined_');
  }
  lines.push('');

  lines.push('## 아웃풋 데이터 (Output)');
  if (spec.output.description) lines.push(spec.output.description);
  const outputFields = Object.entries(spec.output.fields);
  if (outputFields.length > 0) {
    lines.push('| Field | Type | Description |');
    lines.push('|-------|------|-------------|');
    for (const [name, f] of outputFields) {
      lines.push(`| ${name} | ${f.type} | ${f.description} |`);
    }
  } else {
    lines.push('_No output defined_');
  }
  lines.push('');

  lines.push('## 예외 케이스 (Exceptions)');
  if (spec.exceptions.length > 0) {
    lines.push('| Condition | Behavior | Error Code |');
    lines.push('|-----------|----------|------------|');
    for (const e of spec.exceptions) {
      lines.push(`| ${e.condition} | ${e.behavior} | ${e.errorCode || '-'} |`);
    }
  } else {
    lines.push('_No exceptions defined_');
  }
  lines.push('');

  const relatedTerms = findRelatedTerms(spec.feature + ' ' + spec.intent, glossary);
  lines.push('## 도메인 용어 참조');
  if (relatedTerms.length > 0) {
    for (const term of relatedTerms) {
      lines.push(`- **${term}** — see domain-glossary.json`);
    }
  } else {
    lines.push('_No related terms found_');
  }
  lines.push('');

  return lines.join('\n');
}

// ─── Interactive mode (original) ───

async function runInteractive(root: string, projectName: string): Promise<void> {
  console.log(chalk.blue(`\n📋 Domain Analysis for ${projectName}\n`));

  const glossaryPath = resolvePath(root, 'domain-glossary.json');
  let glossary: DomainGlossary;

  if (await fileExists(glossaryPath)) {
    glossary = await readJson<DomainGlossary>(glossaryPath);
    console.log(chalk.dim(`Loaded existing glossary (${Object.keys(glossary.terms).length} terms)\n`));

    const { action } = await inquirer.prompt<{ action: string }>([{
      type: 'list',
      name: 'action',
      message: 'domain-glossary.json already exists:',
      choices: [
        { name: 'Add more terms', value: 'add' },
        { name: 'Regenerate from scratch', value: 'regen' },
        { name: 'Skip glossary, go to features', value: 'skip' },
      ],
    }]);

    if (action === 'regen') {
      glossary = await buildGlossaryInteractive(projectName);
      await writeJson(glossaryPath, glossary);
      console.log(chalk.green(`\n✅ Regenerated domain-glossary.json (${Object.keys(glossary.terms).length} terms)`));
    } else if (action === 'add') {
      const newTerms = await collectTerms();
      glossary.terms = { ...glossary.terms, ...newTerms };
      await writeJson(glossaryPath, glossary);
      console.log(chalk.green(`\n✅ Updated domain-glossary.json (${Object.keys(glossary.terms).length} terms)`));
    }
  } else {
    glossary = await buildGlossaryInteractive(projectName);
    await writeJson(glossaryPath, glossary);
    console.log(chalk.green(`\n✅ Created domain-glossary.json (${Object.keys(glossary.terms).length} terms)`));
  }

  console.log('');
  const { wantFeatures } = await inquirer.prompt<{ wantFeatures: boolean }>([{
    type: 'confirm',
    name: 'wantFeatures',
    message: 'Define feature specifications now?',
    default: true,
  }]);

  if (wantFeatures) {
    await featureSpecLoop(root, glossary);
  }

  const templateDir = resolvePath(root, 'docs');
  const analysisSchemaPath = resolvePath(templateDir, 'analysis-spec.schema.json');
  if (!(await fileExists(analysisSchemaPath))) {
    await writeJson(analysisSchemaPath, ANALYSIS_SCHEMA);
    console.log(chalk.green('✅ Created docs/analysis-spec.schema.json'));
  }

  console.log(chalk.blue('\n✨ Domain analysis complete!\n'));
  printSummary(glossary);
}

// ─── Interactive helpers ───

async function buildGlossaryInteractive(projectName: string): Promise<DomainGlossary> {
  const { domain } = await inquirer.prompt<{ domain: string; description: string }>([
    {
      type: 'input',
      name: 'domain',
      message: 'What is this project about? (domain name)',
      default: projectName,
    },
    {
      type: 'input',
      name: 'description',
      message: 'Describe the project in one sentence:',
    },
  ]);

  console.log(chalk.blue('\n📝 Now let\'s define the key domain terms.'));
  console.log(chalk.dim('   These help AI understand your project\'s vocabulary.\n'));

  const terms = await collectTerms();

  return { domain, terms };
}

async function collectTerms(): Promise<Record<string, DomainTerm>> {
  const terms: Record<string, DomainTerm> = {};
  let adding = true;

  while (adding) {
    const { termName } = await inquirer.prompt<{ termName: string }>([{
      type: 'input',
      name: 'termName',
      message: `Term name ${chalk.dim('(empty to finish)')}:`,
    }]);

    if (!termName.trim()) {
      adding = false;
      continue;
    }

    const key = termName.trim().toLowerCase().replace(/\s+/g, '-');

    const { definition, aliases, context } = await inquirer.prompt<{
      definition: string;
      aliases: string;
      context: string;
    }>([
      {
        type: 'input',
        name: 'definition',
        message: `  "${termName}" means:`,
      },
      {
        type: 'input',
        name: 'aliases',
        message: `  Aliases ${chalk.dim('(comma-separated, optional)')}:`,
      },
      {
        type: 'input',
        name: 'context',
        message: `  Where is it used? ${chalk.dim('(optional)')}:`,
      },
    ]);

    const term: DomainTerm = { definition };
    const aliasList = aliases.split(',').map((a) => a.trim()).filter(Boolean);
    if (aliasList.length > 0) term.aliases = aliasList;
    if (context.trim()) term.context = context.trim();

    terms[key] = term;
    console.log(chalk.green(`  ✓ Added "${key}"\n`));
  }

  return terms;
}

async function featureSpecLoop(root: string, glossary: DomainGlossary): Promise<void> {
  const docsDir = resolvePath(root, 'docs', 'features');
  let adding = true;

  while (adding) {
    console.log('');
    const { featureName } = await inquirer.prompt<{ featureName: string }>([{
      type: 'input',
      name: 'featureName',
      message: `Feature name ${chalk.dim('(empty to finish)')}:`,
    }]);

    if (!featureName.trim()) {
      adding = false;
      continue;
    }

    const spec = await buildFeatureSpec(featureName.trim(), glossary);
    const fileName = featureName.trim().toLowerCase().replace(/\s+/g, '-');
    const specPath = resolvePath(docsDir, `${fileName}.md`);

    await writeText(specPath, spec);
    console.log(chalk.green(`  ✅ Created docs/features/${fileName}.md`));

    const { more } = await inquirer.prompt<{ more: boolean }>([{
      type: 'confirm',
      name: 'more',
      message: 'Define another feature?',
      default: true,
    }]);

    if (!more) adding = false;
  }
}

async function buildFeatureSpec(name: string, glossary: DomainGlossary): Promise<string> {
  const { intent } = await inquirer.prompt<{ intent: string }>([{
    type: 'input',
    name: 'intent',
    message: `  Why is "${name}" needed? (purpose):`,
  }]);

  console.log(chalk.dim(`\n  Define input data for "${name}":`));
  const inputFields = await collectFields('input');

  console.log(chalk.dim(`\n  Define output data for "${name}":`));
  const outputFields = await collectFields('output');

  console.log(chalk.dim(`\n  Define exception cases for "${name}":`));
  const exceptions = await collectExceptions();

  const relatedTerms = findRelatedTerms(name + ' ' + intent, glossary);

  return renderFeatureSpecInteractive(name, intent, inputFields, outputFields, exceptions, relatedTerms);
}

interface FieldEntry {
  field: string;
  type: string;
  required: boolean;
  description: string;
}

async function collectFields(label: string): Promise<FieldEntry[]> {
  const fields: FieldEntry[] = [];
  let adding = true;

  while (adding) {
    const { field } = await inquirer.prompt<{ field: string }>([{
      type: 'input',
      name: 'field',
      message: `    ${label} field name ${chalk.dim('(empty to finish)')}:`,
    }]);

    if (!field.trim()) {
      adding = false;
      continue;
    }

    const { type, required, description } = await inquirer.prompt<{
      type: string;
      required: boolean;
      description: string;
    }>([
      { type: 'input', name: 'type', message: `      Type:`, default: 'string' },
      { type: 'confirm', name: 'required', message: `      Required?`, default: true },
      { type: 'input', name: 'description', message: `      Description:` },
    ]);

    fields.push({ field: field.trim(), type, required, description });
  }

  return fields;
}

interface ExceptionEntry {
  condition: string;
  behavior: string;
  errorCode: string;
}

async function collectExceptions(): Promise<ExceptionEntry[]> {
  const exceptions: ExceptionEntry[] = [];
  let adding = true;

  while (adding) {
    const { condition } = await inquirer.prompt<{ condition: string }>([{
      type: 'input',
      name: 'condition',
      message: `    Exception condition ${chalk.dim('(empty to finish)')}:`,
    }]);

    if (!condition.trim()) {
      adding = false;
      continue;
    }

    const { behavior, errorCode } = await inquirer.prompt<{
      behavior: string;
      errorCode: string;
    }>([
      { type: 'input', name: 'behavior', message: `      Expected behavior:` },
      { type: 'input', name: 'errorCode', message: `      Error code ${chalk.dim('(optional)')}:` },
    ]);

    exceptions.push({ condition: condition.trim(), behavior, errorCode });
  }

  return exceptions;
}

function renderFeatureSpecInteractive(
  name: string,
  intent: string,
  inputs: FieldEntry[],
  outputs: FieldEntry[],
  exceptions: ExceptionEntry[],
  relatedTerms: string[],
): string {
  const lines: string[] = [];

  lines.push(`# Feature Specification: ${name}`);
  lines.push('');
  lines.push('## 기획 의도 (Intent)');
  lines.push(intent);
  lines.push('');

  lines.push('## 인풋 데이터 (Input)');
  if (inputs.length > 0) {
    lines.push('| Field | Type | Required | Description |');
    lines.push('|-------|------|----------|-------------|');
    for (const f of inputs) {
      lines.push(`| ${f.field} | ${f.type} | ${f.required ? 'Y' : 'N'} | ${f.description} |`);
    }
  } else {
    lines.push('_No input defined_');
  }
  lines.push('');

  lines.push('## 아웃풋 데이터 (Output)');
  if (outputs.length > 0) {
    lines.push('| Field | Type | Description |');
    lines.push('|-------|------|-------------|');
    for (const f of outputs) {
      lines.push(`| ${f.field} | ${f.type} | ${f.description} |`);
    }
  } else {
    lines.push('_No output defined_');
  }
  lines.push('');

  lines.push('## 예외 케이스 (Exceptions)');
  if (exceptions.length > 0) {
    lines.push('| Condition | Behavior | Error Code |');
    lines.push('|-----------|----------|------------|');
    for (const e of exceptions) {
      lines.push(`| ${e.condition} | ${e.behavior} | ${e.errorCode || '-'} |`);
    }
  } else {
    lines.push('_No exceptions defined_');
  }
  lines.push('');

  lines.push('## 도메인 용어 참조');
  if (relatedTerms.length > 0) {
    for (const term of relatedTerms) {
      lines.push(`- **${term}** — see domain-glossary.json`);
    }
  } else {
    lines.push('_No related terms found_');
  }
  lines.push('');

  return lines.join('\n');
}

// ─── Shared helpers ───

function findRelatedTerms(text: string, glossary: DomainGlossary): string[] {
  const lower = text.toLowerCase();
  const related: string[] = [];

  for (const [key, term] of Object.entries(glossary.terms)) {
    if (lower.includes(key)) {
      related.push(key);
      continue;
    }
    if (term.aliases?.some((a) => lower.includes(a.toLowerCase()))) {
      related.push(key);
    }
  }

  return related;
}

function printSummary(glossary: DomainGlossary): void {
  console.log(chalk.cyan('Domain:') + ` ${glossary.domain}`);
  console.log(chalk.cyan('Terms:') + ` ${Object.keys(glossary.terms).length} defined`);

  if (Object.keys(glossary.terms).length > 0) {
    console.log(chalk.dim('  ' + Object.keys(glossary.terms).join(', ')));
  }

  console.log('');
  console.log('AI agents will now:');
  console.log(`  1. Reference ${chalk.cyan('domain-glossary.json')} for accurate terminology`);
  console.log(`  2. Follow ${chalk.cyan('docs/features/*.md')} specs when implementing`);
  console.log(`  3. Validate against ${chalk.cyan('docs/analysis-spec.schema.json')}`);
}

const ANALYSIS_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Analysis Specification',
  type: 'object',
  required: ['feature', 'intent', 'input', 'output', 'exceptions'],
  properties: {
    feature: { type: 'string', minLength: 1 },
    intent: { type: 'string', minLength: 10 },
    input: {
      type: 'object',
      required: ['description', 'fields'],
      properties: {
        description: { type: 'string' },
        fields: { type: 'object' },
      },
    },
    output: {
      type: 'object',
      required: ['description', 'fields'],
      properties: {
        description: { type: 'string' },
        fields: { type: 'object' },
      },
    },
    exceptions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['condition', 'behavior'],
        properties: {
          condition: { type: 'string' },
          behavior: { type: 'string' },
          errorCode: { type: 'string' },
        },
      },
    },
  },
};
