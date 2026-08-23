# Gymdash — CLAUDE.md

> Denne filen leses automatisk av Claude Code ved hver samtale.
> Hold den oppdatert med prosjektregler, beslutninger og backlog.

## Prosjekt

Gymdash er en privacy-first, 100% offline treningsapp bygget med React Native, Expo SDK 54, Expo Router, SQLite og TypeScript. Se `CONTEXT.md` for full arkitektur og funksjonalitet.

## Regler

- **Les CONTEXT.md** ved starten av hver sesjon for å forstå nåværende tilstand
- **Aldri** bruk `elevation` på elementer med transparent/semi-transparent bakgrunn (Android)
- **Vekter**: lagres alltid i kg internt. Bruk `useWeightUnit()` for display/input
- **i18n**: alle UI-strenger via `t("key")`, legg til i `src/i18n.ts` (nb + en)
- **expo-file-system**: `import * as FileSystem from "expo-file-system/src/legacy"`
- **UI-komponenter**: `src/ui/index.tsx` (base) + `src/ui/modern.tsx` (glassmorphism)
- **Sirkulær import**: db.ts ↔ exerciseLibrary.ts bruker lazy `require()`
- **Verifisering**: `npm run verify` etter alle endringer (tsc + jest + lint)
- **Unngå falske features**: hver funksjon må genuint hjelpe noen å trene bedre

## Agent-team

Gymdash har et komplett agent-team i `.claude/agents/`. Bruk dem via pipeline:

```
DISCOVERY → PLANNING → BUILD → QUALITY → OPS
@scout → @architect → @prompt-builder → @verify → @session-closer
@brainstorm → @db-designer → → @code-reviewer
@ux-critic → @task-splitter → → @tester
@bug-hunter
@codebase-scanner
@gemini-research
```

Output lagres i `docs/` (ideas/, plans/, prompts/, research/, reviews/, sessions/).

## Utgivelse (EAS Build → Play Store)

Appen publiseres til Play via **EAS Build + EAS Submit (auto-submit)**. Full guide: `docs/RELEASE.md`.

**Oppsett (ferdig per juni 2026):**
- Tjenestekonto `eas-submit@gymdash.iam.gserviceaccount.com` — satt opp i Play (13 tillatelser på appen), Google Cloud (**Android Publisher API enabled**, prosjekt «Gymdash») og lagret i EAS. Lokal nøkkel i `credentials/google-play-service-account.json` (git-ignorert).
- GitHub koblet til EAS-prosjektet (`flagestad96-blip/app-gymdash`, base `/`).
- Aktivt spor: **lukket testing «alpha»**. `eas.json` submit → track `alpha`, releaseStatus `completed`.
- `appVersionSource: "local"` — app.json er fasit for `versionCode`. Bumpes via `scripts/bump-version.js`, **ikke** EAS auto-increment (koblet til patch notes + håndhevet av `check-version`).

**Per release (kjerneflyt):**
1. `npm run bump-version <patch|minor|major>` (bumper app.json/package.json + patchNotes-placeholder)
2. Fyll inn ekte patch notes i `src/patchNotes.ts` + i18n (`src/i18n/{en,nb}/patchNotes.ts`) + `## vX.Y.Z` i `CHANGELOG.md`
3. `npm run verify`
4. `npm run release:android` → bygger + auto-submitter til alpha **og** setter «Hva er nytt» automatisk. Testerne får auto-oppdatering når Google er ferdig å prosessere (minutter–timer).

**Play «Hva er nytt» (release notes) — automatisert:**
EAS Submit setter ikke release notes selv. Det gjør `scripts/set-release-notes.js` (kjøres av `npm run release:android`): leser nyeste `patchNotes.ts`-entry + i18n-tekstene og setter «Hva er nytt» via **Play Developer API** (gjenbruker tjenestekonto-nøkkelen). Forhåndsvis uten å publisere: `node scripts/set-release-notes.js --dry-run`.
NB: Dette er Play Store-**listingen**, ikke appens interne `patchNotes.ts`. Listingen har foreløpig **kun `en-US`**, så butikk-notatene blir engelske (norsk tekst genereres, men brukes først når du legger til norsk som listing-språk i Play).

**Sjekkliste til neste økt:**
- `versionCode` MÅ økes hver release, ellers avviser Play (duplikat).
- Play «Hva er nytt» settes automatisk av `release:android` (`set-release-notes.js` via Play API). **NB:** tag-push-workflowen kjører kun build+submit på EAS — den setter IKKE release notes (scriptet trenger den lokale nøkkelen i `credentials/`). Etter en tag-release: kjør `npm run set-release-notes` lokalt, eller sett teksten i Play Console. Store-listingen er `en-US` only — legg til norsk listing-språk i Play hvis du vil ha norske notater.
- **Produksjon** (åpen for alle): krever fortsatt 12 testere i 14 dager (har 2). Bytt `track` til `production` i eas.json når innvilget.
- **Tag-push-workflow** (`.eas/workflows/release-android.yml`): `serviceAccountKeyPath` er fjernet fra `eas.json` (aug 2026) — EAS-serverne bruker den EAS-lagrede nøkkelen, og lokal `eas submit` gjør nå det samme. Workflowen trigges av **tag-push** (`git tag vX.Y.Z && git push origin vX.Y.Z`), IKKE av merge til main. Merge kjører kun `.github/workflows/verify.yml` (typecheck/test/lint).
- 🔐 Vurder å rullere Play-tjenestekontonøkkelen i Google Cloud (den lå i en chat-logg under oppsettet).

## Pågående arbeid

- **Release-pipeline**: ferdig. EAS auto-submit til alpha er live, og tag-push-workflowen er avblokkert (se «Utgivelse» over). Eneste manuelle steg etter en tag-release er Play «Hva er nytt» (`npm run set-release-notes`).

## Backlog (prioritert)

> Gjennomgått 2026-08-23: punktene 1–6 fra forrige backlog er verifisert levert
> (PR-rekalkulering ved edit/delete, gym locations UI inkl. picker/CRUD/
> utstyrsmerking, resume-banner på hjem, utstyrssortering i exercise-picker,
> rep-max estimator i Historikk, ukentlig ryggbelastnings-score på hjem).

### Lav prioritet / utforsk videre
1. **Fatigue-trend fra RPE-data** — Rullerende RPE-graf over tid per muskelgruppe. Overtrening-signal. (Delvis dekket av treningsstatus-kortet og progresjons-coachens RPE-logikk.)
2. **Første-økt tooltips** — Kontekstuelle tips under første reelle logging (vis én gang).
3. **Comeback-ramp over flere økter** — Coachen foreslår i dag én redusert startvekt; kan utvides til en 2–3-ukers opptrappingsplan.

## Ikke gjør

- **Treningsvideoer** — For stort innholdsprosjekt, bedre med eksterne lenker
- **Kardio-tracking** — Annet domene, ville utvannet styrkefokuset
- **Sosiale features / leaderboards** — Strider mot privacy-first-filosofien
- **Web-plattform** — DB er deaktivert, verdien er på mobil

## Sessjonslogger

Se `docs/sessions/` for full historikk over alle utviklingssesjoner.
