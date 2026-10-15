#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

# The release version comes from the pinned core commit.
git diff --exit-code HEAD
git -C core diff --exit-code HEAD
node scripts/update-core-version.mjs --check
bun install --frozen-lockfile
bun run build

version=$(node -p "require('./packages/react-native-nitro-modules/package.json').version")
echo "Publishing react-native-nitro-modules $version"
# Publish only the RN package. Nitrogen is released from margelo/nitro.
(cd packages/react-native-nitro-modules && npm publish "$@")
