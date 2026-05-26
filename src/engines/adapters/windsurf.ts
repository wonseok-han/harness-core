import type { HarnessConfig } from '../../types/index.js';
import type { AgentAdapter, GeneratedOutput } from './types.js';
import { buildProjectContext, buildConventionRules, buildWorkflowRules, buildToolsSection } from './shared.js';
import { writeText, resolvePath } from '../../utils/index.js';

export const windsurfAdapter: AgentAdapter = {
  name: 'Windsurf',
  type: 'windsurf',

  async generate(root: string, config: HarnessConfig): Promise<GeneratedOutput> {
    const files: Record<string, string> = {};

    // .windsurfrules
    const rules = [
      buildProjectContext(config),
      buildConventionRules(config),
      buildWorkflowRules(config),
      buildToolsSection(config),
    ].join('\n');
    files['.windsurfrules'] = rules;

    for (const [path, content] of Object.entries(files)) {
      await writeText(resolvePath(root, path), content);
    }

    return {
      files,
      description: '.windsurfrules',
    };
  },
};
