# Training Intelligence — Prompt 2 av 4

## Kontekst fra teamet:
- @architect: `docs/architecture/training-intelligence-2026-02-25.md` — Item 1: expose `is_per_side` toggle in ExerciseSwapModal inline create form
- @codebase-scanner: `src/components/modals/ExerciseSwapModal.tsx` — inline create form at lines 198-291; existing tag chips at lines 258-285 show the toggle pattern (Pressable + active boolean state); `handleSaveCustom` at line 87-92 calls `onCreateCustom(baseExId, name, newEquipment, newTags)` — this signature must be extended. `src/i18n/en/common.ts` lines 1-44; `src/i18n/nb/common.ts` lines 1-44; `src/i18n/merge.ts` line 55 `EXPECTED_MIN_KEYS = 586`.
- @task-plan: Task 1 must be merged first (needs `isPerSide` in `createCustomExercise()`).

---

> "Add a per-side toggle to the inline create-exercise form in ExerciseSwapModal and wire it to `createCustomExercise()`.
>
> **Kontekst:** The inline create form in `ExerciseSwapModal` lets users create custom exercises during a workout. After Task 1, `createCustomExercise()` now accepts `isPerSide?: boolean`. This task exposes that flag in the UI so users can mark new custom exercises as unilateral (dumbbell curl per arm, etc.) at creation time.
>
> **Steg:**
>
> 1. Add `newIsPerSide` state to the component — `src/components/modals/ExerciseSwapModal.tsx`
>    - Find the existing state declarations at lines 68-71:
>    ```typescript
>    const [creating, setCreating] = useState(false);
>    const [newName, setNewName] = useState("");
>    const [newEquipment, setNewEquipment] = useState<Equipment>("machine");
>    const [newTags, setNewTags] = useState<ExerciseTag[]>([]);
>    ```
>    - Add one more state variable after `newTags`:
>    ```typescript
>    const [newIsPerSide, setNewIsPerSide] = useState(false);
>    ```
>
> 2. Reset `newIsPerSide` in `resetForm()` — `src/components/modals/ExerciseSwapModal.tsx`
>    - Find `resetForm()` at line 80-85:
>    ```typescript
>    function resetForm() {
>      setCreating(false);
>      setNewName("");
>      setNewEquipment("machine");
>      setNewTags([]);
>    }
>    ```
>    - Add `setNewIsPerSide(false);` before the closing brace:
>    ```typescript
>    function resetForm() {
>      setCreating(false);
>      setNewName("");
>      setNewEquipment("machine");
>      setNewTags([]);
>      setNewIsPerSide(false);
>    }
>    ```
>
> 3. Update `handleSaveCustom()` to pass `isPerSide` — `src/components/modals/ExerciseSwapModal.tsx`
>    - Find `handleSaveCustom` at line 87-92:
>    ```typescript
>    function handleSaveCustom() {
>      const name = newName.trim();
>      if (!name || !baseExId || !onCreateCustom) return;
>      onCreateCustom(baseExId, name, newEquipment, newTags);
>      resetForm();
>    }
>    ```
>    - The `onCreateCustom` prop signature is `(baseExId, name, equipment, tags)`. This prop flows into `log.tsx` which calls `createCustomExercise()`. Update the call to pass `isPerSide`:
>    - First, update the `ExerciseSwapModalProps` type for `onCreateCustom` to include `isPerSide`. Find line 45:
>    ```typescript
>    onCreateCustom?: (baseExId: string, name: string, equipment: Equipment, tags: ExerciseTag[]) => void;
>    ```
>    - Replace with:
>    ```typescript
>    onCreateCustom?: (baseExId: string, name: string, equipment: Equipment, tags: ExerciseTag[], isPerSide: boolean) => void;
>    ```
>    - Then update the call in `handleSaveCustom`:
>    ```typescript
>    function handleSaveCustom() {
>      const name = newName.trim();
>      if (!name || !baseExId || !onCreateCustom) return;
>      onCreateCustom(baseExId, name, newEquipment, newTags, newIsPerSide);
>      resetForm();
>    }
>    ```
>
> 4. Add the per-side toggle row to the create form JSX — `src/components/modals/ExerciseSwapModal.tsx`
>    - Find the tag selector section in the create form (lines 255-285). The create form JSX ends with the Save/Cancel buttons at lines 287-290. Insert the toggle row AFTER the tag chip grid (after the closing `</View>` of the tag options, before the buttons row):
>    ```tsx
>    {/* Per-side toggle */}
>    <Pressable
>      onPress={() => setNewIsPerSide((p) => !p)}
>      style={{
>        flexDirection: "row",
>        alignItems: "center",
>        justifyContent: "space-between",
>        paddingVertical: 8,
>        paddingHorizontal: 4,
>      }}
>    >
>      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
>        {t("common.perSide")}
>      </Text>
>      <View
>        style={{
>          width: 36,
>          height: 20,
>          borderRadius: 10,
>          backgroundColor: newIsPerSide
>            ? theme.accent
>            : theme.glassBorder,
>          justifyContent: "center",
>          paddingHorizontal: 2,
>        }}
>      >
>        <View
>          style={{
>            width: 16,
>            height: 16,
>            borderRadius: 8,
>            backgroundColor: "#FFFFFF",
>            alignSelf: newIsPerSide ? "flex-end" : "flex-start",
>          }}
>        />
>      </View>
>    </Pressable>
>    ```
>    - This follows the same visual pattern as existing toggles in the app (a manual pill toggle without React Native's `Switch`, which can cause theme issues on Android). No `elevation` used.
>
> 5. Update the caller in `log.tsx` to pass `isPerSide` through to `createCustomExercise()` — `app/(tabs)/log.tsx`
>    - Search for `onCreateCustom` in `log.tsx`. It will be a prop passed to `<ExerciseSwapModal>`. Find the handler (likely named something like `handleCreateCustom` or an inline arrow function). Update the signature to accept the new 5th argument and forward it:
>    ```typescript
>    // Before:
>    onCreateCustom={async (baseExId, name, equipment, tags) => {
>      const newId = await createCustomExercise({ displayName: name, equipment, tags, defaultIncrementKg: defaultIncrementFor(baseExId) });
>      // ... rest of handler
>    }}
>
>    // After:
>    onCreateCustom={async (baseExId, name, equipment, tags, isPerSide) => {
>      const newId = await createCustomExercise({ displayName: name, equipment, tags, defaultIncrementKg: defaultIncrementFor(baseExId), isPerSide });
>      // ... rest of handler (unchanged)
>    }}
>    ```
>    - Find the exact location by searching for `createCustomExercise(` in `log.tsx` and updating the call site there.
>
> 6. Add `"common.perSide"` key — `src/i18n/en/common.ts`
>    - Append before the closing `};`:
>    ```typescript
>    "common.perSide": "Per side (unilateral)",
>    ```
>
> 7. Add `"common.perSide"` key — `src/i18n/nb/common.ts`
>    - Append before the closing `};`:
>    ```typescript
>    "common.perSide": "Per side (unilateral)",
>    ```
>    (Norwegian phrasing TBD — use English as placeholder per architect note)
>
> 8. Bump `EXPECTED_MIN_KEYS` — `src/i18n/merge.ts`
>    - Find line 55: `const EXPECTED_MIN_KEYS = 586;`
>    - Change to: `const EXPECTED_MIN_KEYS = 587;`
>
> **Mønster å følge:**
> - Se `src/components/modals/ExerciseSwapModal.tsx` linje 258-285 for hvordan tag-chips bruker `active` boolean state med Pressable (samme `borderColor: active ? theme.accent : theme.glassBorder` mønster).
> - Se `src/components/modals/ExerciseSwapModal.tsx` linje 233-254 for equipment-chip scroll (horisontal list med Pressable) som referanse for tilstand-styrt farge.
>
> **Viktig:**
> - ALDRI bruk `elevation` på glass-elementer (Android-regel fra CONTEXT.md).
> - ALDRI bruk React Native `Switch` — den rendrer feil på mørk bakgrunn. Bruk den manuelle pill-toggle vist over.
> - Task 1 MÅ være merged først — `createCustomExercise()` må ha `isPerSide?: boolean` i signaturen.
> - Oppdater TypeScript-typen `ExerciseSwapModalProps.onCreateCustom` — ellers vil `tsc --noEmit` feile.
> - Sjekk at `log.tsx` sin `onCreateCustom`-handler korrekt mottar og videresender `isPerSide` (det er 2 call sites å finne via grep).
>
> Kjør `npx tsc --noEmit && npx jest` når du er ferdig."
