import type { HarnessConfig } from '../../types/index.js';
import type { AgentAdapter, GeneratedOutput } from './types.js';
import { buildProjectContext, buildConventionRules, buildWorkflowRules, buildCodingPrinciplesSection, buildCustomCodingStandards, buildToolsSection } from './shared.js';
import { writeText, ensureDir, resolvePath, fileExists } from '../../utils/index.js';

export const copilotAdapter: AgentAdapter = {
  name: 'GitHub Copilot',
  type: 'copilot',

  async generate(root: string, config: HarnessConfig): Promise<GeneratedOutput> {
    const files: Record<string, string> = {};
    const skipped: string[] = [];

    const target = '.github/copilot-instructions.md';
    const hasExisting = await fileExists(resolvePath(root, target));

    if (hasExisting) {
      skipped.push(target);
    } else {
      const instructions = [
        buildProjectContext(config),
        buildConventionRules(config),
        buildCustomCodingStandards(config),
        buildWorkflowRules(config),
        buildCodingPrinciplesSection(),
        buildToolsSection(config),
      ].join('\n');
      files[target] = instructions;

      const fullPath = resolvePath(root, target);
      await ensureDir(resolvePath(fullPath, '..'));
      await writeText(fullPath, files[target]);
    }

    const desc = skipped.length > 0
      ? `skipped (existing ${target} preserved)`
      : target;

    return {
      files,
      skipped: skipped.length > 0 ? skipped : undefined,
      description: desc,
    };
  },
};
