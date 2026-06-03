#!/usr/bin/env node
/**
 * scripts/set-release-notes.js
 *
 * Sets Google Play "What's new" (release notes) for the current release, pulled
 * from src/patchNotes.ts + the i18n text files, via the Google Play Developer
 * API. EAS Submit only uploads the .aab and does NOT set release notes — this
 * fills that gap so the store "What's new" never goes stale again.
 *
 * Reuses the SAME service account key as EAS Submit
 * (credentials/google-play-service-account.json).
 *
 * Usage (run AFTER the build has been submitted to the track):
 *   node scripts/set-release-notes.js            # set notes on the alpha release
 *   node scripts/set-release-notes.js --dry-run  # print what would be set, no API call
 *
 * `npm run release:android` does build + auto-submit + this in one go.
 *
 * Language handling: the script reads which languages the Play listing actually
 * supports and maps each one to our text — en* → English, no/nb* → Norwegian.
 * Languages we have no text for are skipped, so it never errors on that.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const MAX_LEN = 500; // Google Play hard limit per language
const KEY_PATH = path.join(ROOT, "credentials", "google-play-service-account.json");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function fail(msg) {
  console.error(`${RED}✗ ${msg}${RESET}`);
  process.exit(1);
}

// --- 1. app.json: package, versionCode, version --------------------------------
const app = JSON.parse(read("app.json"));
const packageName = app?.expo?.android?.package;
const versionCode = app?.expo?.android?.versionCode;
const appVersion = app?.expo?.version;
if (!packageName || !Number.isInteger(versionCode)) {
  fail("app.json: missing expo.android.package or versionCode");
}

// track from eas.json submit profile (fallback: alpha)
let track = "alpha";
try {
  const eas = JSON.parse(read("eas.json"));
  track = eas?.submit?.production?.android?.track || track;
} catch {
  /* keep default */
}

// --- 2. newest patchNotes.ts entry -> ordered change keys ----------------------
const pnSrc = read("src/patchNotes.ts");
const arrStart = pnSrc.indexOf("patchNotes: PatchNote[] = [");
if (arrStart === -1) fail("patchNotes.ts: could not locate the patchNotes array");
const afterArr = pnSrc.slice(arrStart);
const verMatch = afterArr.match(/version:\s*"([^"]+)"/);
const changesMatch = afterArr.match(/changes:\s*\[([\s\S]*?)\]/); // first (= newest) entry
if (!verMatch || !changesMatch) fail("patchNotes.ts: could not parse the newest entry");
const newestVersion = verMatch[1];
if (newestVersion !== appVersion) {
  fail(`patchNotes.ts newest (${newestVersion}) ≠ app.json version (${appVersion}). Run \`npm run check-version\`.`);
}
const changeKeys = [...changesMatch[1].matchAll(/\{\s*type:\s*"(\w+)",\s*key:\s*"([^"]+)"\s*\}/g)].map((m) => ({
  type: m[1],
  key: m[2],
}));
if (!changeKeys.length) fail("patchNotes.ts: newest entry has no changes");

// --- 3. flat i18n maps (regex parse — files are `"key": "value"` literals) ------
function loadI18n(locale) {
  const src = read(`src/i18n/${locale}/patchNotes.ts`);
  const map = {};
  const re = /"(patchNotes\.[^"]+)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(src))) {
    try {
      map[m[1]] = JSON.parse(`"${m[2]}"`); // unescape —, \" etc.
    } catch {
      map[m[1]] = m[2];
    }
  }
  return map;
}

// --- 4. build a "what's new" string per locale, truncated to 500 chars ----------
function buildNotes(locale) {
  const map = loadI18n(locale);
  const lines = [];
  for (const { key } of changeKeys) {
    const text = map[key];
    if (text) lines.push(`• ${text}`); // • bullet
  }
  if (!lines.length) fail(`No i18n text resolved for locale "${locale}" (keys missing?)`);
  let out = "";
  for (const line of lines) {
    const candidate = out ? `${out}\n${line}` : line;
    if (candidate.length > MAX_LEN - 2) {
      out = `${out}\n…`; // … when there are more items than fit
      break;
    }
    out = candidate;
  }
  return out.slice(0, MAX_LEN);
}

const textByLocale = { en: buildNotes("en"), nb: buildNotes("nb") };

function textForPlayLanguage(lang) {
  if (lang.startsWith("en")) return textByLocale.en;
  if (lang.startsWith("no") || lang.startsWith("nb")) return textByLocale.nb;
  return null; // unsupported language — skipped
}

// --- preview -------------------------------------------------------------------
console.log(`\nGymdash «What's new» — v${appVersion} (versionCode ${versionCode}), track "${track}"\n`);
for (const [locale, text] of Object.entries(textByLocale)) {
  console.log(`${DIM}── ${locale} (${text.length}/${MAX_LEN} chars) ──${RESET}`);
  console.log(text);
  console.log("");
}

if (DRY_RUN) {
  console.log(`${DIM}--dry-run: no API call made. Texts above map to the listing's en*/no* languages.${RESET}`);
  process.exit(0);
}

// --- 5. push to Google Play via the Developer API ------------------------------
(async () => {
  if (!fs.existsSync(KEY_PATH)) fail(`Service account key not found at ${KEY_PATH}`);

  let androidpublisher, auth;
  try {
    ({ androidpublisher, auth } = require("@googleapis/androidpublisher"));
  } catch {
    fail("Missing dependency. Run: npm install --save-dev @googleapis/androidpublisher");
  }

  const authClient = new auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const client = androidpublisher({ version: "v3", auth: authClient });

  const { data: edit } = await client.edits.insert({ packageName });
  const editId = edit.id;

  try {
    // Which languages does the listing actually support?
    const { data: listings } = await client.edits.listings.list({ packageName, editId });
    const langs = (listings.listings || []).map((l) => l.language);
    const releaseNotes = langs
      .map((language) => ({ language, text: textForPlayLanguage(language) }))
      .filter((n) => n.text);
    if (!releaseNotes.length) {
      fail(`No listing language matched en*/no*. Listing languages: ${langs.join(", ") || "(none)"}`);
    }

    // Find the release on the track that contains our versionCode.
    const { data: trackData } = await client.edits.tracks.get({ packageName, editId, track });
    const target = (trackData.releases || []).find((r) =>
      (r.versionCodes || []).map(String).includes(String(versionCode)),
    );
    if (!target) {
      fail(`No release with versionCode ${versionCode} on track "${track}". Submit the build first.`);
    }
    target.releaseNotes = releaseNotes;

    await client.edits.tracks.update({ packageName, editId, track, requestBody: trackData });
    await client.edits.commit({ packageName, editId });

    console.log(
      `${GREEN}✓ «What's new» set on "${track}" for versionCode ${versionCode} (${releaseNotes
        .map((n) => n.language)
        .join(", ")}).${RESET}`,
    );
  } catch (err) {
    await client.edits.delete({ packageName, editId }).catch(() => {});
    throw err;
  }
})().catch((err) => {
  const msg =
    err?.errors?.[0]?.message || err?.response?.data?.error?.message || err?.message || String(err);
  fail(`Play API error: ${msg}`);
});
