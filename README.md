# Gymdash

A privacy-focused, offline-first gym tracking app built with Expo and React Native. All data stays on your device — no accounts, no analytics, no network calls.

## Features

- **Workout logging** — sets, weight, reps, RPE, supersets, rest time tracking
- **Program builder** — flexible days, exercise targets, auto-progression, periodization (linear/wave/deload), exercise alternatives and swaps
- **PR tracking** — heaviest set, estimated 1RM, session volume PRs with animated banners
- **Analysis** — e1RM/volume/top-set graphs, muscle balance radar chart, strength standards, exercise comparison mode, rest time statistics
- **History** — full set history with search, exercise/time/weight/type filters, pagination
- **Achievements** — tiered achievement system with unlock notifications
- **Calendar** — color-coded workout dots, day marking (rest/travel/sick)
- **Body tracking** — weight logging with trend chart, progress photos
- **Rest timer** — per-exercise defaults, custom presets, background notifications with countdown
- **Workout templates** — save and load session layouts
- **Exercise notes** — persistent notes per exercise with lightbulb toggle
- **Backup** — full JSON export/import (merge or fresh), CSV export, native share
- **Exercise library** — 183+ built-in exercises with back-impact ratings, plus custom exercises
- **i18n** — Norwegian and English, kg/lbs unit toggle
- **100% offline** — no data leaves the device

## Tech Stack

- [Expo](https://expo.dev) 54, React Native, TypeScript
- [expo-router](https://docs.expo.dev/router) with Drawer navigation
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for local storage
- [react-native-svg](https://github.com/software-mansion/react-native-svg) and [victory-native](https://github.com/FormidableLabs/victory-native) for charts

## Project Structure

```
app/
  _layout.tsx              Root layout, drawer navigation, DB init
  (tabs)/
    log.tsx                Workout logging screen (main screen)
    program.tsx            Program builder and day editor
    analysis.tsx           Charts, stats, muscle balance, rest time
    history.tsx            Searchable set history with filters
    calendar.tsx           Monthly calendar with workout dots
    body.tsx               Body weight and progress photos
    settings.tsx           Preferences, backup, achievements
    index.tsx              Home / dashboard

src/
  db.ts                    SQLite setup, migrations, settings helpers
  programStore.ts          Program CRUD and seeding
  exerciseLibrary.ts       183+ exercises, tags, back impact, search
  prEngine.ts              PR detection (heaviest, e1RM, volume)
  metrics.ts               e1RM calculation, weight suggestions
  backup.ts                JSON/CSV export and import
  exerciseNotes.ts         Exercise notes API
  i18n.ts                  Translations (nb + en)
  theme.ts                 Dark/light theme tokens
  goals.ts                 Exercise goal tracking
  sharing.ts               Workout summary sharing

src/components/
  workout/                 ExerciseCard, SetEntryRow, SummaryCard
  modals/                  PlateCalcModal, ExerciseSwapModal, TemplatePickerModal

src/ui/                    Reusable primitives (Btn, TextField, Card, SegButton, etc.)
```

## Data Model (SQLite)

20 tables managed via versioned migrations:

| Table | Purpose |
|-------|---------|
| `workouts` | Workout sessions with date, program, timing |
| `sets` | Individual sets with weight, reps, RPE, rest time |
| `settings` | Key-value app preferences |
| `programs` | Training programs (JSON structure) |
| `program_days` | Days within a program |
| `program_day_exercises` | Exercises assigned to program days |
| `program_exercise_alternatives` | Alternative exercises per slot |
| `program_replacements` | Active exercise swaps |
| `exercise_targets` | Per-exercise weight/rep targets |
| `pr_records` | Personal records (heaviest, e1RM, volume) |
| `body_metrics` | Body weight entries |
| `achievements` | Achievement definitions |
| `user_achievements` | Unlocked achievements |
| `exercise_goals` | User-defined exercise goals |
| `custom_exercises` | User-created exercises |
| `progression_log` | Auto-progression history |
| `workout_templates` | Saved session templates |
| `day_marks` | Calendar day markers (rest/travel/sick) |
| `exercise_notes` | Persistent exercise notes |
| `schema_migrations` | Migration version tracking |

## Getting Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npm run start
   ```

Platform commands: `npm run ios` | `npm run android` | `npm run web`

## Privacy

Gymdash is fully offline. All workout data, settings, and photos are stored locally on your device in SQLite (`gymdash.db`). There are no user accounts, no cloud sync, no analytics, and no network requests. Your data is yours.
