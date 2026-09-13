import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "accounts_count";
const LABELS_KEY = "accounts_labels";
const EVENT = "accounts-count-updated";
const DEFAULT_COUNT = 4;
const MIN_COUNT = 1;
const MAX_COUNT = 40;

const read = (): number => {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(saved) && saved >= MIN_COUNT && saved <= MAX_COUNT) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_COUNT;
};

const readLabels = (): Record<number, string> => {
  try {
    const saved = localStorage.getItem(LABELS_KEY);
    if (saved) return JSON.parse(saved) as Record<number, string>;
  } catch {
    /* ignore */
  }
  return {};
};

export const useAccounts = () => {
  const [count, setCount] = useState<number>(read);
  const [labels, setLabels] = useState<Record<number, string>>(readLabels);

  useEffect(() => {
    const sync = () => {
      setCount(read());
      setLabels(readLabels());
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const saveCount = useCallback((next: number) => {
    const clamped = Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(next)));
    setCount(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const setLabel = useCallback((account: number, label: string) => {
    setLabels((prev) => {
      const next = { ...prev, [account]: label };
      try {
        localStorage.setItem(LABELS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const increase = useCallback(() => saveCount(read() + 1), [saveCount]);
  const decrease = useCallback(() => saveCount(read() - 1), [saveCount]);

  const accounts = Array.from({ length: count }, (_, i) => i + 1);

  return { count, accounts, labels, setLabel, saveCount, increase, decrease, MIN_COUNT, MAX_COUNT };
};

