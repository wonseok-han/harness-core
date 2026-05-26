export type {
  HarnessConfig,
  ProjectConfig,
  ArchitectureConfig,
  DevelopmentConfig,
  TestingConfig,
  CoverageThresholds,
  AgentConfig,
  Framework,
  PackageManager,
  Language,
  ArchitectureStyle,
  AgentType,
  AnalysisSpec,
  DataSchema,
  FieldDef,
  ExceptionCase,
  DomainGlossary,
  DomainTerm,
  PlanSpec,
  PlannedFeature,
  Milestone,
  DesignSpec,
  InterfaceDef,
  PropertyDef,
  MockDef,
  ApiContract,
  LogSource,
  LogSeverity,
  ParsedLogEntry,
  TranspiledReport,
  ReportSummary,
} from './types/index.js';

export { loadConfig, validateConfig, createDefaultConfig } from './config/index.js';

export { discoverProject } from './engines/discovery/index.js';
export {
  checkForbiddenImports,
  generateHuskyHooks,
  generateLintStagedConfig,
  generateClaudeRules,
  generateClaudeMd,
  generateClaudeHooks,
} from './engines/policy/index.js';
export {
  scaffold,
  safeEditJson,
  safeEditEnv,
  safeEditI18n,
  isWithinScope,
  filterByScope,
} from './engines/agent-tools/index.js';
export { transpileLog, parseLogOutput, formatReport } from './engines/log-transpiler/index.js';
export { getAdapter, getAllAdapterTypes, getAdapterChoices } from './engines/adapters/index.js';
export type { AgentAdapter, GeneratedOutput } from './engines/adapters/types.js';
