// src/units.ts — Weight unit conversion + hook
import React, { useState, useEffect } from "react";
import * as Localization from "expo-localization";
import { getSettingAsync, setSettingAsync } from "./db";

export type WeightUnit = "kg" | "lbs";

const KG_TO_LBS = 2.20462;

// ── Conversion functions ──

/** Convert kg to display value in the given unit, rounded to 1 decimal */
export function toDisplay(kg: number, unit: WeightUnit): number {
  if (unit === "lbs") return Math.round(kg * KG_TO_LBS * 10) / 10;
  return Math.round(kg * 10) / 10;
}

/** Convert a value in the given unit back to kg for storage */
export function toKg(value: number, unit: WeightUnit): number {
  if (unit === "lbs") return Math.round((value / KG_TO_LBS) * 100) / 100;
  return value;
}

/** Format a kg value with unit suffix, e.g. "80 kg" or "176.4 lbs" */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const v = toDisplay(kg, unit);
  return `${v} ${unit}`;
}

/** Short suffix label for input fields */
export function unitLabel(unit: WeightUnit): string {
  return unit === "lbs" ? "LBS" : "KG";
}

// ── Reactive state (listener pattern, same as theme.ts / i18n.ts) ──

let currentUnit: WeightUnit = "kg";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

export function getWeightUnit(): WeightUnit {
  return currentUnit;
}

export function setWeightUnit(unit: WeightUnit) {
  if (unit === currentUnit) return;
  currentUnit = unit;
  setSettingAsync("weightUnit", unit).catch(() => {});
  notify();
}

// Countries that primarily use imperial units for body weight
const IMPERIAL_REGIONS = ["US", "LR", "MM", "GB", "UK"];

export async function loadWeightUnit() {
  try {
    const saved = await getSettingAsync("weightUnit");
    if (saved === "kg" || saved === "lbs") {
      currentUnit = saved;
      return;
    }
    // No saved setting - detect from device region
    const deviceLocale = Localization.getLocales()[0];
    const regionCode = deviceLocale?.regionCode ?? "";
    currentUnit = IMPERIAL_REGIONS.includes(regionCode) ? "lbs" : "kg";
    // Save the detected default so it persists
    await setSettingAsync("weightUnit", currentUnit);
  } catch {
    currentUnit = "kg";
  }
}

// ── React hook ──

export function useWeightUnit() {
  const [unit, setUnit] = useState<WeightUnit>(currentUnit);

  useEffect(() => {
    const cb = () => setUnit(currentUnit);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  return {
    unit,
    setUnit: setWeightUnit,
    toDisplay: (kg: number) => toDisplay(kg, unit),
    toKg: (value: number) => toKg(value, unit),
    formatWeight: (kg: number) => formatWeight(kg, unit),
    unitLabel: () => unitLabel(unit),
  };
}
