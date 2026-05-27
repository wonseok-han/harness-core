import type { HarnessConfig } from '../../types/index.js';
import type { AgentAdapter, GeneratedOutput } from './types.js';
import { buildProjectContext, buildConventionRules, buildWorkflowRules, buildCodingPrinciplesSection, buildToolsSection } from './shared.js';
import { writeText, ensureDir, resolvePath } from '../../utils/index.js';

export const cursorAdapter: AgentAdapter = {
  name: 'Cursor',
  type: 'cursor',

  async generate(root: string, config: HarnessConfig): Promise<GeneratedOutput> {
    const files: Record<string, string> = {};

    // .cursorrules (main instruction file for Cursor)
    const cursorrules = [
      buildProjectContext(config),
      buildConventionRules(config),
      buildWorkflowRules(config),
      buildCodingPrinciplesSection(),
      buildToolsSection(config),
    ].join('\n');
    files['.cursorrules'] = cursorrules;

    // .cursor/rules/*.md (Cursor also reads from this directory)
    files['.cursor/rules/conventions.mdc'] = wrapCursorRule(
      'conventions',
      'Always',
      buildConventionRules(config),
    );

    files['.cursor/rules/workflow.mdc'] = wrapCursorRule(
      'workflow',
      'Always',
      buildWorkflowRules(config),
    );

    // Write files
    for (const [path, content] of Object.entries(files)) {
      const fullPath = resolvePath(root, path);
      await ensureDir(resolvePath(fullPath, '..'));
      await writeText(fullPath, content);
    }

    return {
      files,
      description: '.cursorrules + .cursor/rules/*.mdc',
    };
  },
};

function wrapCursorRule(name: string, alwaysApply: string, content: string): string {
  return `---
description: ${name}
alwaysApply: ${alwaysApply === 'Always'}
---

${content}`;
}
