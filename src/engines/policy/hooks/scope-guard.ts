// PreToolUse hook for Write|Edit — blocks file writes outside allowed scopes
export function generateScopeGuardScript(allowedScopes: string[]): string {
  const patterns = allowedScopes.map((s) => `"${s}"`).join(' ');

  return `#!/usr/bin/env bash
# harness: scope-guard — blocks file writes outside allowed scopes
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

REL_PATH=$(realpath --relative-to="$CLAUDE_PROJECT_DIR" "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")

ALLOWED_SCOPES=(${patterns})

for scope in "\${ALLOWED_SCOPES[@]}"; do
  if [[ "$REL_PATH" == $scope ]]; then
    exit 0
  fi
done

# Check with node minimatch for glob patterns
MATCH=$(node -e "
const {minimatch} = require('minimatch');
const scopes = ${JSON.stringify(allowedScopes)};
const rel = process.argv[1];
const ok = scopes.some(s => minimatch(rel, s));
console.log(ok ? 'yes' : 'no');
" "$REL_PATH" 2>/dev/null || echo "yes")

if [ "$MATCH" = "no" ]; then
  echo "harness: file '$REL_PATH' is outside allowed scopes (${allowedScopes.join(', ')})" >&2
  exit 2
fi

exit 0
`;
}
