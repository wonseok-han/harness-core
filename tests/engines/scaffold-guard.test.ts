import { describe, it, expect } from 'vitest';
import { generateScaffoldGuardScript } from '../../src/engines/policy/hooks/scaffold-guard.js';
import type { ArchitectureStyle } from '../../src/types/index.js';

describe('generateScaffoldGuardScript', () => {
  it('should generate valid bash script', () => {
    const script = generateScaffoldGuardScript('modular');

    expect(script).toContain('#!/usr/bin/env bash');
    expect(script).toContain('set -euo pipefail');
    expect(script).toContain('jq');
  });

  it('should include modular directories for modular style', () => {
    const script = generateScaffoldGuardScript('modular');

    expect(script).toContain('src/components');
    expect(script).toContain('src/hooks');
    expect(script).toContain('src/utils');
    expect(script).toContain('src/services');
    expect(script).toContain('src/models');
  });

  it('should include FSD directories for fsd style', () => {
    const script = generateScaffoldGuardScript('fsd');

    expect(script).toContain('src/shared/ui');
    expect(script).toContain('src/shared/lib');
    expect(script).toContain('src/entities');
    expect(script).toContain('src/features');
    expect(script).not.toContain('src/components');
  });

  it('should include clean architecture directories', () => {
    const script = generateScaffoldGuardScript('clean');

    expect(script).toContain('src/presentation');
    expect(script).toContain('src/domain');
    expect(script).toContain('src/application');
    expect(script).toContain('src/infrastructure');
  });

  it('should include MVC directories', () => {
    const script = generateScaffoldGuardScript('mvc');

    expect(script).toContain('src/views');
    expect(script).toContain('src/models');
    expect(script).toContain('src/controllers');
  });

  it('should map correct scaffolder types per directory', () => {
    const script = generateScaffoldGuardScript('modular');

    expect(script).toContain('"type":"component"');
    expect(script).toContain('"type":"hook"');
    expect(script).toContain('"type":"util"');
    expect(script).toContain('"type":"service"');
    expect(script).toContain('"type":"model"');
  });

  it('should suggest harness generate command', () => {
    const script = generateScaffoldGuardScript('modular');

    expect(script).toContain('harness generate');
    expect(script).toContain('exit 2');
  });

  it('should allow edits to existing files (exit 0 for existing)', () => {
    const script = generateScaffoldGuardScript('modular');

    expect(script).toContain('if [ -f "$FILE_PATH" ]; then');
    expect(script).toContain('exit 0');
  });

  it('should only check Write tool, not Edit', () => {
    const script = generateScaffoldGuardScript('modular');

    expect(script).toContain('"$TOOL_NAME" != "Write"');
  });

  it('should use flat/custom defaults to modular dirs', () => {
    const flatScript = generateScaffoldGuardScript('flat');
    const customScript = generateScaffoldGuardScript('custom');

    expect(flatScript).toContain('src/components');
    expect(customScript).toContain('src/components');
  });

  it('should generate different scripts for each architecture style', () => {
    const styles: ArchitectureStyle[] = ['modular', 'fsd', 'clean', 'mvc', 'flat', 'custom'];
    const scripts = styles.map((s) => generateScaffoldGuardScript(s));

    const fsdScript = scripts[1]!;
    const cleanScript = scripts[2]!;
    expect(fsdScript).not.toBe(cleanScript);
  });
});
