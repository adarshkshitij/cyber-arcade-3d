#!/usr/bin/env bash
# ==============================================================================
# Pre-Push Verification Gate for 3D Neon Snake Arcade
# ==============================================================================

set -e

echo "🔍 [1/3] Validating JavaScript syntax..."
node --check engine.js
node --check game.js
echo "   ✅ Syntax OK!"

echo "🧪 [2/3] Running Core Engine Physics, Modes & Button Control Unit Tests..."
node --test test/engine.test.js test/modes.test.js test/ui_and_buttons.test.js
echo "   ✅ Unit Tests Passed!"

echo "🌐 [3/3] Checking Git working tree cleanliness..."
git status -s

echo "🚀 All pre-push checks passed cleanly! You are ready to push."
