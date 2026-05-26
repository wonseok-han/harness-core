import Ajv from 'ajv';
import { readJson, fileExists, resolvePath } from '../utils/index.js';
import type { HarnessConfig } from '../types/index.js';
import configSchema from '../../schema/harness.config.schema.json' with { type: 'json' };

const CONFIG_FILENAME = 'harness.config.json';

const ajv = new Ajv({ allErrors: true, useDefaults: true });
const validate = ajv.compile(configSchema);

export async function loadConfig(projectRoot: string): Promise<HarnessConfig> {
  const configPath = resolvePath(projectRoot, CONFIG_FILENAME);

  if (!(await fileExists(configPath))) {
    throw new Error(
      `Configuration file not found: ${configPath}\nRun "harness init" to create one.`,
    );
  }

  const raw = await readJson<unknown>(configPath);

  if (!validate(raw)) {
    const errors = validate.errors
      ?.map((e) => `  - ${e.instancePath || '/'}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid harness.config.json:\n${errors}`);
  }

  return raw as unknown as HarnessConfig;
}

export function validateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const valid = validate(config);
  const errors = valid
    ? []
    : (validate.errors?.map((e) => `${e.instancePath || '/'}: ${e.message}`) ?? []);
  return { valid: !!valid, errors };
}
