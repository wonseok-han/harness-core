import type { HarnessConfig } from '../../types/index.js';
import type { AgentAdapter, GeneratedOutput } from './types.js';
import { buildProjectContext, buildConventionRules, buildWorkflowRules, buildToolsSection } from './shared.js';
import { writeText, ensureDir, resolvePath } from '../../utils/index.js';

export const copilotAdapter: AgentAdapter = {
  name: 'GitHub Copilot',
  type: 'copilot',

  async generate(root: string, config: HarnessConfig): Promise<GeneratedOutput> {
    const files: Record<string, string> = {};

    // .github/copilot-instructions.md (Copilot Custom Instructions)
    const instructions = [
      buildProjectContext(config),
      buildConventionRules(config),
      buildWorkflowRules(config),
      buildToolsSection(config),
    ].join('\n');
    files['.github/copilot-instructions.md'] = instructions;

    for (const [path, content] of Object.entries(files)) {
      const fullPath = resolvePath(root, path);
      await ensureDir(resolvePath(fullPath, '..'));
      await writeText(fullPath, content);
    }

    return {
      files,
      description: '.github/copilot-instructions.md',
    };
  },
};
