import { describe, it, expect } from 'vitest';
import { toNamingCase, toPascalCase, toCamelCase, toKebabCase, toSnakeCase } from '../../src/utils/naming.js';

describe('toPascalCase', () => {
  it('converts kebab-case', () => expect(toPascalCase('user-profile')).toBe('UserProfile'));
  it('converts snake_case', () => expect(toPascalCase('user_profile')).toBe('UserProfile'));
  it('converts camelCase', () => expect(toPascalCase('userProfile')).toBe('UserProfile'));
  it('preserves PascalCase', () => expect(toPascalCase('UserProfile')).toBe('UserProfile'));
});

describe('toCamelCase', () => {
  it('converts kebab-case', () => expect(toCamelCase('user-profile')).toBe('userProfile'));
  it('converts snake_case', () => expect(toCamelCase('user_profile')).toBe('userProfile'));
  it('converts PascalCase', () => expect(toCamelCase('UserProfile')).toBe('userProfile'));
  it('preserves camelCase', () => expect(toCamelCase('userProfile')).toBe('userProfile'));
});

describe('toKebabCase', () => {
  it('converts PascalCase', () => expect(toKebabCase('UserProfile')).toBe('user-profile'));
  it('converts camelCase', () => expect(toKebabCase('userProfile')).toBe('user-profile'));
  it('converts snake_case', () => expect(toKebabCase('user_profile')).toBe('user-profile'));
  it('preserves kebab-case', () => expect(toKebabCase('user-profile')).toBe('user-profile'));
});

describe('toSnakeCase', () => {
  it('converts PascalCase', () => expect(toSnakeCase('UserProfile')).toBe('user_profile'));
  it('converts camelCase', () => expect(toSnakeCase('userProfile')).toBe('user_profile'));
  it('converts kebab-case', () => expect(toSnakeCase('user-profile')).toBe('user_profile'));
  it('preserves snake_case', () => expect(toSnakeCase('user_profile')).toBe('user_profile'));
});

describe('toNamingCase', () => {
  it('dispatches to PascalCase', () => expect(toNamingCase('foo-bar', 'PascalCase')).toBe('FooBar'));
  it('dispatches to camelCase', () => expect(toNamingCase('foo-bar', 'camelCase')).toBe('fooBar'));
  it('dispatches to kebab-case', () => expect(toNamingCase('FooBar', 'kebab-case')).toBe('foo-bar'));
  it('dispatches to snake_case', () => expect(toNamingCase('FooBar', 'snake_case')).toBe('foo_bar'));
});
