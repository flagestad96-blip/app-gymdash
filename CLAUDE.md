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
4. **Merge til `main`** → `.github/workflows/release-android.yml` bygger, auto-submitter til alpha og setter «Hva er nytt». Testerne får auto-oppdatering når Google er ferdig å prosessere (minutter–timer).
   - Lokal fallback (uten CI): `npm run release:android` gjør nøyaktig det samme fra maskinen din.

**Play «Hva er nytt» (release notes) — automatisert:**
EAS Submit setter ikke release notes selv. Det gjør `scripts/set-release-notes.js` (kjøres av `npm run release:android`): leser nyeste `patchNotes.ts`-entry + i18n-tekstene og setter «Hva er nytt» via **Play Developer API** (gjenbruker tjenestekonto-nøkkelen). Forhåndsvis uten å publisere: `node scripts/set-release-notes.js --dry-run`.
NB: Dette er Play Store-**listingen**, ikke appens interne `patchNotes.ts`. Listingen har foreløpig **kun `en-US`**, så butikk-notatene blir engelske (norsk tekst genereres, men brukes først når du legger til norsk som listing-språk i Play).

**Sjekkliste til neste økt:**
- `versionCode` MÅ økes hver release, ellers avviser Play (duplikat).
- Play «Hva er nytt» settes automatisk — av `release:android` lokalt, eller av merge-workflowen hvis repo-secreten `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` er satt (scriptet godtar nøkkelen som env-var siden `credentials/` er git-ignorert og ikke finnes i CI). Mangler secreten, hopper workflowen over steget med en warning — kjør `npm run set-release-notes` lokalt etterpå. Store-listingen er `en-US` only — legg til norsk listing-språk i Play hvis du vil ha norske notater.
- **Produksjon** (åpen for alle): krever fortsatt 12 testere i 14 dager (har 2). Bytt `track` til `production` i eas.json når innvilget.
- **Autobuild ved merge til main** (`.github/workflows/release-android.yml`, aug 2026): merge til `main` bygger + submitter, men **kun når merge-en bumpet `versionCode`** (guard: `scripts/ci-should-release.js` sammenligner HEAD mot HEAD^). Uendret versionCode → hele release-jobben hoppes over. Krever repo-secreten **`EXPO_TOKEN`**; `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` er valgfri (kun for «Hva er nytt»).
- **EAS-workflowen** (`.eas/workflows/release-android.yml`) har ikke lenger tag-trigger — den ville bygget samme versionCode som merge-workflowen, og Play avviser duplikatet. Kjør den manuelt ved behov: `eas workflow:run release-android.yml`. `serviceAccountKeyPath` er fjernet fra `eas.json` — både EAS-serverne og lokal `eas submit` bruker den EAS-lagrede nøkkelen.
- 🔐 Vurder å rullere Play-tjenestekontonøkkelen i Google Cloud (den lå i en chat-logg under oppsettet).

## Pågående arbeid

- **Release-pipeline**: ferdig. Merge til `main` med bumpet `versionCode` bygger, submitter til alpha og setter Play «Hva er nytt» automatisk (se «Utgivelse» over). Gjenstår kun å legge inn repo-secreten `EXPO_TOKEN` (og valgfritt `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`) i GitHub før workflowen kan kjøre.

## Backlog (prioritert)

> Gjennomgått 2026-08-23: punktene 1–6 fra forrige backlog er verifisert levert
> (PR-rekalkulering ved edit/delete, gym locations UI inkl. picker/CRUD/
> utstyrsmerking, resume-banner på hjem, utstyrssortering i exercise-picker,
> rep-max estimator i Historikk, ukentlig ryggbelastnings-score på hjem).

> Gjennomgått 2026-08-24: «Første-økt tooltips» og «Comeback-ramp over flere
> økter» er levert (v0.14-branchen), sammen med oppvarmingsramp på
> øvelseskortet, muskelbalanse-vurdering i analysen, live øktstatistikk og
> live hvile-nedtelling i varselfeltet (native modul — røyk-testes ved neste
> EAS-build).

### Lav prioritet / utforsk videre
1. **Fatigue-trend fra RPE-data** — Rullerende RPE-graf over tid per muskelgruppe. Overtrening-signal. (Delvis dekket av treningsstatus-kortet og progresjons-coachens RPE-logikk.)

## Ikke gjør

- **Treningsvideoer** — For stort innholdsprosjekt, bedre med eksterne lenker
- **Kardio-tracking** — Annet domene, ville utvannet styrkefokuset
- **Sosiale features / leaderboards** — Strider mot privacy-first-filosofien
- **Web-plattform** — DB er deaktivert, verdien er på mobil

## Sessjonslogger

Se `docs/sessions/` for full historikk over alle utviklingssesjoner.
