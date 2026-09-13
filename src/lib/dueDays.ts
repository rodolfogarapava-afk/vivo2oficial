import { useCallback, useEffect, useState } from "react";

export const ALL_DUE_DAYS = [5, 10, 15, 20, 24, 25] as const;
export type DueDay = (typeof ALL_DUE_DAYS)[number];

const STORAGE_KEY = "visible_due_days";
const EVENT = "visible-due-days-updated";

export const getVisibleDueDays = (): number[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((d: number) => (ALL_DUE_DAYS as readonly number[]).includes(d));
        if (valid.length > 0) return valid.sort((a, b) => a - b);
      }
    }
  } catch {
    // ignore
  }
  return [...ALL_DUE_DAYS];
};

export const saveVisibleDueDays = (days: number[]) => {
  const sorted = [...days].sort((a, b) => a - b);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  window.dispatchEvent(new Event(EVENT));
};

export const useVisibleDueDays = () => {
  const [visibleDays, setVisibleDays] = useState<number[]>(() => getVisibleDueDays());

  useEffect(() => {
    const handler = () => setVisibleDays(getVisibleDueDays());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const toggleDay = useCallback((day: number) => {
    const current = getVisibleDueDays();
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    if (next.length === 0) return; // keep at least one visible
    saveVisibleDueDays(next);
  }, []);

  return { visibleDays, toggleDay };
};
