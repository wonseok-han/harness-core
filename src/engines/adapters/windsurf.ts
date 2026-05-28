import type { HarnessConfig } from '../../types/index.js';
import type { AgentAdapter, GeneratedOutput } from './types.js';
import { buildProjectContext, buildConventionRules, buildWorkflowRules, buildCodingPrinciplesSection, buildCustomCodingStandards, buildToolsSection } from './shared.js';
import { writeText, resolvePath, fileExists } from '../../utils/index.js';

export const windsurfAdapter: AgentAdapter = {
  name: 'Windsurf',
  type: 'windsurf',

  async generate(root: string, config: HarnessConfig): Promise<GeneratedOutput> {
    const files: Record<string, string> = {};
    const skipped: string[] = [];

    const hasExisting = await fileExists(resolvePath(root, '.windsurfrules'));

    if (hasExisting) {
      skipped.push('.windsurfrules');
    } else {
      const rules = [
        buildProjectContext(config),
        buildConventionRules(config),
        buildCustomCodingStandards(config),
        buildWorkflowRules(config),
        buildCodingPrinciplesSection(),
        buildToolsSection(config),
      ].join('\n');
      files['.windsurfrules'] = rules;

      await writeText(resolvePath(root, '.windsurfrules'), files['.windsurfrules']);
    }

    const desc = skipped.length > 0
      ? `skipped (existing .windsurfrules preserved)`
      : '.windsurfrules';

    return {
      files,
      skipped: skipped.length > 0 ? skipped : undefined,
      description: desc,
    };
  },
};
