import type { HarnessConfig } from '../../types/index.js';
import type { AgentAdapter, GeneratedOutput } from './types.js';
import { buildProjectContext, buildConventionRules, buildWorkflowRules, buildCodingPrinciplesSection, buildCustomCodingStandards, buildToolsSection } from './shared.js';
import { writeText, ensureDir, resolvePath } from '../../utils/index.js';

function wrapMdc(description: string, content: string): string {
  return `---\ndescription: ${description}\nalwaysApply: true\n---\n\n${content}`;
}

export const cursorAdapter: AgentAdapter = {
  name: 'Cursor',
  type: 'cursor',

  async generate(root: string, config: HarnessConfig): Promise<GeneratedOutput> {
    const files: Record<string, string> = {};

    // .cursor/rules/harness-*.mdc — alwaysApply: true, auto-loaded by Cursor
    // NOTE: .cursorrules is deprecated — Cursor now uses .cursor/rules/*.mdc
    files['.cursor/rules/harness-conventions.mdc'] = wrapMdc(
      'Project conventions and coding standards enforced by harness-core',
      `${buildProjectContext(config)}${buildConventionRules(config)}${buildCustomCodingStandards(config)}`,
    );

    files['.cursor/rules/harness-workflow.mdc'] = wrapMdc(
      'Development workflow rules and scaffolding guidelines',
      buildWorkflowRules(config),
    );

    files['.cursor/rules/harness-principles.mdc'] = wrapMdc(
      'Coding principles and best practices',
      buildCodingPrinciplesSection(),
    );

    files['.cursor/rules/harness-tech-stack.mdc'] = wrapMdc(
      'Tech stack and tooling configuration',
      buildToolsSection(config),
    );

    for (const [path, content] of Object.entries(files)) {
      const fullPath = resolvePath(root, path);
      await ensureDir(resolvePath(fullPath, '..'));
      await writeText(fullPath, content);
    }

    return {
      files,
      description: '.cursor/rules/harness-*.mdc',
    };
  },
};
