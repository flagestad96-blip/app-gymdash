# Aurora Redesign — Migration

The app is moving from a drawer-nav, purple/orange, light+dark hybrid to a
dark-only aurora aesthetic with a bottom-tab + FAB nav and a tighter 10-screen
IA driven by `Gymdash test/Gymdash.html`.

This doc tracks the audit and the edits. It is the "what / why / how" for the
redesign branch.

---

## Target IA (from the prototype)

- **Onboarding** (3 steps, already ported)
- **Home** (workout-first dashboard; today's session hero)
- **Stats** (consolidates volume trend, PRs, body measurements — absorbs the old `body` tab)
- **Library** (exercise library — surfaced from Home or Profile, not a nav tab)
- **Exercise detail** (opens from Library or from an in-workout exercise row)
- **Workout** (live logging: large rep/weight adjusters, animated rest ring, auto-advance)
- **Summary** (post-workout, non-skippable; PRs + RPE capture)
- **Log** (calendar view — days color-coded by session type)
- **Profile** (identity + settings; replaces `settings.tsx`)
- **Nutrition** (entered from Profile or Home's discovery slot)

**Bottom nav**: Home · Stats · ➕ Start (FAB) · Log · You. The drawer goes away
entirely.

---

## Files deleted

| File | Why |
|------|-----|
| `app/(tabs)/achievements.tsx` (26KB) | Not in prototype. Achievements UI is gone; the DB table can stay for later. |
| `app/(tabs)/body.tsx` (15KB) | Merged into Stats. |
| `app/(tabs)/history.tsx` (21KB) | Absorbed by Log (calendar) + Summary. |
| `app/(tabs)/program.tsx` (77KB) | Not a tab. Program selection/edit lives inside Profile; seeded templates are still created by `programStore.ensurePrograms()`. |
| `components/OnboardingModal.tsx` | Replaced by the full-screen aurora `app/onboarding.tsx`. |
| `src/i18n/**/achievements.ts` | Dead keys. |
| `src/i18n/**/body.ts` | Dead keys. |
| `src/i18n/**/history.ts` | Dead keys. |
| `src/i18n/**/program.ts` | Dead keys. |
| `src/__tests__/bodyweight.test.ts` | Tested the deleted body tab's helper. Replaced with a Stats-layer test later. |
| `onboarding.welcome.*` legacy keys in `onboarding.ts` (the `.title/.body` set for the old modal) | Dead. |

## Files rewritten

| File | Why |
|------|-----|
| `app/_layout.tsx` | Drawer → Stack. Splash still runs; onboarding gate still redirects; `FloatingRestTimer` still mounted globally. |
| `app/(tabs)/_layout.tsx` | Expo-Router Tabs with a custom aurora glass bar + center FAB that always routes to `/log` (today's workout). |
| `app/(tabs)/index.tsx` | Workout-first Home. Today's session hero stays; the drawer menu trigger is removed. Bottom nav replaces the drawer. |
| `app/(tabs)/settings.tsx` → `app/(tabs)/profile.tsx` | Profile is the new "You" tab. Groups: **Account · Units · Notifications · Connected · Library · Nutrition**. All other former-settings cards are kept inside Account or removed. |
| `src/theme.ts` | Dark only. Light mode removed. `ThemeMode`, `setThemeMode`, `getThemeMode`, system-scheme listeners, Appearance subscriptions → deleted. Palette + glass intensity stay (they're part of the aurora DNA). |

## Files added

| File | Purpose |
|------|---------|
| `app/(tabs)/stats.tsx` | Unified Stats screen (volume trend, PRs, body measurements). |
| `app/(tabs)/summary.tsx` | Post-workout summary. Non-skippable from Workout. |
| `app/(tabs)/library.tsx` | Exercise library grid/list. |
| `app/(tabs)/exercise-detail.tsx` | Exercise detail (history, muscle map, notes). |
| `app/(tabs)/nutrition.tsx` | Nutrition home (macro ring + entries; stub for v1). |
| `src/ui/GlassCard.tsx` | Canonical glass primitive (was exported as `GlassCard` from `modern.tsx`; promoted to its own file and consumed everywhere). |

## Routes dropped

- `/achievements` — gone
- `/body` — gone (its content surfaces inside `/stats`)
- `/history` — gone (absorbed by `/log`)
- `/program` as a top-level tab — gone (accessible via Profile → Library → Program)
- Drawer navigation entirely

## Data model changes

None required. All deleted features' DB tables are left intact (non-destructive)
so returning user data is preserved. Specifically:

- `achievement_*` tables: untouched; the UI is gone but records remain.
- `body_measurements`: still written by Stats's body section; old body tab just
  no longer exists.
- `workouts`, `sets`, `prs`, `exercises`: unchanged.

New settings keys introduced by the aurora redesign (already present from prior
onboarding work):

- `onboarding_completed`, `user_goals`, `user_training_days`
- `theme_palette`, `theme_glass_intensity`

Settings keys removed:

- `themeMode` — no longer read; the app is dark only.

## Product decisions made

1. **Program selection** lives inside Profile, not a top-level tab. The seeded
   templates still exist and the back-friendly variant is still selectable,
   but it's an accessory feature, not a navigation peer.
2. **Achievements** was removed UI-wise because it was low-signal in the old
   app and not represented in the prototype. DB is preserved; the feature can
   return later without a migration.
3. **Gym locations** stays — it's recent, useful, and mentioned in CLAUDE.md
   as an ongoing initiative. Lives in Profile.
4. **Calendar was a tab, now it IS the Log tab**. The old list-based "history"
   is gone; days you've trained are color-coded on the calendar.
5. **FAB always goes to `/log`** (live workout). If there's no active workout
   it starts today's planned one; if it's a rest day it starts blank.
6. **Theme toggle is deleted.** One aesthetic. The palette (aurora/violet/
   emerald/sunset) and glass intensity remain as personalization levers.
7. **`OnboardingModal.tsx`** (the old multi-slide welcome) is removed in
   favor of the aurora onboarding flow at `app/onboarding.tsx`.

## Known follow-ups (not in this pass)

- `log.tsx` (78KB) keeps its structure but picks up the aurora look from the
  theme layer. A true "prototype-matching" workout screen (large rep/weight
  adjusters, animated rest ring, auto-advance between sets) is a dedicated
  follow-up; the plumbing is there in `modern.tsx` (`ProgressRing`,
  `GradientButton`, `Mono`).
- `analysis.tsx` was renamed to `stats.tsx` and wired as the Stats tab. A
  consolidated design pass to merge in Body measurements is the next step.
- `Library`, `Exercise detail`, `Nutrition` ship as aurora-styled stubs in
  this pass. Content is a follow-up.

---

## How to exercise the redesign

1. Fresh install → onboarding flow (3 steps, serif hero, goals, days).
2. Finish → Home loads with "Your focus" pill + workout-first hero.
3. Tap the center FAB → `/log`.
4. (Follow-up) Finish a workout → `/summary` is pushed, celebrates PRs.
5. Bottom nav Home · Stats · + · Log · You.
6. Profile → Appearance: palette + glass intensity live-swap.
7. Profile → Replay onboarding: returns to the aurora welcome flow.
