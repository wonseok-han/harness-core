export interface HarnessConfig {
  project: ProjectConfig;
  architecture: ArchitectureConfig;
  development: DevelopmentConfig;
  testing: TestingConfig;
  agent: AgentConfig;
}

export interface ProjectConfig {
  name: string;
  framework: Framework;
  packageManager: PackageManager;
  language: Language;
}

export interface ArchitectureConfig {
  style: ArchitectureStyle;
  enforceIndexGen: boolean;
  forbiddenImports: Record<string, string[]>;
}

export interface DevelopmentConfig {
  linter: string;
  formatter: string;
  styling: string;
}

export interface TestingConfig {
  runner: string;
  minCoverage: CoverageThresholds;
  requireTestFileWithImplementation: boolean;
}

export interface CoverageThresholds {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export type AgentType = 'claude' | 'cursor' | 'copilot' | 'windsurf' | 'aider' | 'generic';

export interface AgentConfig {
  persona: string;
  allowedScopes: string[];
  adapters: AgentType[];
}

export type Framework =
  | 'nextjs'
  | 'nuxt'
  | 'svelte'
  | 'remix'
  | 'astro'
  | 'vite-react'
  | 'vite-vue'
  | 'express'
  | 'fastify'
  | 'nest'
  | 'unknown';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export type Language = 'typescript' | 'javascript';

export type ArchitectureStyle =
  | 'fsd'
  | 'clean'
  | 'mvc'
  | 'modular'
  | 'flat'
  | 'custom';
