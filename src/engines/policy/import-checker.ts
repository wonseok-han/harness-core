import { readText } from '../../utils/index.js';
import { glob } from 'glob';
import { resolve, relative } from 'node:path';

export interface ImportViolation {
  file: string;
  importPath: string;
  rule: string;
}

export async function checkForbiddenImports(
  root: string,
  forbiddenImports: Record<string, string[]>,
): Promise<ImportViolation[]> {
  const violations: ImportViolation[] = [];

  for (const [sourcePattern, forbiddenTargets] of Object.entries(forbiddenImports)) {
    const sourceFiles = await glob(resolve(root, 'src', sourcePattern, '**/*.{ts,tsx,js,jsx}'));

    for (const file of sourceFiles) {
      const content = await readText(file);
      const imports = extractImports(content);
      const relFile = relative(root, file);

      for (const imp of imports) {
        for (const forbidden of forbiddenTargets) {
          const normalizedForbidden = forbidden.replace('/*', '');
          if (imp.includes(normalizedForbidden)) {
            violations.push({
              file: relFile,
              importPath: imp,
              rule: `${sourcePattern} cannot import from ${forbidden}`,
            });
          }
        }
      }
    }
  }

  return violations;
}

function extractImports(source: string): string[] {
  const imports: string[] = [];
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    if (match[1]) imports.push(match[1]);
  }
  return imports;
}
