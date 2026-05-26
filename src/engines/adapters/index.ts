import type { AgentType } from '../../types/index.js';
import type { AgentAdapter, GeneratedOutput } from './types.js';
import { claudeAdapter } from './claude.js';
import { cursorAdapter } from './cursor.js';
import { copilotAdapter } from './copilot.js';
import { windsurfAdapter } from './windsurf.js';
import { aiderAdapter } from './aider.js';
import { genericAdapter } from './generic.js';

export type { AgentAdapter, GeneratedOutput, AgentType };

const adapterRegistry: Record<AgentType, AgentAdapter> = {
  claude: claudeAdapter,
  cursor: cursorAdapter,
  copilot: copilotAdapter,
  windsurf: windsurfAdapter,
  aider: aiderAdapter,
  generic: genericAdapter,
};

export function getAdapter(type: AgentType): AgentAdapter {
  return adapterRegistry[type];
}

export function getAllAdapterTypes(): AgentType[] {
  return Object.keys(adapterRegistry) as AgentType[];
}

export function getAdapterChoices(): Array<{ name: string; value: AgentType }> {
  return Object.values(adapterRegistry).map((a) => ({
    name: a.name,
    value: a.type,
  }));
}
