#!/usr/bin/env node
/**
 * scripts/ci-should-release.js
 *
 * Guard for .github/workflows/release-android.yml.
 *
 * A push to main should only trigger a production build + Play submit when the
 * merge actually bumped `expo.android.versionCode` in app.json. Google Play
 * rejects a duplicate versionCode, so building on every merge would burn EAS
 * build minutes and then fail at the submit step.
 *
 * Compares the versionCode on HEAD against the one on HEAD^ (for a merge commit
 * that is the previous tip of main) and writes GitHub Actions outputs:
 *   should_release=true|false
 *   version=0.13.0-beta
 *   version_code=14
 *
 * Set FORCE_RELEASE=true to skip the comparison (manual workflow_dispatch).
 *
 * Run locally to see what CI would decide:  node scripts/ci-should-release.js
 */

const fs = require("fs");
const { execFileSync } = require("child_process");

const FORCE = process.env.FORCE_RELEASE === "true";

function readVersionCode(json, label) {
  const app = JSON.parse(json);
  const code = app?.expo?.android?.versionCode;
  const version = app?.expo?.version;
  if (!Number.isInteger(code)) {
    throw new Error(`${label}: expo.android.versionCode is missing or not an integer`);
  }
  return { code, version };
}

const current = readVersionCode(fs.readFileSync("app.json", "utf8"), "app.json (HEAD)");

let shouldRelease = false;
let reason = "";

if (FORCE) {
  shouldRelease = true;
  reason = `FORCE_RELEASE=true — building versionCode ${current.code} without comparing`;
} else {
  let previous = null;
  try {
    const prevJson = execFileSync("git", ["show", "HEAD^:app.json"], { encoding: "utf8" });
    previous = readVersionCode(prevJson, "app.json (HEAD^)");
  } catch {
    previous = null;
  }

  if (!previous) {
    // No parent commit, a shallow clone without it, or app.json is brand new.
    // Skipping is the safe default: a missed build is recoverable, a duplicate
    // versionCode submit is not.
    reason = "could not read app.json from HEAD^ — skipping (run the workflow manually to force)";
  } else if (current.code > previous.code) {
    shouldRelease = true;
    reason = `versionCode ${previous.code} → ${current.code} (v${current.version})`;
  } else if (current.code === previous.code) {
    reason = `versionCode unchanged (${current.code}) — nothing to release`;
  } else {
    reason = `versionCode went backwards (${previous.code} → ${current.code}) — refusing to build`;
  }
}

console.log(`${shouldRelease ? "RELEASE" : "SKIP"}: ${reason}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `should_release=${shouldRelease}`,
      `version=${current.version}`,
      `version_code=${current.code}`,
      `reason=${reason}`,
      "",
    ].join("\n"),
  );
}
