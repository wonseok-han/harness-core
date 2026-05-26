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
} from './detectors.js';

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
  ] = await Promise.all([
    detectPackageManager(root),
    detectFramework(root),
    detectLanguage(root),
    detectTestRunner(root),
    detectLinter(root),
    detectFormatter(root),
    detectStyling(root),
    detectProjectName(root),
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
  };

  const config = createDefaultConfig({
    project: {
      name: projectName,
      framework,
      packageManager,
      language,
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
  detectMonorepo,
} from './detectors.js';
