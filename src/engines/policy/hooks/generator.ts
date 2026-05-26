import type { HarnessConfig } from '../../../types/index.js';
import { writeText, readJson, writeJson, ensureDir, resolvePath, fileExists } from '../../../utils/index.js';
import { generateScopeGuardScript } from './scope-guard.js';
import { generateScaffoldGuardScript } from './scaffold-guard.js';
import { generatePostWriteScript } from './post-write.js';
import { generateSessionInitScript } from './session-init.js';
import { generateConfigSyncScript } from './config-sync.js';

interface ClaudeSettings {
  hooks?: Record<string, unknown[]>;
  permissions?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function generateClaudeHooks(root: string, config: HarnessConfig): Promise<void> {
  const hooksDir = resolvePath(root, '.claude', 'hooks');
  await ensureDir(hooksDir);

  // Generate hook scripts
  await writeScript(
    resolvePath(hooksDir, 'scope-guard.sh'),
    generateScopeGuardScript(config.agent.allowedScopes),
  );

  await writeScript(
    resolvePath(hooksDir, 'scaffold-guard.sh'),
    generateScaffoldGuardScript(config.architecture.style),
  );

  await writeScript(
    resolvePath(hooksDir, 'post-write.sh'),
    generatePostWriteScript(config.testing.requireTestFileWithImplementation),
  );

  await writeScript(
    resolvePath(hooksDir, 'session-init.sh'),
    generateSessionInitScript(),
  );

  await writeScript(
    resolvePath(hooksDir, 'config-sync.sh'),
    generateConfigSyncScript(),
  );

  // Generate .claude/settings.json with hook registrations
  await generateClaudeSettings(root, config);
}

async function generateClaudeSettings(root: string, _config: HarnessConfig): Promise<void> {
  const settingsPath = resolvePath(root, '.claude', 'settings.json');

  let existing: ClaudeSettings = {};
  if (await fileExists(settingsPath)) {
    try {
      existing = await readJson<ClaudeSettings>(settingsPath);
    } catch {
      existing = {};
    }
  }

  const harnessHooks = buildHookConfig();

  existing.hooks = {
    ...existing.hooks,
    ...harnessHooks,
  };

  await writeJson(settingsPath, existing);
}

function buildHookConfig(): Record<string, unknown[]> {
  return {
    PreToolUse: [
      {
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/scope-guard.sh',
            statusMessage: 'Checking file scope...',
          },
        ],
      },
      {
        matcher: 'Write',
        hooks: [
          {
            type: 'command',
            command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/scaffold-guard.sh',
            statusMessage: 'Checking scaffolder usage...',
          },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/post-write.sh',
            statusMessage: 'Checking architecture rules...',
          },
        ],
      },
    ],
    SessionStart: [
      {
        hooks: [
          {
            type: 'command',
            command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/session-init.sh',
            once: true,
          },
        ],
      },
    ],
    FileChanged: [
      {
        matcher: 'harness.config.json',
        hooks: [
          {
            type: 'command',
            command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/config-sync.sh',
            statusMessage: 'Syncing harness config...',
          },
        ],
      },
    ],
  };
}

async function writeScript(path: string, content: string): Promise<void> {
  await writeText(path, content);
  // Make executable
  const { chmod } = await import('node:fs/promises');
  await chmod(path, 0o755);
}
