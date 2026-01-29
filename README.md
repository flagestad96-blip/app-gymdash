# Gymdash

Gymdash is an offline-first gym logging app built with Expo and React Native. It focuses on fast logging from a fixed weekly program, simple rest timers, and lightweight progress analysis stored locally in SQLite.

## Features
- Workout log with 5-day programs (standard or back-friendly mode)
- Day selection, live workout timer, and rest timer with optional vibration
- Superset logging with automatic A/B alternation
- Weight suggestions based on last performance and default increments
- Analysis charts per exercise and overall strength trend (Epley 1RM)
- Settings for program mode, back status, default day, rest timer, and supersets
- All data stored locally in SQLite (workouts, sets, settings, programs)

## Tech stack
- Expo + React Native (TypeScript)
- expo-router for tab navigation
- expo-sqlite for local storage
- react-native-svg for charts

## Project structure
- `app/_layout.tsx`: root layout, initializes the database
- `app/(tabs)/index.tsx`: Logg (workout logging)
- `app/(tabs)/program.tsx`: Program overview and active day selection
- `app/(tabs)/analysis.tsx`: Progress charts and workout duration stats
- `app/(tabs)/settings.tsx`: App preferences and tools
- `src/db.ts`: SQLite setup, schema, and settings helpers
- `src/programStore.ts`: Program seeding and lookup
- `src/exerciseLibrary.ts`: Exercise definitions and defaults
- `src/theme.ts`: App theme tokens
- `src/metrics.ts`: E1RM and suggestion helpers
- `src/storage.ts`: small ID/date helpers

## Data model (SQLite)
- `workouts`: id, date, program_mode, day_key, back_status, notes, day_index, started_at
- `sets`: id, workout_id, exercise_name, exercise_id, set_index, weight, reps, rpe, created_at
- `settings`: key, value
- `programs`: id, name, json, created_at

## Getting started
1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npm run start
   ```

Optional platform commands:
- `npm run ios`
- `npm run android`
- `npm run web`

## Notes
- On first launch, the app seeds default programs into SQLite.
- Data is stored locally on the device or browser using `gymdash.db`.
