import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export async function writeJson(filePath: string, data: unknown, indent = 2): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, indent) + '\n', 'utf-8');
}

export async function readText(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content, 'utf-8');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export function resolvePath(base: string, ...segments: string[]): string {
  return resolve(base, ...segments);
}
