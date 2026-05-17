#!/usr/bin/env node
// Emits public/version.json with the current build id (short git SHA) and
// timestamp. Runs before `vite build` so the JSON file is bundled into the
// Vercel build output. The same SHA is injected into the bundle as
// __BUILD_ID__ via vite.config.ts's `define`; the client compares the two
// to detect when a new version is live.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '..', 'public', 'version.json');

function readSha() {
  // Vercel exposes VERCEL_GIT_COMMIT_SHA on every build.
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync('git rev-parse HEAD', { cwd: resolve(__dirname, '..') })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function readAppVersion() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', { cwd: resolve(__dirname, '..') })
      .toString()
      .trim();
    return tag.replace(/^version\//, '');
  } catch {
    return 'dev';
  }
}

const sha = readSha();
const buildId = sha.slice(0, 12);
const appVersion = readAppVersion();

if (!existsSync(dirname(target))) mkdirSync(dirname(target), { recursive: true });

writeFileSync(target, JSON.stringify({
  build_id: buildId,
  app_version: appVersion,
  built_at: new Date().toISOString(),
}, null, 2) + '\n');

console.log(`wrote version.json build_id=${buildId} app_version=${appVersion}`);
