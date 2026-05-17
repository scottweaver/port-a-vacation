#!/usr/bin/env bash
#
# Write a fake public/version.json to trigger the update banner in your
# open tab. Unlike simulate-update.sh, this does NOT auto-restore — so
# clicking the banner reloads into the fake values (banner clears, header
# updates to the fake version). The natural "click → see new version"
# test.
#
# To reset after testing:
#   node scripts/write-version.mjs
#
# Usage:
#   ./scripts/trigger-update-banner.sh                  # defaults
#   ./scripts/trigger-update-banner.sh 3.1              # custom app_version
#   ./scripts/trigger-update-banner.sh 3.1 abc1234567   # custom both

set -euo pipefail

cd "$(dirname "$0")/.."

APP_VERSION="${1:-3.1}"
BUILD_ID="${2:-fake-$(date +%s)}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

printf '{"build_id":"%s","app_version":"%s","built_at":"%s"}\n' "$BUILD_ID" "$APP_VERSION" "$NOW" > public/version.json

cat <<EOF
Wrote fake public/version.json:
  build_id    = $BUILD_ID
  app_version = $APP_VERSION

Banner should appear in your open tab within ~4 seconds.
Click the banner to reload — header will then show v$APP_VERSION ($(echo "$BUILD_ID" | cut -c1-7)).
Reset when done:  node scripts/write-version.mjs
EOF
