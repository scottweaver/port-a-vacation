#!/usr/bin/env node
// Emits public/version.json with the current build id (short git SHA) and
// app version. Runs before `vite build` so the JSON file ships with the
// bundle; the client reads it at runtime via useVersionCheck to decide
// whether a newer version is live.

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const target = resolve(repoRoot, 'public', 'version.json');

function readSha() {
  // Vercel exposes VERCEL_GIT_COMMIT_SHA on every build.
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function tryDescribeTag() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (tag) return tag.replace(/^version\//, '');
  } catch { /* no tags reachable */ }
  return null;
}

function tryFetchTagsAndDescribe() {
  // Vercel's shallow clone omits tags. Fetch them so git describe can work.
  // If the fetch fails (no network, no remote), this branch is a no-op.
  try {
    execSync('git fetch --tags origin --depth=1', { cwd: repoRoot, stdio: 'ignore' });
  } catch { return null; }
  return tryDescribeTag();
}

function tryPackageJson() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8'));
    if (!pkg.version) return null;
    // Normalize "3.1.0" → "3.1" so the package.json fallback matches the
    // git-tag style (version/3.1, public/release-notes/3.1.md). Only strip
    // when the trailing component is exactly ".0" — "3.1.1" stays as-is.
    const v = String(pkg.version);
    const match = v.match(/^(\d+\.\d+)\.0$/);
    return match ? match[1] : v;
  } catch { /* unreadable or malformed */ }
  return null;
}

function readAppVersion() {
  return tryDescribeTag()
    ?? tryFetchTagsAndDescribe()
    ?? tryPackageJson()
    ?? 'dev';
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
