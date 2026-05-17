#!/usr/bin/env bash
#
# Simulate a deploy from the perspective of an already-open browser tab:
#
#   1) Write a fake version.json with a different build_id so the open tab
#      detects a mismatch on its next poll (~4s in dev) and shows the
#      red Update banner.
#
#   2) After a delay, restore version.json to the real current SHA. This
#      simulates the dev server "catching up" — analogous to the user's
#      browser fetching the new bundle in prod. From now on, the banner's
#      reload path resolves to a match → no banner.
#
# Test recipe:
#   - Have the app open at http://localhost:5173/.
#   - Run this script. Watch the banner drop in.
#   - Click the banner AFTER the script reports "restored." The reload
#     should land without the banner.
#
# Usage:
#   ./scripts/simulate-update.sh [SLEEP_SECONDS]   (default 15)

set -euo pipefail

cd "$(dirname "$0")/.."

SLEEP_SECONDS="${1:-15}"
FAKE_BUILD_ID="fake-$(date +%s)"
FAKE_VERSION="3.1-test"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "→ Writing fake version.json (build_id=$FAKE_BUILD_ID, app_version=$FAKE_VERSION)..."
printf '{"build_id":"%s","app_version":"%s","built_at":"%s"}\n' "$FAKE_BUILD_ID" "$FAKE_VERSION" "$NOW" > public/version.json

echo "→ Sleeping ${SLEEP_SECONDS}s. The Update banner should appear in your tab within ~4s."
sleep "$SLEEP_SECONDS"

echo "→ Restoring real version.json so click-to-reload resolves cleanly..."
node scripts/write-version.mjs

echo
echo "Done. Now click the banner in your tab — reload should land without it."
echo "If you want to start over, just re-run this script."
