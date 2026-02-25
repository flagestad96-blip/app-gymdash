# Training Intelligence — Prompt 1 av 4

## Kontekst fra teamet:
- @architect: `docs/architecture/training-intelligence-2026-02-25.md` — Bug A: custom exercises always treated as bilateral because `custom_exercises` has no `is_per_side` column; Bug E5: composite index needed for training status queries
- @db-designer: `docs/architecture/db-migration-2026-02-25.md` — Migration 23 (ALTER TABLE + hasColumn guard), Migration 24 (CREATE INDEX IF NOT EXISTS); no backup schemaVersion bump needed
- @codebase-scanner: `src/db.ts` line 52-59 `hasColumn()` pattern; migration block at lines 402-588; base schema indexes at lines 372-388. `src/exerciseLibrary.ts` lines 1866-1875 `CustomExRow` type; lines 1877-1889 `rowToExerciseDef()`; lines 1913-1940 `createCustomExercise()`; lines 1942-1968 `updateCustomExercise()`. `src/backup.ts` line 90 export SELECT; lines 407-416 import INSERT for `custom_exercises`.

---

> "Add DB migrations 23+24, extend `CustomExRow` with `is_per_side`, and update `backup.ts` to include the new column.
>
> **Kontekst:** The `isPerSideExercise()` function only reads from the hardcoded library (`byId[id]?.isPerSide`). Custom exercises have no `is_per_side` column in `custom_exercises`, so all custom unilateral exercises silently undercount volume by 50%. This task lands the DB foundation all other tasks depend on.
>
> **Steg:**
>
> 1. Add migration 23 to `src/db.ts` — `src/db.ts`
>    - In the `MIGRATIONS` array, append after the `version: 22` block (line 572–587):
>    ```typescript
>    // 23: custom_exercises — is_per_side column
>    { version: 23, up: (d) => {
>      if (!hasColumn("custom_exercises", "is_per_side")) {
>        d.execSync(`ALTER TABLE custom_exercises ADD COLUMN is_per_side INTEGER NOT NULL DEFAULT 0;`);
>      }
>    }},
>    ```
>    - The `hasColumn()` helper is already defined at line 52. Pattern: `db?.getAllSync<{ name: string }>(\`PRAGMA table_info(${table});\`)` — use it exactly as shown.
>
> 2. Add migration 24 to `src/db.ts` — `src/db.ts`
>    - Immediately after migration 23, append:
>    ```typescript
>    // 24: workouts — composite (date, id) covering index for training status queries
>    { version: 24, up: (d) => {
>      d.execSync(`CREATE INDEX IF NOT EXISTS idx_workouts_date_id ON workouts(date, id);`);
>    }},
>    ```
>    - Also add `CREATE INDEX IF NOT EXISTS idx_workouts_date_id ON workouts(date, id);` to the base schema block (inside the big `db.execSync(\`...\`)` at lines 236-388), immediately after the existing `CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);` at line 374. This ensures fresh installs also get the index.
>
> 3. Add `is_per_side` to `CustomExRow` — `src/exerciseLibrary.ts`
>    - Find `type CustomExRow` at line 1866. Currently:
>    ```typescript
>    type CustomExRow = {
>      id: string;
>      display_name: string;
>      equipment: string;
>      tags: string;
>      default_increment_kg: number;
>      is_bodyweight: number;
>      bodyweight_factor: number | null;
>      created_at: string;
>    };
>    ```
>    - Add `is_per_side: number;` before `created_at`:
>    ```typescript
>    type CustomExRow = {
>      id: string;
>      display_name: string;
>      equipment: string;
>      tags: string;
>      default_increment_kg: number;
>      is_bodyweight: number;
>      bodyweight_factor: number | null;
>      is_per_side: number;
>      created_at: string;
>    };
>    ```
>
> 4. Update `rowToExerciseDef()` — `src/exerciseLibrary.ts`
>    - Find `rowToExerciseDef` at line 1877. Currently returns an object without `isPerSide`. Add it:
>    ```typescript
>    function rowToExerciseDef(row: CustomExRow): ExerciseDef {
>      let tags: ExerciseTag[] = [];
>      try { tags = JSON.parse(row.tags || "[]"); } catch {}
>      return {
>        id: row.id,
>        displayName: row.display_name,
>        equipment: row.equipment as Equipment,
>        tags,
>        defaultIncrementKg: row.default_increment_kg,
>        isBodyweight: !!row.is_bodyweight,
>        bodyweightFactor: row.bodyweight_factor ?? undefined,
>        isPerSide: row.is_per_side === 1,
>      };
>    }
>    ```
>
> 5. Update `createCustomExercise()` — `src/exerciseLibrary.ts`
>    - Find `createCustomExercise` at line 1913. Add `isPerSide?: boolean` to the `args` parameter type and include it in the INSERT:
>    ```typescript
>    export async function createCustomExercise(args: {
>      displayName: string;
>      equipment: Equipment;
>      tags: ExerciseTag[];
>      defaultIncrementKg: number;
>      isBodyweight?: boolean;
>      bodyweightFactor?: number;
>      isPerSide?: boolean;
>    }): Promise<string> {
>      const { ensureDb, getDb } = require("./db") as typeof import("./db");
>      await ensureDb();
>      const id = uid("custom");
>      await getDb().runAsync(
>        `INSERT INTO custom_exercises (id, display_name, equipment, tags, default_increment_kg, is_bodyweight, bodyweight_factor, is_per_side, created_at)
>         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
>        [
>          id,
>          args.displayName,
>          args.equipment,
>          JSON.stringify(args.tags),
>          args.defaultIncrementKg,
>          args.isBodyweight ? 1 : 0,
>          args.bodyweightFactor ?? null,
>          args.isPerSide ? 1 : 0,
>          new Date().toISOString(),
>        ]
>      );
>      await loadCustomExercises();
>      return id;
>    }
>    ```
>
> 6. Update `updateCustomExercise()` — `src/exerciseLibrary.ts`
>    - Find `updateCustomExercise` at line 1942. Add `isPerSide?: boolean` to the `args` parameter type and include it in the UPDATE:
>    ```typescript
>    export async function updateCustomExercise(
>      id: string,
>      args: {
>        displayName: string;
>        equipment: Equipment;
>        tags: ExerciseTag[];
>        defaultIncrementKg: number;
>        isBodyweight?: boolean;
>        bodyweightFactor?: number;
>        isPerSide?: boolean;
>      }
>    ): Promise<void> {
>      const { ensureDb, getDb } = require("./db") as typeof import("./db");
>      await ensureDb();
>      await getDb().runAsync(
>        `UPDATE custom_exercises SET display_name=?, equipment=?, tags=?, default_increment_kg=?, is_bodyweight=?, bodyweight_factor=?, is_per_side=? WHERE id=?`,
>        [
>          args.displayName,
>          args.equipment,
>          JSON.stringify(args.tags),
>          args.defaultIncrementKg,
>          args.isBodyweight ? 1 : 0,
>          args.bodyweightFactor ?? null,
>          args.isPerSide ? 1 : 0,
>          id,
>        ]
>      );
>      await loadCustomExercises();
>    }
>    ```
>
> 7. Update `exportFullBackup()` SELECT — `src/backup.ts`
>    - Find the `custom_exercises` SELECT at line 89-91:
>    ```typescript
>    const customExercises = await db.getAllAsync(
>      `SELECT id, display_name, equipment, tags, default_increment_kg, is_bodyweight, bodyweight_factor, created_at FROM custom_exercises`
>    );
>    ```
>    - Replace with:
>    ```typescript
>    const customExercises = await db.getAllAsync(
>      `SELECT id, display_name, equipment, tags, default_increment_kg, is_bodyweight, bodyweight_factor, is_per_side, created_at FROM custom_exercises`
>    );
>    ```
>
> 8. Update `importBackup()` INSERT — `src/backup.ts`
>    - Find the `custom_exercises` INSERT loop at lines 407-417:
>    ```typescript
>    for (const ce of customExercises) {
>      await db.runAsync(
>        `${verb} custom_exercises(id, display_name, equipment, tags, default_increment_kg, is_bodyweight, bodyweight_factor, created_at)
>         VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
>        [
>          ce.id, ce.display_name, ce.equipment, ce.tags,
>          ce.default_increment_kg ?? 2.5, ce.is_bodyweight ?? 0,
>          ce.bodyweight_factor ?? null, ce.created_at,
>        ]
>      );
>    }
>    ```
>    - Replace with (9 columns, `ce.is_per_side ?? 0` handles old backups):
>    ```typescript
>    for (const ce of customExercises) {
>      await db.runAsync(
>        `${verb} custom_exercises(id, display_name, equipment, tags, default_increment_kg, is_bodyweight, bodyweight_factor, is_per_side, created_at)
>         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
>        [
>          ce.id, ce.display_name, ce.equipment, ce.tags,
>          ce.default_increment_kg ?? 2.5, ce.is_bodyweight ?? 0,
>          ce.bodyweight_factor ?? null, ce.is_per_side ?? 0, ce.created_at,
>        ]
>      );
>    }
>    ```
>
> **Mønster å følge:**
> - Se `src/db.ts` linje 491-495 for `hasColumn()` guard-mønster (migration 11 `auto_progress`).
> - Se `src/db.ts` linje 572-587 for hvordan migration 22 er strukturert (siste migrasjonsblokk).
> - Se `src/exerciseLibrary.ts` linje 1877-1889 for `rowToExerciseDef()` — bare legg til én linje.
>
> **Viktig:**
> - ALDRI bruk `elevation` på glass-elementer (Android-regel).
> - `CustomExRow` er en intern type (ikke eksportert). Endringen er trygg.
> - `_loadCustomExercisesFromDb(db)` bruker `SELECT *` — den vil automatisk plukke opp `is_per_side` etter migreringen.
> - Ingen `EXPECTED_MIN_KEYS`-endring i denne tasken (ingen i18n-nøkler).
> - Ikke bump `CURRENT_SCHEMA_VERSION` i `backup.ts` — DB-designdokumentet sier eksplisitt at ingen bump er nødvendig (additivt felt med sikker fallback).
> - Sirkulær import: `exerciseLibrary.ts` bruker allerede `require("./db")` via lazy import. Ikke endre dette mønsteret.
>
> Kjør `npx tsc --noEmit && npx jest` når du er ferdig."
