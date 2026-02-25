# Training Intelligence — Prompt 4 av 4

## Kontekst fra teamet:
- @architect: `docs/architecture/training-intelligence-2026-02-25.md` — Item 3: wire `log.perSideHint` (key exists, never rendered); Item 4: add "(ea)" suffix to SetEntryRow weight and PR banners
- @codebase-scanner:
  - `src/components/workout/ExerciseCard.tsx` — `ExerciseHalf` component at lines 186-631; weight input field area at lines 456-486 (the `<View style={{ flexDirection: "row", gap: 8 }}>` containing weight/reps/RPE inputs); `isPerSideExercise` is already imported at line 12 and used at line 465 for the `suffix` prop; the per-side hint should go right after the weight input row (after the RPE hint text at line 530-532).
  - `src/components/workout/SetEntryRow.tsx` — weight display at lines 70-78 (`<Text style={{ color: theme.text, fontWeight: theme.fontWeight.semibold }}>{formatWeight(wu.toDisplay(s.weight))}</Text>`); `isBodyweight` is imported at line 8 but `isPerSideExercise` is NOT imported — must add it.
  - `app/(tabs)/log.tsx` — PR banner construction at lines 1014-1027 (first call site after `addSet`) and lines 1137-1150 (second call site after `editSet`). Both use `rawMsgs.map()` with `t("log.newHeaviest", ...)` and `t("log.newE1rm", ...)`. The `exId` variable is in scope at both locations.
- @task-plan: Task 4 — no new i18n keys. Both `"log.perSideHint"` and `"log.each"` already exist in `src/i18n/en/log.ts` and `src/i18n/nb/log.ts`. Zero `EXPECTED_MIN_KEYS` change.

---

> "Wire the three silent per-side UX elements: hint text in ExerciseCard, '(ea)' in SetEntryRow, and '(ea)' suffix in PR banners.
>
> **Kontekst:** Three per-side UX strings exist in i18n but are never rendered: `log.perSideHint` ('Volume doubled (per side)') is defined but no component uses it; `log.each` ('ea') is defined but SetEntryRow doesn't append it; PR banners show raw weight without indicating it's a per-arm value. This task wires all three in one pass. No new keys needed.
>
> **Steg:**
>
> 1. Add `isPerSideExercise` import to `SetEntryRow.tsx` — `src/components/workout/SetEntryRow.tsx`
>    - Find line 8:
>    ```typescript
>    import { isBodyweight, bodyweightFactorFor } from "../../exerciseLibrary";
>    ```
>    - Replace with:
>    ```typescript
>    import { isBodyweight, bodyweightFactorFor, isPerSideExercise } from "../../exerciseLibrary";
>    ```
>
> 2. Append `(ea)` to weight display in `SetEntryRow` — `src/components/workout/SetEntryRow.tsx`
>    - Find the weight display at lines 70-78:
>    ```tsx
>    <View style={{ flex: 1 }}>
>      <Text style={{ color: theme.text, fontWeight: theme.fontWeight.semibold }}>
>        {formatWeight(wu.toDisplay(s.weight))}
>      </Text>
>      {bwInfo ? (
>        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
>          {bwInfo}
>        </Text>
>      ) : null}
>    </View>
>    ```
>    - Update the weight `<Text>` to append `(ea)` when per-side:
>    ```tsx
>    <View style={{ flex: 1 }}>
>      <Text style={{ color: theme.text, fontWeight: theme.fontWeight.semibold }}>
>        {formatWeight(wu.toDisplay(s.weight))}
>        {s.exercise_id && isPerSideExercise(s.exercise_id)
>          ? ` (${t("log.each")})`
>          : null}
>      </Text>
>      {bwInfo ? (
>        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
>          {bwInfo}
>        </Text>
>      ) : null}
>    </View>
>    ```
>    - Note: `t` and `{ t }` from `useI18n()` is already destructured at line 5 (check — if not, add `const { t } = useI18n();` after `const wu = useWeightUnit();`).
>
> 3. Add the per-side hint below the weight+reps+RPE input row — `src/components/workout/ExerciseCard.tsx`
>    - In the `ExerciseHalf` component, find the RPE hint text at lines 530-532:
>    ```tsx
>    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 9, textAlign: "right", marginTop: 2, opacity: 0.7 }}>
>      {t("log.rpeHoldHint")}
>    </Text>
>    ```
>    - This is inside `ExerciseHalf`, after the weight/reps/RPE `<View style={{ flexDirection: "row", gap: 8 }}>` block. Insert the per-side hint BEFORE the RPE hint (so it appears above it):
>    ```tsx
>    {isPerSideExercise(exId) ? (
>      <Text style={{
>        color: theme.muted,
>        fontFamily: theme.mono,
>        fontSize: 9,
>        marginTop: 1,
>        opacity: 0.7,
>      }}>
>        {t("log.perSideHint")}
>      </Text>
>    ) : null}
>    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 9, textAlign: "right", marginTop: 2, opacity: 0.7 }}>
>      {t("log.rpeHoldHint")}
>    </Text>
>    ```
>    - `isPerSideExercise` is already imported at line 12. `exId` is a prop of `ExerciseHalf`. `t` is already in scope at line 221.
>
> 4. Append `(ea)` to PR banners in the `addSet` path — `app/(tabs)/log.tsx`
>    - Find the first PR banner construction block at lines 1014-1020:
>    ```typescript
>    // Convert coded messages to display strings
>    const messages: string[] = rawMsgs.map((msg) => {
>      const [type, val] = msg.split(":");
>      const num = Number(val);
>      if (type === "heaviest") return t("log.newHeaviest", { weight: formatWeight(wu.toDisplay(num)) });
>      return t("log.newE1rm", { weight: formatWeight(wu.toDisplay(num)) });
>    });
>    ```
>    - The `exId` variable is in scope (it's the exercise being logged). Import `isPerSideExercise` if not already imported (check the import at lines 24-35; it likely is not — add it to the `exerciseLibrary` import block). Then update the map:
>    ```typescript
>    // Convert coded messages to display strings
>    const eaSuffix = isPerSideExercise(exId) ? ` (${t("log.each")})` : "";
>    const messages: string[] = rawMsgs.map((msg) => {
>      const [type, val] = msg.split(":");
>      const num = Number(val);
>      if (type === "heaviest") return t("log.newHeaviest", { weight: formatWeight(wu.toDisplay(num)) + eaSuffix });
>      return t("log.newE1rm", { weight: formatWeight(wu.toDisplay(num)) + eaSuffix });
>    });
>    ```
>
> 5. Append `(ea)` to PR banners in the `editSet` path — `app/(tabs)/log.tsx`
>    - Find the second PR banner construction block at lines 1137-1143:
>    ```typescript
>    // Show banner if forward check found a new PR
>    const messages: string[] = rawMsgs.map((msg) => {
>      const [type, val] = msg.split(":");
>      const num = Number(val);
>      if (type === "heaviest") return t("log.newHeaviest", { weight: formatWeight(wu.toDisplay(num)) });
>      return t("log.newE1rm", { weight: formatWeight(wu.toDisplay(num)) });
>    });
>    ```
>    - Apply the same `eaSuffix` pattern:
>    ```typescript
>    // Show banner if forward check found a new PR
>    const eaSuffix = isPerSideExercise(exId) ? ` (${t("log.each")})` : "";
>    const messages: string[] = rawMsgs.map((msg) => {
>      const [type, val] = msg.split(":");
>      const num = Number(val);
>      if (type === "heaviest") return t("log.newHeaviest", { weight: formatWeight(wu.toDisplay(num)) + eaSuffix });
>      return t("log.newE1rm", { weight: formatWeight(wu.toDisplay(num)) + eaSuffix });
>    });
>    ```
>
> 6. Add `isPerSideExercise` to the import in `log.tsx` if missing — `app/(tabs)/log.tsx`
>    - Find the exerciseLibrary import block at lines 24-35:
>    ```typescript
>    import {
>      displayNameFor,
>      defaultIncrementFor,
>      tagsFor,
>      alternativesFor,
>      getExercise,
>      createCustomExercise,
>      type ExerciseTag,
>      type Equipment,
>      isBodyweight,
>      bodyweightFactorFor,
>    } from "../../src/exerciseLibrary";
>    ```
>    - Add `isPerSideExercise,` to this import list.
>
> **Mønster å følge:**
> - Se `src/components/workout/ExerciseCard.tsx` linje 465 for eksisterende bruk av `isPerSideExercise(exId)` i `suffix`-prop — samme import, samme kall.
> - Se `src/components/workout/SetEntryRow.tsx` linje 43-50 for `bwInfo`-mønsteret (conditional inline under vektvisning) — `isPerSide`-tillegget følger samme struktur.
> - Se `app/(tabs)/log.tsx` linje 1014-1027 (addSet) og 1137-1150 (editSet) — begge `rawMsgs.map()` blokker er identiske og skal endres på nøyaktig samme måte.
>
> **Viktig:**
> - Ingen nye i18n-nøkler i denne tasken. `EXPECTED_MIN_KEYS` forblir på verdien Task 3 satte (590). Ikke endre den.
> - Sjekk at `t` er tilgjengelig i `SetEntryRow` — den er allerede der via `const { t } = useI18n();` på linje 5. Bekreft dette ved å lese linje 5 i filen.
> - Det er nøyaktig to PR-banner-konstruksjonsblokker i `log.tsx` (grep på `rawMsgs.map`). Begge må oppdateres.
> - `s.exercise_id` i `SetEntryRow` kan være `null` for eldre sett — `s.exercise_id && isPerSideExercise(s.exercise_id)` er riktig guard (sjekk truthy first).
> - Ingen `elevation` på noen elementer.
> - Task 1 MÅ være merged: `isPerSideExercise()` for egendefinerte øvelser fungerer kun etter at `is_per_side`-kolonnen og `rowToExerciseDef()`-oppdateringen er på plass.
>
> Kjør `npx tsc --noEmit && npx jest` når du er ferdig."
