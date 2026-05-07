# Supersett-UX — Anbefaling

**Dato:** 2026-05-07
**Forfatter:** Produktsjef-syntese (basert på 4 uavhengige brainstorm-agenter)
**Kilder:** `superset-brainstorm-a.md` (×2), `superset-brainstorm-b.md` (×2)
**Status:** Spec for implementering — klar for `@architect` og `@db-designer`

---

## Sammendrag av konvergens

Fire uavhengige agenter genererte ~28 ideer. Når man fjerner duplikater, konvergerer **fire prinsipper** uavhengig av hvem som skrev:

| Prinsipp | Agenter som foreslo | Sammendrag |
|---|---|---|
| **Runde som førstegangs-konsept** | Alle 4 | Bytt mental modell fra «sett-rotasjon» til «runde 2 av 4». Header øverst, progress-dots, runde-fullført-feedback. |
| **To-trinns hviletimer** | Alle 4 | Kort hvile (transition) mellom slots i samme runde, full hvile mellom runder. Nesten alle kalte denne #1 i verdi. |
| **Kollaps inaktive slots til kompakte rader** | Alle 4 | Bare én slot er ekspandert med full input. De andre vises som én-linjes oppsummering med progress-dots. Løser 3-veis-høydeproblemet. |
| **Long-press for skip/drop/bonus** | 3 av 4 | Long-press på slot-rad åpner kontekstmeny: skip i runden, dropp resten av økten, bonus-sett til kun A. |

Avvik som **ikke** ble plukket opp:
- Sweat-mode (kun b-kalam) — for stort design-skifte, opt-in.
- Carousel/swipe-deck (b-kalam idé 3, b-mahavira idé 1) — flere agenter advarte mot gesture-konflikt med ScrollView. Vraket.
- Felles input-bar (b-kalam idé 4) — risiko for å logge til feil slot. Vraket.
- Eksplisitte typer (antagonist/triset/giant) — interessant, men nedprioritert som senere optimalisering.

---

## Anbefaling i én setning

**Bygg «Runde-kort»: ett supersett-kort med rundeteller øverst, kollapsede slot-rader der kun aktiv slot er ekspandert, og to-trinns hviletimer som forstår forskjellen mellom å bytte øvelse og å hvile mellom runder.**

Dette er mellomtinget mellom det dyreste alternativet (full carousel/hero-card med swipe) og minste-mulige-fix (bare timer-justering). Det treffer alle fire konvergens-punktene med moderat innsats.

---

## 1. Visuelt design

### 2-veis supersett

```
┌─────────────────────────────────────────────────┐
│ SUPERSETT · Runde 2 av 4         ●●○○           │
├─────────────────────────────────────────────────┤
│ ▸ A · Tricep Pushdown                           │  ← ekspandert (aktiv)
│   Mål: 3×8–12 · Sist: 27.5 kg × 10              │
│   ┌──────┐ ┌──────┐ ┌──────┐                    │
│   │ 27.5 │ │  10  │ │  7   │  kg / reps / RPE   │
│   └──────┘ └──────┘ └──────┘                    │
│   [- 2.5] [+ 2.5]  [+3]                         │
│   Sett: 27.5×10 RPE7 · 30×8 RPE8                │
├─────────────────────────────────────────────────┤
│ ○ B · DB Curl   sist 12.5×10   1/3              │  ← kollapset
└─────────────────────────────────────────────────┘
   [   Logg sett A → bytt til B   ]                   ← primær CTA
```

### 3-veis supersett

Samme layout, bare med tre rader. Kun aktiv er ekspandert; de to andre er kollapset til 1-linjes status. Total kort-høyde for 3-veis ≈ 540 px (full ekspansjon ~420 px + 2 × 60 px linjer) i stedet for dagens ~1500 px.

```
┌─────────────────────────────────────────────────┐
│ SUPERSETT · Runde 1 av 3         ●○○            │
├─────────────────────────────────────────────────┤
│ ○ A · Benkpress     sist 80×8        1/3        │  ← kollapset
├─────────────────────────────────────────────────┤
│ ▸ B · Stående roing                             │  ← ekspandert
│   [inputs + sett-tabell som før]                │
├─────────────────────────────────────────────────┤
│ ○ C · Kabel-fly     sist 25×12       0/3        │  ← kollapset
└─────────────────────────────────────────────────┘
   [   Logg sett B → bytt til C   ]
```

### Designdetaljer

- **Rundeteller** (`Runde 2 av 4`): Stor, lesbar, midten øverst. Mini-prikker (`●●○○`) til høyre — én prikk per planlagt runde, fylt = ferdig.
- **Slot-radene** har en venstre-stripe (4px) i slot-fargen: A=lilla, B=oransje, C=pink. Aktiv slot har en glow-aksent (samme stil som dagens fokus-glow).
- **Kollapset rad** (60 px høyde): bokstav-prikk · navn · `sist VVxR` · `N/M` (sett-progresjon). Hele raden er tappbar for å bytte fokus.
- **Ekspandert rad** beholder dagens `ExerciseHalf`-innhold uendret (vekt/reps/RPE-input, +/- chips, sett-tabell, PR-banner, alt-picker, plate-calc, notater) — vi gjenbruker komponenten med en `compact={true|false}`-prop.
- **Animasjon**: ≤200 ms slide+fade når man bytter aktiv slot. Hvis device er low-end (under React Native's `InteractionManager`-budget), fall tilbake til instant swap.

---

## 2. Logging-flyt (steg for steg)

Standard-flyt for et 2-veis supersett, 3 runder, A=Tricep Pushdown, B=DB Curl:

1. **Brukeren åpner økten.** Kortet er i Runde 1, slot A er ekspandert (default fokus = første slot). B er kollapset.
2. **Brukeren justerer vekt/reps i A** med chips eller direkte tap på input-feltet. RPE er valgfritt (slipp inn etter sett).
3. **Brukeren tapper primær-CTA**: `Logg sett A → bytt til B`. Knapp-teksten er alltid eksplisitt om hva som skjer.
4. **Sett A logges**, A kollapser til 1-linjes status (`A · ... · 1/3`), B ekspanderer i samme animasjon. Fokus settes automatisk på B's vekt-input.
5. **Hviletimeren starter med transition-tid** (default 15 sek). Floating-pillen viser **«Bytt øvelse · 0:14»** med oransje aksent (i stedet for lilla).
6. **Brukeren logger sett B**: `Logg sett B → fullfør runde 1`.
7. **Sett B logges → runde 1 er ferdig**: medium haptic, kortet får 300 ms accent-pulse, rundetelleren animerer til «Runde 2 av 3» (●●○ → ●○○? Nei: ● for runde 1 ferdig, ○ for de neste). Hviletimer starter med **full hvile** (default = `max(restA, restB)` fra per-øvelse-defaults). Pillen blir lilla og sier **«Hvil før runde 2 · 1:30»**.
8. **A ekspanderer igjen** (siden A er første slot i runde 2). Brukeren trenger ikke gjøre noe — kan begynne å justere vekt for runde 2 mens hen hviler.
9. Repeter til alle runder er fullført. Når alle planlagte runder er ✓, kortet får **grønn ✓-badge** og kollapser til oppsummering (kan ekspanderes manuelt for retting).

### CTA-ordlyd (nb)

- Mellom slots i samme runde: `Logg sett A → bytt til B`
- Siste slot i runden: `Logg sett B → fullfør runde 1`
- Siste sett av siste runde: `Logg sett B → fullfør supersett`
- Etter fullført supersett: knappen forsvinner; kortet blir collapsed med ✓.

(en: `Log A → next: B`, `Log B → finish round 1`, `Log B → finish superset`)

### CTA-prinsipp

Eksplisitt om hva som skjer videre. Brukeren skal aldri lure på «hvor logges dette?». Dette er det viktigste valget i hele speccen — det fjerner all tvetydighet som dagens stille auto-rotasjon skaper.

---

## 3. Timer-logikk

### To faser

| Fase | Trigger | Default | Visuelt |
|---|---|---|---|
| **Transition (mellom slots)** | Sett logget på en slot som ikke er siste i runden | 15 sek | Oransje pille, label «Bytt øvelse» |
| **Round rest (etter runde)** | Sett logget på siste slot i runden (B i 2-veis, C i 3-veis) | `max(restA, restB[, restC])` | Lilla pille, label «Hvil før runde N+1» |

### Hvorfor `max` og ikke `avg`?

`max` gir biologisk korrekt hvile for tyngste øvelse. Hvis A er compound (2:30) og B er isolasjon (1:15), trenger man fortsatt 2:30 for at A skal være restituert til neste runde. Snitt ville gitt 1:52 — for kort for A.

### Hvor lagres `transitionRest`?

- **Globalt**: ny innstilling i `settings.tsx`: `Hvile mellom slots i supersett` (default 15 sek, slider 0–60 sek).
- **Per-blokk override** (Fase 2, ikke MVP): hver supersett-blokk i program kan overstyre. Lagres i program-blokkens JSON, ikke ny tabell-kolonne.

### Bonussett-håndtering

Hvis brukeren logger en slot ut av rotasjon (via long-press → bonus, se §4), bruker timeren slot-ens egen per-øvelse-rest, ikke transition. Dette respekterer brukerens intensjon: «Jeg gjør et ekstra A-sett, behandl det som single-øvelse.»

### Skip / drop-håndtering

- **Skip slot i én runde**: rotasjonen hopper over slotten. Hvis det var siste slot, behandles forrige loggede slot som siste → round rest starter etter.
- **Drop slot resten av økten**: slotten fjernes fra rotasjonen permanent for økten. Et 3-veis blir effektivt 2-veis. `restC` ekskluderes fra `max`.

---

## 4. Sett-kvittering (CTA og feedback)

### Primær-CTA

Én stor knapp i bunnen av kortet, full-bredde, slot-fargen som bakgrunn (lilla for A, oransje for B, pink for C). Tekst er alltid eksplisitt («Logg sett B → fullfør runde 1»).

**Hvorfor én stor primær-knapp:** All brainstorm konvergerte på at «+ Neste: B»-mønsteret i dag er for usynlig under svette. Stor knapp + eksplisitt tekst er det vi skal optimalisere for.

### Mikro-feedback

| Hendelse | Reaksjon |
|---|---|
| Sett logget mellom slots | Light haptic, 150 ms scale-pulse på CTA |
| Runde fullført | Medium haptic, 300 ms accent-gradient-pulse rundt kortet, runde-teller rull-animasjon |
| Hele supersettet komplett | Success haptic-pattern (light-light-medium), grønn ✓-badge i topp-baren, kortet kollapser etter 1.5 s |
| PR oppnådd | Eksisterende PR-banner + ekstra accent-sweep over kortet |

**Aldri:**
- Lengre enn 600 ms animasjon
- Blokkere neste input
- Forsinke timer-start
- Lyder (default av; kan slås på i settings — ingen lyd er Marius' default)

### Nei til konfetti

Brainstorm b-kalam idé 2 foreslo konfetti ved fullført runde. Vi hopper over det — passer ikke Gymdashs stille, voksne tone. Accent-pulse + haptic er nok.

---

## 5. Edge cases

### 5.1 Ulikt antall sett per slot

**Eksempel:** A har `target_sets=4`, B har `target_sets=3`.

- **Antall planlagte runder = `max(target_sets)` = 4.**
- I runde 4 vises B's slot-rad som **grå/strikethrough** med teksten `B · ferdig 3/3`. Den er ikke tappbar.
- CTA i runde 4: `Logg sett A → fullfør supersett`. Ingen «bytt til B» fordi B er ferdig.
- Round rest etter runde 4 starter ikke (det er ingen runde etter).

**Hvorfor `max` og ikke `min`:** Tyngste øvelse (A) får ofte flere sett enn isolasjon (B). Dette er vanlig praksis. Hvis brukeren vil at B skal matche, kan hen øke B's `target_sets` i program-builder.

**Hva med A=2, B=4?** Samme regel: 4 runder, A's slot-rad blir grå etter runde 2. Brukeren får da B alene i runde 3 og 4 — som faktisk er hva mange gjør med drop-fokus på isolasjon.

### 5.2 Skip slot i én runde (skadet, opptatt)

Long-press på en kollapset slot-rad → bottom sheet:
- **Hopp over A i denne runden** — rotasjonen hopper, telleren går videre.
- **Dropp A resten av økten** — slotten fjernes fra rotasjonen for resten av økten (DB lagres ikke).
- **Bytt med alternativ** — åpner ALT-picker (eksisterende funksjon).
- **Bonus-sett til A nå** — logger til A uten å rotere; resumes alternering etter.

Skip/drop er **kun for denne aktive økten** — neste gang brukeren logger samme dag, er supersettet intakt.

### 5.3 Logge ut av rotasjon

Brukeren tapper en kollapset slot-rad → den ekspanderer (uten å logge noe). Hen kan da logge til den slotten direkte. Rotasjonen `huskes`: når brukeren har gjort et ekstra A-sett, hopper neste rotasjon-tap tilbake til der den var (B er fortsatt neste).

Dette gir fleksibilitet uten å miste rundebegrepet. Indikator: i runde-progresjonen vises bonus-sett som ekstra prikk: `●●●●+` for 4 runder + 1 bonus.

### 5.4 Equipment-utilgjengelig

I dag dimmes hele kortet hvis ETT slot mangler utstyr. Bedre: dim kun den berørte slot-raden, og legg en inline-CTA i den raden: `Bytt B til alternativ →` (åpner ALT-picker forhåndsfiltrert på tilgjengelig utstyr).

### 5.5 Bodyweight-slot

Vekt-input skjules i ekspandert form, kun reps + RPE. CTA-tekst og rotasjon påvirkes ikke.

### 5.6 Per-side øvelse i supersett

Settet logges som per-side som vanlig. CTA splittes: `Logg L → R` og `Logg R → bytt til B`. Brukeren må fullføre begge sider på en slot før rotasjonen går videre.

### 5.7 Ad-hoc paring (utsett)

Brainstorm b-mahavira idé 6 foreslo at brukeren kan koble to single-øvelser midt i økten («benken er opptatt, jeg gjør pull-ups mellom»). Verdifullt, men **ikke MVP** — krever ny session-state-modell og stort UI-arbeid. Legg på backlog.

### 5.8 Historikk og analyse (utsett)

Brainstorm a-rosalind idé 7 og a-volhard idé 6 foreslo å lagre `superset_group_id` på sett-tabellen for å bevare supersett-konteksten i historikk og analyse-grafer. Verdifullt for fremtidige features (RPE-drift per runde, supersett-PR-tolkning), men **ikke MVP**. DB-migrasjon er billig (én nullable kolonne), så vi kan inkludere lagringen i MVP og bygge visningen senere.

---

## Hva som er bevisst utelatt fra MVP

| Idé | Hvorfor utelatt |
|---|---|
| Carousel / swipe-deck | Gesture-konflikt med ScrollView, inkonsistent med single-exercise-kort, overkill. |
| Sweat-mode (full-screen single-button) | Krever opt-in-toggle og konkurrerer med eksisterende design-språk. Vurder etter MVP. |
| Felles input-bar | Risiko for å logge til feil slot. Innspart høyde er ikke verdt forvirringen. |
| Eksplisitte typer (antagonist/triset/giant) | God idé, men kan legges til som per-blokk-preset i Fase 2 uten å bryte MVP-modellen. |
| Per-superset-tittel («Trisepsblitz») | Polish, ikke kjernefunksjonalitet. |
| Ad-hoc paring midt i økt | Ny session-state-modell. Backlog. |
| Felles target-chip øverst | Nice-to-have. Kollapsede slot-rader viser allerede target — duplisering. |
| Fargekoding av A/B/C i hele appen | Slot-stripe og CTA-farge er nok. Floating timer-pill med fargeprikk kan vurderes som follow-up. |

---

## Implementeringsstørrelse (estimat)

| Komponent | Størrelse |
|---|---|
| `SupersetCard` refaktor med kollapsert/ekspandert state | M |
| `ExerciseHalf` får `compact`-prop | S |
| Two-stage timer-logikk i `restTimerContext` + `addSetForSuperset` | S–M |
| Eksplisitt rundeteller + state for «hvilken slot er aktiv» | M |
| Long-press kontekstmeny (bottom sheet) | S |
| `superset_group_id` DB-migrasjon (lagring kun) | S |
| Animasjoner og mikrointeraksjoner | S |
| Innstillinger: `transitionRest` slider | XS |
| i18n (nb + en) for alle nye strenger | S |

**Totalt: M (medium)** — sannsynligvis 3–5 dager fokusert arbeid.

---

## Spørsmål for `@architect` å avgjøre

1. **State-lokasjon for «aktiv slot per supersett»**: lokal i `SupersetCard`-komponenten, eller løftet til `WorkoutContext` for å overleve unmount? Anbefaling: lokal — overlever ikke remount, men det gjør heller ikke fokus i dag.
2. **Skal `superset_group_id` populeres retroaktivt** for eksisterende sett? Anbefaling: nei — kun fremover, dokumenter at historikk før migrasjon ikke har gruppering.
3. **Kompakt-modus for `ExerciseHalf`** — egen variant-komponent eller prop på eksisterende? Anbefaling: prop, for å holde sets-tabell og PR-banner-logikken ett sted.
4. **Hva er Marius' faktiske superset-praksis?** Hvis han nesten aldri gjør 3-veis selv, kan vi skjære ned ambisjonen ytterligere og bygge MVP for kun 2-veis først (3-veis støttes, men UI-polish for 3-veis kan defineres senere).

---

## Suksesskriterier

Når dette er bygget, skal følgende være sant:

- 3-veis supersett tar **ikke** over én skjermhøyde på en standard mobil (iPhone 14, Pixel 7).
- Hviletimeren viser tydelig **«Bytt øvelse»** vs **«Hvil før runde N»** med ulike farger.
- Brukeren vet alltid hvilken slot som er neste — uten å lese liten tekst.
- Brukeren kan skippe et slot i én runde uten å forlate logg-skjermen.
- Bonus-sett til kun A er én long-press unna, og ødelegger ikke rundetelleren.
- Etter fullført runde får brukeren tydelig kvittering (haptic + visuell pulse).
