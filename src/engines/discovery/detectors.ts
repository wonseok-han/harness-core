import { fileExists, readJson, readText } from '../../utils/index.js';
import { resolvePath } from '../../utils/index.js';
import type { Framework, PackageManager, Language } from '../../types/index.js';

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function detectPackageManager(root: string): Promise<PackageManager> {
  if (await fileExists(resolvePath(root, 'bun.lockb'))) return 'bun';
  if (await fileExists(resolvePath(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fileExists(resolvePath(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

export async function detectFramework(root: string): Promise<Framework> {
  const pkgPath = resolvePath(root, 'package.json');
  if (!(await fileExists(pkgPath))) return 'unknown';

  const pkg = await readJson<PackageJson>(pkgPath);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  if ('next' in allDeps) return 'nextjs';
  if ('nuxt' in allDeps) return 'nuxt';
  if ('@sveltejs/kit' in allDeps || 'svelte' in allDeps) return 'svelte';
  if ('@remix-run/node' in allDeps || '@remix-run/react' in allDeps) return 'remix';
  if ('astro' in allDeps) return 'astro';
  if ('@nestjs/core' in allDeps) return 'nest';
  if ('fastify' in allDeps) return 'fastify';
  if ('express' in allDeps) return 'express';
  if ('vite' in allDeps && 'vue' in allDeps) return 'vite-vue';
  if ('vite' in allDeps && 'react' in allDeps) return 'vite-react';

  return 'unknown';
}

export async function detectLanguage(root: string): Promise<Language> {
  if (await fileExists(resolvePath(root, 'tsconfig.json'))) return 'typescript';
  if (await fileExists(resolvePath(root, 'jsconfig.json'))) return 'javascript';
  return 'javascript';
}

export async function detectTestRunner(root: string): Promise<string> {
  const pkgPath = resolvePath(root, 'package.json');
  if (!(await fileExists(pkgPath))) return 'vitest';

  const pkg = await readJson<PackageJson>(pkgPath);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  if ('vitest' in allDeps) return 'vitest';
  if ('jest' in allDeps) return 'jest';
  if ('mocha' in allDeps) return 'mocha';
  if ('playwright' in allDeps || '@playwright/test' in allDeps) return 'playwright';
  return 'vitest';
}

export async function detectLinter(root: string): Promise<string> {
  const pkgPath = resolvePath(root, 'package.json');
  if (!(await fileExists(pkgPath))) return 'eslint';

  const pkg = await readJson<PackageJson>(pkgPath);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  if ('@biomejs/biome' in allDeps || 'biome' in allDeps) return 'biome';
  return 'eslint';
}

export async function detectFormatter(root: string): Promise<string> {
  const pkgPath = resolvePath(root, 'package.json');
  if (!(await fileExists(pkgPath))) return 'prettier';

  const pkg = await readJson<PackageJson>(pkgPath);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  if ('@biomejs/biome' in allDeps) return 'biome';
  if ('prettier' in allDeps) return 'prettier';
  return 'prettier';
}

export async function detectStyling(root: string): Promise<string> {
  const pkgPath = resolvePath(root, 'package.json');
  if (!(await fileExists(pkgPath))) return '';

  const pkg = await readJson<PackageJson>(pkgPath);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  if ('tailwindcss' in allDeps) {
    const version = allDeps['tailwindcss'] ?? '';
    return version.startsWith('^4') || version.startsWith('4') ? 'tailwind-v4' : 'tailwind-v3';
  }
  if ('styled-components' in allDeps) return 'styled-components';
  if ('@emotion/react' in allDeps) return 'emotion';
  if ('sass' in allDeps) return 'sass';
  return '';
}

export async function detectProjectName(root: string): Promise<string> {
  const pkgPath = resolvePath(root, 'package.json');
  if (await fileExists(pkgPath)) {
    const pkg = await readJson<PackageJson>(pkgPath);
    if (pkg.name) return pkg.name;
  }
  return root.split('/').pop() ?? 'my-project';
}

export async function detectMonorepo(root: string): Promise<boolean> {
  if (await fileExists(resolvePath(root, 'pnpm-workspace.yaml'))) return true;
  if (await fileExists(resolvePath(root, 'lerna.json'))) return true;

  const pkgPath = resolvePath(root, 'package.json');
  if (await fileExists(pkgPath)) {
    try {
      const content = await readText(pkgPath);
      return content.includes('"workspaces"');
    } catch {
      return false;
    }
  }
  return false;
}
