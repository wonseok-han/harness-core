import type { LogSource, TranspiledReport } from '../../types/index.js';
import { parseLogOutput } from './parsers.js';
import { formatReport } from './formatter.js';

export function transpileLog(rawOutput: string, source: LogSource): TranspiledReport {
  const entries = parseLogOutput(rawOutput, source);
  return formatReport(entries, source);
}

export { parseLogOutput } from './parsers.js';
export { formatReport } from './formatter.js';
