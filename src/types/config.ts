export interface HarnessConfig {
  project: ProjectConfig;
  architecture: ArchitectureConfig;
  development: DevelopmentConfig;
  testing: TestingConfig;
  agent: AgentConfig;
  rules?: RulesConfig;
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

// ─── Rules: injectable conventions ───

export interface RulesConfig {
  fileNaming?: FileNamingConfig;
  codingStandards?: CodingStandard[];
  testScope?: TestScopeConfig;
  scaffolderTypes?: Record<string, ScaffolderTypeConfig>;
}

export interface FileNamingConfig {
  components?: NamingConvention;
  hooks?: NamingConvention;
  utils?: NamingConvention;
  services?: NamingConvention;
  models?: NamingConvention;
  testSuffix?: string;
}

export type NamingConvention = 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case';

export interface CodingStandard {
  id: string;
  description: string;
  severity?: 'error' | 'warn' | 'info';
}

export interface TestScopeConfig {
  include?: string[];
  exclude?: string[];
}

export interface ScaffolderTypeConfig {
  directory: string;
  naming?: NamingConvention;
}
