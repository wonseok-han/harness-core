import { readText, writeText, fileExists } from '../../utils/index.js';

export async function safeEditJson(
  filePath: string,
  updater: (data: Record<string, unknown>) => Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await fileExists(filePath))) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    const raw = await readText(filePath);
    const data = JSON.parse(raw) as Record<string, unknown>;
    const updated = updater(data);

    JSON.parse(JSON.stringify(updated));

    await writeText(filePath, JSON.stringify(updated, null, 2) + '\n');
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function safeEditEnv(
  filePath: string,
  key: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    let content = '';
    if (await fileExists(filePath)) {
      content = await readText(filePath);
    }

    const lines = content.split('\n');
    let found = false;

    const updatedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) return line;

      const eqIndex = trimmed.indexOf('=');
      const lineKey = trimmed.substring(0, eqIndex).trim();
      if (lineKey === key) {
        found = true;
        return `${key}=${value}`;
      }
      return line;
    });

    if (!found) {
      updatedLines.push(`${key}=${value}`);
    }

    const result = updatedLines.join('\n');
    if (!result.endsWith('\n')) {
      await writeText(filePath, result + '\n');
    } else {
      await writeText(filePath, result);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function safeEditI18n(
  filePath: string,
  keyPath: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  return safeEditJson(filePath, (data) => {
    const keys = keyPath.split('.');
    let current: Record<string, unknown> = data;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]!;
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1]!;
    current[lastKey] = value;
    return data;
  });
}
