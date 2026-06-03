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

# 5. Bygg + last opp automatisk til Play (alpha-sporet)
npm run build:android
```

Steg 5 bygger en `.aab` på EAS-serverne og kjører **EAS Submit automatisk**
(`--auto-submit`) til `alpha`-sporet med `releaseStatus: completed`. Testerne i
det lukkede sporet får oppdateringen så snart Google har prosessert den (vanligvis
minutter til noen timer).

### ⚠️ «Hva er nytt» må settes manuelt i Play Console

**EAS Submit setter IKKE Play sin «Hva er nytt»-tekst** — den laster kun opp
`.aab`-en. Når feltet er tomt, gjenbruker Google **forrige releases** tekst, så
nye versjoner viser gamle notater til du retter det.

> Dette er IKKE appens interne `patchNotes.ts` (den er korrekt) — det er
> Play Store-listingen, en separat ting.

Sett den manuelt hver release:
**Play Console → Test og publiser → Lukket testing «alpha» → Administrer
utgivelsen → «Hva er nytt i denne utgaven»** (per språk nb + en, maks 500 tegn).
Kilde til teksten: nyeste entry i `src/patchNotes.ts` (selve tekstene ligger i
`src/i18n/{en,nb}/patchNotes.ts`).

### Hvis en build allerede er bygd uten auto-submit

```bash
npm run submit:android   # laster opp siste build til alpha-sporet
```

---

## Full automatikk (valgfritt): EAS Workflows

I stedet for å kjøre `npm run build:android` lokalt kan en **git-tag** trigge
bygg + submit på EAS sine servere. Workflow-fila ligger i
[`.eas/workflows/release-android.yml`](../.eas/workflows/release-android.yml).

### Engangsoppsett (i tillegg til tjenestekontoen over)

1. **Lagre Play-nøkkelen i EAS** (serverne har ikke den lokale fila):
   ```bash
   eas credentials
   # → Android → Google Service Account → last opp samme JSON-nøkkel
   ```
2. **Koble GitHub til EAS:** expo.dev → Gymdash-prosjektet → **Connect GitHub**,
   autoriser, og velg dette repoet.

### Slik releaser du da

```bash
npm run bump-version minor      # som før
# fyll inn patch notes + CHANGELOG
npm run verify
git add -A && git commit -m "release: v0.11.0-beta"
git tag v0.11.0-beta
git push && git push origin v0.11.0-beta   # ← tag-en trigger bygg + submit
```

Workflow-en kan også startes manuelt: `eas workflow:run release-android.yml`.

> Versjonsbump forblir manuell uansett (se under) — automatikken fjerner kun
> det lokale bygg-steget, ikke den bevisste versjoneringen.

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
| `alpha` (lukket)   | Inviterte testere | `npm run build:android` (auto-submit)        |
| `internal`         | Internt team    | `eas submit -p android --profile production --track internal` |
| `production`       | Alle på Google Play | Krever 12 testere/14 dager først — ikke åpnet ennå |

For å gå til produksjon senere: endre `track` i `eas.json` til `production`
(eller kjør submit med `--track production`) etter at produksjonstilgang er
innvilget.
