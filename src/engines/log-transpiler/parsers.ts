import type { ParsedLogEntry, LogSource, LogSeverity } from '../../types/index.js';

export function parseLogOutput(raw: string, source: LogSource): ParsedLogEntry[] {
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const entries: ParsedLogEntry[] = [];

  for (const line of lines) {
    const entry = parseLine(line, source);
    if (entry) entries.push(entry);
  }

  return entries;
}

function parseLine(line: string, source: LogSource): ParsedLogEntry | null {
  switch (source) {
    case 'lint':
      return parseLintLine(line);
    case 'typecheck':
      return parseTypecheckLine(line);
    case 'test':
      return parseTestLine(line);
    case 'build':
      return parseBuildLine(line);
    default:
      return parseGenericLine(line);
  }
}

function parseLintLine(line: string): ParsedLogEntry | null {
  // ESLint format: /path/to/file.ts:10:5: error message (rule-name)
  const eslintMatch = line.match(/^(.+?):(\d+):(\d+):\s+(error|warning)\s+(.+?)\s+(\S+)$/);
  if (eslintMatch) {
    return {
      source: 'lint',
      severity: eslintMatch[4] as LogSeverity,
      file: eslintMatch[1],
      line: Number(eslintMatch[2]),
      column: Number(eslintMatch[3]),
      rule: eslintMatch[6],
      message: eslintMatch[5]!,
      hint: getLintHint(eslintMatch[6]!),
      rawText: line,
    };
  }

  // Biome format: path/file.ts:10:5 lint/rule ━━━
  const biomeMatch = line.match(/^(.+?):(\d+):(\d+)\s+([\w/]+)/);
  if (biomeMatch) {
    return {
      source: 'lint',
      severity: 'error',
      file: biomeMatch[1],
      line: Number(biomeMatch[2]),
      column: Number(biomeMatch[3]),
      rule: biomeMatch[4],
      message: line,
      rawText: line,
    };
  }

  return null;
}

function parseTypecheckLine(line: string): ParsedLogEntry | null {
  // TypeScript: src/file.ts(10,5): error TS2345: ...
  const tsMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
  if (tsMatch) {
    return {
      source: 'typecheck',
      severity: tsMatch[4] as LogSeverity,
      file: tsMatch[1],
      line: Number(tsMatch[2]),
      column: Number(tsMatch[3]),
      rule: tsMatch[5],
      message: tsMatch[6]!,
      hint: getTypeErrorHint(tsMatch[5]!),
      rawText: line,
    };
  }

  return null;
}

function parseTestLine(line: string): ParsedLogEntry | null {
  // Vitest/Jest: FAIL src/file.test.ts > suite > test name
  if (line.includes('FAIL') || line.includes('✗') || line.includes('×')) {
    return {
      source: 'test',
      severity: 'error',
      message: line.trim(),
      rawText: line,
    };
  }

  // Error: expected X to be Y
  const assertMatch = line.match(/^(\s*)(?:Error|AssertionError):\s+(.+)$/);
  if (assertMatch) {
    return {
      source: 'test',
      severity: 'error',
      message: assertMatch[2]!,
      hint: 'Check the expected vs actual values in the assertion',
      rawText: line,
    };
  }

  // Stack trace file reference
  const stackMatch = line.match(/at\s+.+?\((.+?):(\d+):(\d+)\)/);
  if (stackMatch && line.includes('Error')) {
    return {
      source: 'test',
      severity: 'error',
      file: stackMatch[1],
      line: Number(stackMatch[2]),
      column: Number(stackMatch[3]),
      message: line.trim(),
      rawText: line,
    };
  }

  return null;
}

function parseBuildLine(line: string): ParsedLogEntry | null {
  // Generic error patterns
  if (line.toLowerCase().includes('error')) {
    const fileMatch = line.match(/(.+?\.[a-z]+):?(\d+)?:?(\d+)?/);
    return {
      source: 'build',
      severity: 'error',
      file: fileMatch?.[1],
      line: fileMatch?.[2] ? Number(fileMatch[2]) : undefined,
      column: fileMatch?.[3] ? Number(fileMatch[3]) : undefined,
      message: line.trim(),
      rawText: line,
    };
  }

  if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('warn')) {
    return {
      source: 'build',
      severity: 'warning',
      message: line.trim(),
      rawText: line,
    };
  }

  return null;
}

function parseGenericLine(line: string): ParsedLogEntry | null {
  if (line.toLowerCase().includes('error')) {
    return {
      source: 'unknown',
      severity: 'error',
      message: line.trim(),
      rawText: line,
    };
  }
  return null;
}

function getLintHint(rule: string): string {
  const hints: Record<string, string> = {
    'no-unused-vars': 'Remove or use the variable. Prefix with _ if intentionally unused.',
    '@typescript-eslint/no-unused-vars': 'Remove or use the variable. Prefix with _ if intentionally unused.',
    'no-console': 'Replace console.log with a proper logger or remove it.',
    'import/no-cycle': 'Break the circular dependency by extracting shared types to a separate module.',
    'react-hooks/exhaustive-deps': 'Add missing dependencies to the dependency array or use useCallback/useMemo.',
    'react-hooks/rules-of-hooks': 'Hooks must be called at the top level of a function component or custom hook.',
  };
  return hints[rule] ?? `Fix the ${rule} violation`;
}

function getTypeErrorHint(code: string): string {
  const hints: Record<string, string> = {
    'TS2345': 'Argument type mismatch. Check the function signature and passed arguments.',
    'TS2322': 'Type assignment error. Ensure the value matches the expected type.',
    'TS2339': 'Property does not exist. Check for typos or add the property to the type definition.',
    'TS2304': 'Cannot find name. Import the missing type/value or declare it.',
    'TS7006': 'Parameter has implicit any type. Add an explicit type annotation.',
    'TS2769': 'No overload matches. Check the function signature for correct parameter types.',
  };
  return hints[code] ?? `Fix TypeScript error ${code}`;
}
