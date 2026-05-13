#!/usr/bin/env node
/**
 * scripts/bump-version.js
 *
 * Bump app version everywhere it lives:
 *   - app.json:    expo.version, expo.android.versionCode (+1)
 *   - package.json: version
 *   - src/patchNotes.ts: prepend empty PatchNote entry for the new version
 *
 * Usage:
 *   node scripts/bump-version.js patch       0.9.6-beta → 0.9.7-beta
 *   node scripts/bump-version.js minor       0.9.6-beta → 0.10.0-beta
 *   node scripts/bump-version.js major       0.9.6-beta → 1.0.0  (drops -beta)
 *   node scripts/bump-version.js sync        force package.json to match app.json
 *   node scripts/bump-version.js 0.9.7-beta  explicit version
 *
 * After bumping, fill in the placeholder entry in src/patchNotes.ts with real
 * changes (with matching i18n keys in src/i18n/{en,nb}/patchNotes.ts).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: node scripts/bump-version.js <patch|minor|major|sync|x.y.z[-tag]>");
  process.exit(1);
}
const mode = args[0];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}
function writeJson(rel, obj) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(obj, null, 2) + "\n");
}

const app = readJson("app.json");
const pkg = readJson("package.json");

const currentVersion = app.expo.version;

function parse(v) {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!m) throw new Error(`Cannot parse version: ${v}`);
  return { major: +m[1], minor: +m[2], patch: +m[3], tag: m[4] || null };
}
function format({ major, minor, patch, tag }) {
  const base = `${major}.${minor}.${patch}`;
  return tag ? `${base}-${tag}` : base;
}

let nextVersion;
if (mode === "sync") {
  nextVersion = currentVersion;
} else if (mode === "patch") {
  const v = parse(currentVersion);
  v.patch += 1;
  nextVersion = format(v);
} else if (mode === "minor") {
  const v = parse(currentVersion);
  v.minor += 1;
  v.patch = 0;
  nextVersion = format(v);
} else if (mode === "major") {
  const v = parse(currentVersion);
  v.major += 1;
  v.minor = 0;
  v.patch = 0;
  v.tag = null; // strip beta on major
  nextVersion = format(v);
} else if (/^\d+\.\d+\.\d+(-.+)?$/.test(mode)) {
  nextVersion = mode;
} else {
  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}

// 1. app.json
if (mode !== "sync") {
  app.expo.version = nextVersion;
  app.expo.android.versionCode = (app.expo.android.versionCode || 0) + 1;
  writeJson("app.json", app);
}

// 2. package.json
pkg.version = nextVersion;
writeJson("package.json", pkg);

// 3. patchNotes.ts — prepend placeholder entry
if (mode !== "sync") {
  const patchNotesPath = path.join(ROOT, "src/patchNotes.ts");
  const src = fs.readFileSync(patchNotesPath, "utf8");
  const today = new Date().toISOString().slice(0, 10);
  const safeKey = nextVersion.replace(/[.-]/g, "_");
  const placeholder = `  {
    version: "${nextVersion}",
    date: "${today}",
    changes: [
      // TODO: fill in changes with i18n keys, e.g.
      // { type: "new", key: "patchNotes.${safeKey}.exampleChange" },
    ],
  },
`;
  const updated = src.replace(
    /(export const patchNotes: PatchNote\[\] = \[\n)/,
    `$1${placeholder}`,
  );
  if (updated === src) {
    console.error("Could not locate patchNotes array start in src/patchNotes.ts");
    process.exit(1);
  }
  fs.writeFileSync(patchNotesPath, updated);
}

console.log(`Bumped to ${nextVersion}`);
if (mode !== "sync") {
  console.log(`  app.json versionCode: ${app.expo.android.versionCode}`);
  console.log(`  Placeholder entry added to src/patchNotes.ts — fill in changes + matching i18n keys.`);
}
