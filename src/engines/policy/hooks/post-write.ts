import type { TestScopeConfig } from '../../../types/index.js';

export function generatePostWriteScript(requireTest: boolean, testScope?: TestScopeConfig): string {
  const includePatterns = testScope?.include ?? [];
  const excludePatterns = testScope?.exclude ?? [];

  const scopeCheck = includePatterns.length > 0
    ? buildGlobCheck(includePatterns, excludePatterns)
    : defaultScopeCheck();

  return `#!/usr/bin/env bash
# harness: post-write — architecture check + test companion check after file write
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

REL_PATH=$(realpath --relative-to="$CLAUDE_PROJECT_DIR" "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")

CONTEXT=""

# 1. Import violation check (silent, non-blocking — context feedback only)
SYNC_RESULT=$(npx harness sync --check --root "$CLAUDE_PROJECT_DIR" 2>&1) || true
if echo "$SYNC_RESULT" | grep -q "violation"; then
  CONTEXT="$CONTEXT\\n⚠️ Import violation detected after writing $REL_PATH:\\n$SYNC_RESULT"
fi

${requireTest ? `
# 2. Test companion check
${scopeCheck}
` : ''}

if [ -n "$CONTEXT" ]; then
  echo -e "$CONTEXT"
fi

exit 0
`;
}

function defaultScopeCheck(): string {
  return `if [[ "$REL_PATH" == src/* ]] && [[ "$REL_PATH" == *.ts || "$REL_PATH" == *.tsx ]] && \\
   [[ "$REL_PATH" != *.test.* ]] && [[ "$REL_PATH" != *.spec.* ]] && \\
   [[ "$REL_PATH" != */index.ts ]] && [[ "$REL_PATH" != */types/* ]] && \\
   [[ "$REL_PATH" != *.d.ts ]]; then

  BASE_NAME=$(basename "$REL_PATH" | sed 's/\\.[^.]*$//')
  TEST_EXISTS=$(find "$CLAUDE_PROJECT_DIR" -name "$BASE_NAME.test.*" -o -name "$BASE_NAME.spec.*" 2>/dev/null | head -1)

  if [ -z "$TEST_EXISTS" ]; then
    CONTEXT="$CONTEXT\\n⚠️ No test file found for $REL_PATH — create a .test file before committing."
  fi
fi`;
}

function buildGlobCheck(include: string[], exclude: string[]): string {
  const includeConditions = include.map((p) => `[[ "$REL_PATH" == ${p} ]]`).join(' || ');
  const excludeConditions = exclude.length > 0
    ? exclude.map((p) => `[[ "$REL_PATH" != ${p} ]]`).join(' && ') + ' && '
    : '';

  return `NEEDS_TEST=false
if (${includeConditions}) && \\
   ${excludeConditions}\\
   [[ "$REL_PATH" != *.test.* ]] && [[ "$REL_PATH" != *.spec.* ]] && \\
   [[ "$REL_PATH" != */index.ts ]] && [[ "$REL_PATH" != *.d.ts ]]; then
  NEEDS_TEST=true
fi

if [ "$NEEDS_TEST" = true ]; then
  BASE_NAME=$(basename "$REL_PATH" | sed 's/\\.[^.]*$//')
  TEST_EXISTS=$(find "$CLAUDE_PROJECT_DIR" -name "$BASE_NAME.test.*" -o -name "$BASE_NAME.spec.*" 2>/dev/null | head -1)

  if [ -z "$TEST_EXISTS" ]; then
    CONTEXT="$CONTEXT\\n⚠️ No test file found for $REL_PATH — create a .test file before committing."
  fi
fi`;
}
