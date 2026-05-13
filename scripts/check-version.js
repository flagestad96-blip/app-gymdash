#!/usr/bin/env node
/**
 * scripts/check-version.js
 *
 * Pre-build sanity check: app.json, package.json, CHANGELOG.md and patchNotes.ts
 * must all agree on the current version.
 *
 * Hooked into `npm run verify`. Fails fast with a clear message when versions drift.
 *
 * Exit codes:
 *   0  all good
 *   1  version mismatch / missing entry
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function fail(msg) {
  console.error(`${RED}✗ ${msg}${RESET}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`${YELLOW}! ${msg}${RESET}`);
}

function ok(msg) {
  console.log(`${GREEN}✓ ${msg}${RESET}`);
}

function readJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) fail(`Missing file: ${rel}`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readText(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) fail(`Missing file: ${rel}`);
  return fs.readFileSync(p, "utf8");
}

// 1. app.json is source of truth
const app = readJson("app.json");
const appVersion = app?.expo?.version;
const versionCode = app?.expo?.android?.versionCode;
if (!appVersion) fail("app.json: expo.version is missing");
if (!Number.isInteger(versionCode)) fail("app.json: expo.android.versionCode is missing or not an integer");

// 2. package.json must match
const pkg = readJson("package.json");
if (pkg.version !== appVersion) {
  fail(
    `Version drift: package.json (${pkg.version}) ≠ app.json (${appVersion}).\n` +
      `  Run: node scripts/bump-version.js sync   (or align manually)`,
  );
}

// 3. patchNotes.ts newest entry must match app.json
const patchNotesSrc = readText("src/patchNotes.ts");
const firstVersionMatch = patchNotesSrc.match(/patchNotes:\s*PatchNote\[\][\s\S]*?version:\s*"([^"]+)"/);
if (!firstVersionMatch) fail("src/patchNotes.ts: could not parse newest entry");
const newestPatchNote = firstVersionMatch[1];
if (newestPatchNote !== appVersion) {
  fail(
    `patchNotes.ts newest entry (${newestPatchNote}) ≠ app.json (${appVersion}).\n` +
      `  Add an entry for ${appVersion} at the top of src/patchNotes.ts.`,
  );
}

// 4. CHANGELOG.md must mention this version somewhere
const changelog = readText("CHANGELOG.md");
const escaped = appVersion.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
const inChangelog = new RegExp(`^##\\s+v${escaped}\\b`, "m").test(changelog);
if (!inChangelog) {
  warn(`CHANGELOG.md has no \`## v${appVersion}\` header yet (add before next build).`);
} else {
  ok(`CHANGELOG.md has v${appVersion}`);
}

ok(`app.json ${appVersion} (versionCode ${versionCode})`);
ok(`package.json ${pkg.version}`);
ok(`patchNotes newest ${newestPatchNote}`);
console.log(`${DIM}All version sources agree.${RESET}`);
