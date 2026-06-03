#!/usr/bin/env node
/**
 * scripts/render-icons.js
 *
 * Renders the app-icon PNGs from the SVG sources in assets/. The SVGs are the
 * source of truth (the dumbbell mark); these PNGs are what the build actually
 * embeds. Re-run after editing the SVGs:
 *
 *   node scripts/render-icons.js
 *
 * Outputs:
 *   assets/images/icon.png                    (1024² opaque)  — iOS + Android legacy
 *   assets/images/android-icon-foreground.png (1024² alpha)   — adaptive icon foreground
 *   assets/images/android-icon-monochrome.png (1024² alpha)   — Android 13+ themed icon
 *
 * The adaptive icon background is a solid colour (app.json android.adaptiveIcon
 * .backgroundColor), so no background PNG is generated.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const A = (p) => path.join(ROOT, p);
const SIZE = 1024;
const ICON_BG = "#0D0B1A"; // matches the dark background baked into gymdash-icon.svg

async function render(svgPath, outPath, { flatten, transform } = {}) {
  let svg = fs.readFileSync(svgPath, "utf8");
  if (transform) svg = transform(svg);
  let img = sharp(Buffer.from(svg), { density: 384 }).resize(SIZE, SIZE, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (flatten) img = img.flatten({ background: flatten });
  await img.png().toFile(outPath);
  console.log(`✓ ${path.relative(ROOT, outPath)} (${SIZE}×${SIZE}${flatten ? ", opaque" : ", alpha"})`);
}

(async () => {
  // Full icon — opaque square (OS applies its own corner mask).
  await render(A("assets/gymdash-icon.svg"), A("assets/images/icon.png"), { flatten: ICON_BG });

  // Adaptive foreground — dumbbell only, transparent.
  await render(A("assets/gymdash-icon-foreground.svg"), A("assets/images/android-icon-foreground.png"));

  // Monochrome — white silhouette of the dumbbell for themed icons.
  await render(A("assets/gymdash-icon-foreground.svg"), A("assets/images/android-icon-monochrome.png"), {
    transform: (svg) => svg.replace(/url\(#grad\)/g, "#FFFFFF").replace(/#F97316/g, "#FFFFFF"),
  });

  console.log("\nDone. Rebuild (npm run build:android) for the new icon to take effect on device.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
