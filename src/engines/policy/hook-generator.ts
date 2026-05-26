import type { HarnessConfig } from '../../types/index.js';
import { writeText, ensureDir, resolvePath } from '../../utils/index.js';

export async function generateHuskyHooks(root: string, config: HarnessConfig): Promise<void> {
  const huskyDir = resolvePath(root, '.husky');
  await ensureDir(huskyDir);

  await writeText(resolvePath(huskyDir, 'pre-commit'), buildPreCommitScript(config));
  await writeText(resolvePath(huskyDir, 'pre-push'), buildPrePushScript());
  await writeText(resolvePath(huskyDir, 'post-merge'), buildPostMergeScript());
  await writeText(resolvePath(huskyDir, 'post-checkout'), buildPostCheckoutScript());
}

// ─── pre-commit: lint + typecheck + architecture check ───

function buildPreCommitScript(config: HarnessConfig): string {
  const lines: string[] = [
    '#!/usr/bin/env sh',
    '. "$(dirname -- "$0")/_/husky.sh"',
    '',
  ];

  const { linter, formatter } = config.development;

  if (linter === 'biome') {
    lines.push('npx @biomejs/biome check --staged');
  } else if (linter === 'eslint') {
    lines.push('npx lint-staged');
  }

  if (formatter === 'prettier' && linter !== 'biome') {
    lines.push('npx prettier --check --staged');
  }

  lines.push('npx tsc --noEmit');
  lines.push('');

  // Architecture guard — import violations block commit
  lines.push('npx harness sync --check');
  lines.push('');

  return lines.join('\n');
}

// ─── pre-push: full test suite ───

function buildPrePushScript(): string {
  return [
    '#!/usr/bin/env sh',
    '. "$(dirname -- "$0")/_/husky.sh"',
    '',
    'npx harness test',
    '',
  ].join('\n');
}

// ─── post-merge: auto-sync when config changed after pull/merge ───

function buildPostMergeScript(): string {
  return [
    '#!/usr/bin/env sh',
    '. "$(dirname -- "$0")/_/husky.sh"',
    '',
    '# Auto-sync guardrails if harness.config.json was changed in the merge',
    'changed_files=$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD 2>/dev/null)',
    'if echo "$changed_files" | grep -q "harness.config.json"; then',
    '  echo "harness.config.json changed — running harness sync..."',
    '  npx harness sync',
    'fi',
    '',
  ].join('\n');
}

// ─── post-checkout: auto-sync when switching branches with config diff ───

function buildPostCheckoutScript(): string {
  return [
    '#!/usr/bin/env sh',
    '. "$(dirname -- "$0")/_/husky.sh"',
    '',
    '# Only run on branch checkout (not file checkout)',
    'if [ "$3" = "1" ]; then',
    '  changed_files=$(git diff --name-only "$1" "$2" 2>/dev/null)',
    '  if echo "$changed_files" | grep -q "harness.config.json"; then',
    '    echo "harness.config.json differs on this branch — running harness sync..."',
    '    npx harness sync',
    '  fi',
    'fi',
    '',
  ].join('\n');
}

export function generateLintStagedConfig(config: HarnessConfig): Record<string, string[]> {
  const rules: Record<string, string[]> = {};
  const { linter, formatter } = config.development;
  const lang = config.project.language;
  const ext = lang === 'typescript' ? '*.{ts,tsx}' : '*.{js,jsx}';

  if (linter === 'eslint') {
    rules[ext] = ['eslint --fix'];
  } else if (linter === 'biome') {
    rules[ext] = ['biome check --fix'];
  }

  if (formatter === 'prettier' && linter !== 'biome') {
    rules['*'] = ['prettier --write --ignore-unknown'];
  }

  return rules;
}
