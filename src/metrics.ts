export function e1rmEpley(weight: number, reps: number) {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export function epley1RM(weight: number, reps: number) {
  const r = Math.max(1, reps);
  return weight * (1 + r / 30);
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function suggestNextWeight(args: {
  lastWeight: number;
  lastReps: number;
  targetRepMin: number;
  targetRepMax: number;
  lastRpe?: number | null;
  incrementKg?: number; // default 2.5
}) {
  const inc = args.incrementKg ?? 2.5;

  // Hvis RPE er høy (>=9), foreslå samme vekt eller litt ned
  if (args.lastRpe != null && args.lastRpe >= 9) return args.lastWeight;

  // Hvis du traff øvre del av rep-range, foreslå +2.5 kg
  if (args.lastReps >= args.targetRepMax) return args.lastWeight + inc;

  // Hvis du var under rep-range, foreslå samme eller litt ned
  if (args.lastReps < args.targetRepMin) return Math.max(0, args.lastWeight - inc);

  // Ellers: hold samme vekt
  return args.lastWeight;
}
