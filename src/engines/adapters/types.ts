import type { HarnessConfig, AgentType } from '../../types/index.js';

export type { AgentType };

export interface AgentAdapter {
  name: string;
  type: AgentType;
  generate(root: string, config: HarnessConfig): Promise<GeneratedOutput>;
}

export interface GeneratedOutput {
  files: Record<string, string>;
  description: string;
}
