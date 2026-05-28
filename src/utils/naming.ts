import type { NamingConvention } from '../types/index.js';

export function toNamingCase(name: string, convention: NamingConvention): string {
  switch (convention) {
    case 'PascalCase': return toPascalCase(name);
    case 'camelCase': return toCamelCase(name);
    case 'kebab-case': return toKebabCase(name);
    case 'snake_case': return toSnakeCase(name);
  }
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

export function toCamelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toLowerCase());
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

export function namingConventionLabel(convention: NamingConvention): string {
  switch (convention) {
    case 'PascalCase': return 'PascalCase (UserProfile.tsx)';
    case 'camelCase': return 'camelCase (formatDate.ts)';
    case 'kebab-case': return 'kebab-case (user-profile.tsx)';
    case 'snake_case': return 'snake_case (user_profile.tsx)';
  }
}
