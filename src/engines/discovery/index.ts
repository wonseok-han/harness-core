import type { HarnessConfig } from '../../types/index.js';
import { createDefaultConfig } from '../../config/defaults.js';
import {
  detectPackageManager,
  detectFramework,
  detectLanguage,
  detectTestRunner,
  detectLinter,
  detectFormatter,
  detectStyling,
  detectProjectName,
  detectArchitecture,
  detectAdapters,
  detectMonorepo,
} from './detectors.js';
import type { ArchitectureStyle, AgentType } from '../../types/index.js';

export interface DiscoveryResult {
  config: HarnessConfig;
  detected: Record<string, string>;
}

export async function discoverProject(root: string): Promise<DiscoveryResult> {
  const [
    packageManager,
    framework,
    language,
    testRunner,
    linter,
    formatter,
    styling,
    projectName,
    architecture,
    adapters,
    isMonorepo,
  ] = await Promise.all([
    detectPackageManager(root),
    detectFramework(root),
    detectLanguage(root),
    detectTestRunner(root),
    detectLinter(root),
    detectFormatter(root),
    detectStyling(root),
    detectProjectName(root),
    detectArchitecture(root),
    detectAdapters(root),
    detectMonorepo(root),
  ]);

  const detected: Record<string, string> = {
    packageManager,
    framework,
    language,
    testRunner,
    linter,
    formatter,
    styling,
    projectName,
    architecture,
    adapters: adapters.join(', '),
    monorepo: String(isMonorepo),
  };

  const config = createDefaultConfig({
    project: {
      name: projectName,
      framework,
      packageManager,
      language,
    },
    architecture: {
      style: architecture as ArchitectureStyle,
      enforceIndexGen: true,
      forbiddenImports: {},
    },
    development: {
      linter,
      formatter,
      styling,
    },
    testing: {
      runner: testRunner,
      minCoverage: { statements: 80, branches: 75, functions: 80, lines: 80 },
      requireTestFileWithImplementation: true,
    },
    agent: {
      persona: 'senior-developer',
      allowedScopes: ['src/**/*', 'tests/**/*'],
      adapters: adapters as AgentType[],
    },
  });

  return { config, detected };
}

export {
  detectPackageManager,
  detectFramework,
  detectLanguage,
  detectTestRunner,
  detectLinter,
  detectFormatter,
  detectStyling,
  detectProjectName,
  detectArchitecture,
  detectAdapters,
  detectMonorepo,
} from './detectors.js';
