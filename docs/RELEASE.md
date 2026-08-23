# Release-flyt — Gymdash (Android)

Hvordan bygge en ny produksjonsbuild som **automatisk** lastes opp til Play
Console og når testerne i det lukkede testsporet (`alpha`).

Oppsettet bruker **EAS Build** + **EAS Submit**. Versjonering forblir bevisst
manuell (se [Hvorfor ikke auto-increment?](#hvorfor-ikke-auto-increment)).

---

## Engangsoppsett: Google Play service account

EAS Submit trenger en tjenestekonto-nøkkel for å laste opp via Play sin API.
Dette gjøres **én gang**.

1. **Koble Google Cloud-prosjekt** (om ikke gjort):
   Play Console → *Innstillinger* → **API-tilgang** → koble til / opprett et
   Google Cloud-prosjekt.

2. **Opprett tjenestekonto + nøkkel:**
   Fra API-tilgang-siden, klikk *Opprett tjenestekonto* → følg lenken til
   Google Cloud Console → **Create service account** → gi den et navn
   (f.eks. `eas-submit`) → ferdigstill → under *Keys* → **Add key → JSON**.
   En `.json`-fil lastes ned.

3. **Gi rettigheter i Play Console:**
   Tilbake i Play Console → *Brukere og tillatelser* → tjenestekontoen dukker
   opp (eller inviter e-postadressen dens) → gi den minst:
   **«Administrer testutgaver»** / *Release to testing tracks* for Gymdash-appen.

4. **Legg nøkkelen på plass:**
   ```
   credentials/google-play-service-account.json
   ```
   Filen er git-ignorert og refereres fra `eas.json`. **Aldri commit den.**

> Alternativ: lagre nøkkelen i EAS i stedet for lokalt med `eas credentials`
> (Android → *Google Service Account*). Da kan du fjerne `serviceAccountKeyPath`
> fra `eas.json`, og submit fungerer fra hvilken som helst maskin / CI.

---

## Per release

```bash
# 1. Bump versjon (én av patch / minor / major) — oppdaterer app.json,
#    package.json og legger en placeholder i src/patchNotes.ts
npm run bump-version minor

# 2. Fyll inn ekte patch notes i src/patchNotes.ts + i18n-nøkler
#    (src/i18n/{en,nb}/patchNotes.ts), og legg en `## vX.Y.Z`-seksjon i CHANGELOG.md

# 3. Verifiser at alt henger sammen (versjoner, typer, tester, lint)
npm run verify

# 4. Commit versjonsbumpen
git add -A && git commit -m "release: vX.Y.Z-beta"

# 5. Bygg + last opp + sett «Hva er nytt» automatisk (alpha-sporet)
npm run release:android
```

Steg 5 (`release:android`) gjør tre ting: bygger en `.aab` på EAS-serverne,
kjører **EAS Submit** (`--auto-submit`) til `alpha`-sporet med
`releaseStatus: completed`, og kjører deretter `scripts/set-release-notes.js`.
Testerne får oppdateringen så snart Google har prosessert den (minutter–timer).

### «Hva er nytt» (release notes) — automatisert

**EAS Submit setter ikke Play sin «Hva er nytt»-tekst** — den laster kun opp
`.aab`-en. Derfor gjør `scripts/set-release-notes.js` det via **Play Developer
API**: leser nyeste entry i `src/patchNotes.ts`, slår opp tekstene i
`src/i18n/{en,nb}/patchNotes.ts`, og setter «Hva er nytt» på alpha-utgivelsen
(maks 500 tegn per språk). Gjenbruker tjenestekonto-nøkkelen.

```bash
node scripts/set-release-notes.js --dry-run   # forhåndsvis teksten, ingen publisering
node scripts/set-release-notes.js             # sett notatene på siste alpha-utgivelse
```

> Dette er Play Store-**listingen**, ikke appens interne `patchNotes.ts`.
> Listingen har foreløpig kun `en-US`, så butikk-notatene blir engelske. Vil du ha
> norske, legg til norsk som listing-språk i Play — scriptet plukker det opp
> automatisk (det setter notater for alle `en*`/`no*`-språk listingen har).

### Hvis en build allerede er bygd uten auto-submit

```bash
npm run submit:android   # laster opp siste build til alpha-sporet
```

---

## Automatisk release ved merge til main

Merge til `main` bygger og submitter automatisk — men **kun når merge-en
faktisk bumpet `versionCode`** i app.json. Workflow-fila ligger i
[`.github/workflows/release-android.yml`](../.github/workflows/release-android.yml).

1. `guard`-jobben kjører [`scripts/ci-should-release.js`](../scripts/ci-should-release.js),
   som sammenligner `expo.android.versionCode` på `HEAD` mot `HEAD^`. Uendret
   versionCode → release-jobben hoppes over, og ingen byggeminutter brukes.
   (Kjør scriptet lokalt for å se hva CI ville bestemt.)
2. `release`-jobben kjører `npm run verify`, så
   `eas build --platform android --profile production --auto-submit`, og til slutt
   `npm run set-release-notes`.

### Engangsoppsett (i tillegg til tjenestekontoen over)

1. **`EXPO_TOKEN`** (påkrevd) — expo.dev → Account settings → Access tokens →
   lag en token. Legg den inn i GitHub: repoet → Settings → Secrets and
   variables → Actions → New repository secret. Uten den stopper workflowen
   umiddelbart med en tydelig feilmelding.
2. **`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`** (valgfri) — hele innholdet i
   `credentials/google-play-service-account.json` som én secret. Uten den
   bygger og submitter workflowen fortsatt, men Play «Hva er nytt» hoppes over
   (med en warning) og må settes med `npm run set-release-notes` lokalt.
3. **Lagre Play-nøkkelen i EAS** (allerede gjort — serverne har ikke den lokale fila):
   ```bash
   eas credentials
   # → Android → Google Service Account → last opp samme JSON-nøkkel
   ```

### Slik releaser du da

```bash
npm run bump-version minor      # som før
# fyll inn patch notes + CHANGELOG
npm run verify
git add -A && git commit -m "release: v0.14.0-beta"
# merge til main (PR eller direkte push) ← trigger bygg + submit + «Hva er nytt»
```

> Versjonsbumpen forblir manuell (se under) — automatikken fjerner kun det
> lokale bygg-steget, ikke den bevisste versjoneringen.

### Manuelle fallbacks

- **Lokalt, uten CI:** `npm run release:android` (bygg + auto-submit + «Hva er nytt»).
- **På EAS sine servere:** [`.eas/workflows/release-android.yml`](../.eas/workflows/release-android.yml)
  gjør samme bygg + submit, men har ingen automatisk trigger lenger — tag-triggeren
  er fjernet slik at tag-push og merge ikke bygger samme `versionCode` to ganger
  (Play ville avvist den andre som duplikat). Start den manuelt med
  `eas workflow:run release-android.yml`. Krever at GitHub-repoet er koblet til
  EAS-prosjektet (expo.dev → prosjektet → Connect GitHub). NB: den setter ikke
  Play «Hva er nytt» — kjør `npm run set-release-notes` etterpå.

## Hvorfor ikke auto-increment?

`versionCode` bumpes bevisst via `scripts/bump-version.js`, ikke av EAS sin
remote-versjonering. Grunnen: `versionCode`, `version`, `package.json`,
`src/patchNotes.ts` og `CHANGELOG.md` må alle stemme overens — dette håndheves av
`npm run check-version` (kjøres i `verify`). Hver versjon er koblet til patch
notes brukerne faktisk ser. Derfor er `appVersionSource: "local"` satt i
`eas.json`, og app.json er fasit.

> Konsekvens: bygger du to ganger uten å bumpe, vil Play **avvise** den andre
> opplastingen pga. duplikat `versionCode`. Det er en feature, ikke en bug — den
> tvinger en intensjonell release.

---

## Spor-oversikt

| Play-spor          | Hvem            | Hvordan dit                                   |
| ------------------ | --------------- | --------------------------------------------- |
| `alpha` (lukket)   | Inviterte testere | Merge til `main` med bumpet `versionCode` (eller `npm run release:android` lokalt) |
| `internal`         | Internt team    | `eas submit -p android --profile production --track internal` |
| `production`       | Alle på Google Play | Krever 12 testere/14 dager først — ikke åpnet ennå |

For å gå til produksjon senere: endre `track` i `eas.json` til `production`
(eller kjør submit med `--track production`) etter at produksjonstilgang er
innvilget.
