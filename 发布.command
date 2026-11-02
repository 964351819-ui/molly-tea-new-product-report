#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
task_node='/Users/leo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
if command -v node >/dev/null 2>&1; then task_node="$(command -v node)"; fi
"$task_node" scripts/publish.mjs "$@"
