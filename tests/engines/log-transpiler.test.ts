import { describe, it, expect } from 'vitest';
import { transpileLog } from '../../src/engines/log-transpiler/index.js';
import { parseLogOutput } from '../../src/engines/log-transpiler/parsers.js';

describe('parseLogOutput', () => {
  it('should parse ESLint error lines', () => {
    const raw = `src/app.ts:10:5: error Unexpected console statement no-console`;
    const entries = parseLogOutput(raw, 'lint');

    expect(entries).toHaveLength(1);
    expect(entries[0]!.source).toBe('lint');
    expect(entries[0]!.severity).toBe('error');
    expect(entries[0]!.file).toBe('src/app.ts');
    expect(entries[0]!.line).toBe(10);
    expect(entries[0]!.rule).toBe('no-console');
  });

  it('should parse TypeScript error lines', () => {
    const raw = `src/file.ts(10,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`;
    const entries = parseLogOutput(raw, 'typecheck');

    expect(entries).toHaveLength(1);
    expect(entries[0]!.source).toBe('typecheck');
    expect(entries[0]!.file).toBe('src/file.ts');
    expect(entries[0]!.line).toBe(10);
    expect(entries[0]!.column).toBe(5);
    expect(entries[0]!.rule).toBe('TS2345');
    expect(entries[0]!.hint).toContain('Argument type mismatch');
  });

  it('should parse test failure lines', () => {
    const raw = `FAIL src/app.test.ts > should work`;
    const entries = parseLogOutput(raw, 'test');

    expect(entries).toHaveLength(1);
    expect(entries[0]!.source).toBe('test');
    expect(entries[0]!.severity).toBe('error');
  });

  it('should handle empty input', () => {
    const entries = parseLogOutput('', 'lint');
    expect(entries).toHaveLength(0);
  });

  it('should handle build errors with generic pattern', () => {
    const raw = `Error: Module not found: src/missing.ts`;
    const entries = parseLogOutput(raw, 'build');

    expect(entries).toHaveLength(1);
    expect(entries[0]!.source).toBe('build');
    expect(entries[0]!.severity).toBe('error');
  });
});

describe('transpileLog', () => {
  it('should generate a complete report with markdown', () => {
    const raw = [
      'src/app.ts:10:5: error Unexpected console statement no-console',
      'src/app.ts:15:1: warning Missing return type @typescript-eslint/explicit-function-return-type',
    ].join('\n');

    const report = transpileLog(raw, 'lint');

    expect(report.summary.source).toBe('lint');
    expect(report.summary.totalErrors).toBe(1);
    expect(report.summary.totalWarnings).toBe(1);
    expect(report.summary.affectedFiles).toContain('src/app.ts');
    expect(report.markdown).toContain('LINT Error Report');
    expect(report.markdown).toContain('Self-Healing Context');
    expect(report.json).toBeTruthy();
  });

  it('should generate valid JSON report', () => {
    const raw = `src/file.ts(5,3): error TS2304: Cannot find name 'foo'.`;
    const report = transpileLog(raw, 'typecheck');

    const parsed = JSON.parse(report.json);
    expect(parsed.summary).toBeDefined();
    expect(parsed.entries).toBeInstanceOf(Array);
  });

  it('should handle report with no errors', () => {
    const report = transpileLog('All tests passed', 'test');

    expect(report.summary.totalErrors).toBe(0);
    expect(report.summary.totalWarnings).toBe(0);
  });
});
