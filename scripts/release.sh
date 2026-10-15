#!/bin/bash
set -euo pipefail

# Publication runs on GitHub's runner using npm trusted publishing.
args=(workflow run release.yml --repo margelo/react-native-nitro-modules --ref main)
if [[ $# -gt 1 ]]; then
  echo "Usage: bun release [core-tag]" >&2
  exit 1
fi
if [[ $# -eq 1 ]]; then
  args+=(-f "core-tag=$1")
fi
gh "${args[@]}"
