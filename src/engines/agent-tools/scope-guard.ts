import { relative } from 'node:path';
import { minimatch } from 'minimatch';

export function isWithinScope(
  filePath: string,
  root: string,
  allowedScopes: string[],
): boolean {
  const relPath = relative(root, filePath);

  for (const scope of allowedScopes) {
    if (minimatch(relPath, scope)) {
      return true;
    }
  }

  return false;
}

export function filterByScope(
  filePaths: string[],
  root: string,
  allowedScopes: string[],
): { allowed: string[]; denied: string[] } {
  const allowed: string[] = [];
  const denied: string[] = [];

  for (const fp of filePaths) {
    if (isWithinScope(fp, root, allowedScopes)) {
      allowed.push(fp);
    } else {
      denied.push(fp);
    }
  }

  return { allowed, denied };
}
