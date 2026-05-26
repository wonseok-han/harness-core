export type LogSource = 'build' | 'lint' | 'test' | 'typecheck' | 'unknown';

export type LogSeverity = 'error' | 'warning' | 'info';

export interface ParsedLogEntry {
  source: LogSource;
  severity: LogSeverity;
  file?: string;
  line?: number;
  column?: number;
  rule?: string;
  message: string;
  hint?: string;
  rawText: string;
}

export interface TranspiledReport {
  summary: ReportSummary;
  entries: ParsedLogEntry[];
  markdown: string;
  json: string;
}

export interface ReportSummary {
  source: LogSource;
  totalErrors: number;
  totalWarnings: number;
  affectedFiles: string[];
  timestamp: string;
}
