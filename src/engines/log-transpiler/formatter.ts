import type { ParsedLogEntry, TranspiledReport, ReportSummary, LogSource } from '../../types/index.js';

export function formatReport(entries: ParsedLogEntry[], source: LogSource): TranspiledReport {
  const errors = entries.filter((e) => e.severity === 'error');
  const warnings = entries.filter((e) => e.severity === 'warning');
  const affectedFiles = [...new Set(entries.map((e) => e.file).filter(Boolean))] as string[];

  const summary: ReportSummary = {
    source,
    totalErrors: errors.length,
    totalWarnings: warnings.length,
    affectedFiles,
    timestamp: new Date().toISOString(),
  };

  const markdown = renderMarkdown(summary, entries);
  const json = JSON.stringify({ summary, entries }, null, 2);

  return { summary, entries, markdown, json };
}

function renderMarkdown(summary: ReportSummary, entries: ParsedLogEntry[]): string {
  const lines: string[] = [];

  lines.push(`# ${summary.source.toUpperCase()} Error Report`);
  lines.push('');
  lines.push(`**Generated:** ${summary.timestamp}`);
  lines.push(`**Errors:** ${summary.totalErrors} | **Warnings:** ${summary.totalWarnings}`);
  lines.push('');

  if (summary.affectedFiles.length > 0) {
    lines.push('## Affected Files');
    for (const file of summary.affectedFiles) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

  const errors = entries.filter((e) => e.severity === 'error');
  if (errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    for (const entry of errors) {
      lines.push(renderEntry(entry));
    }
  }

  const warnings = entries.filter((e) => e.severity === 'warning');
  if (warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const entry of warnings) {
      lines.push(renderEntry(entry));
    }
  }

  lines.push('');
  lines.push('## Self-Healing Context');
  lines.push('');
  lines.push('Use the above error information to:');
  lines.push('1. Identify the root cause from the error messages and file locations');
  lines.push('2. Apply the suggested hints for each error');
  lines.push('3. Fix the code and re-run verification');
  lines.push('');

  return lines.join('\n');
}

function renderEntry(entry: ParsedLogEntry): string {
  const lines: string[] = [];
  const location = entry.file
    ? `\`${entry.file}${entry.line ? `:${entry.line}` : ''}${entry.column ? `:${entry.column}` : ''}\``
    : '_unknown location_';

  lines.push(`### ${entry.severity === 'error' ? '❌' : '⚠️'} ${entry.rule ?? entry.source}`);
  lines.push(`- **Location:** ${location}`);
  lines.push(`- **Message:** ${entry.message}`);
  if (entry.hint) {
    lines.push(`- **Hint:** ${entry.hint}`);
  }
  lines.push('');

  return lines.join('\n');
}
