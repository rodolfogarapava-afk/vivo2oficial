import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "fixed_expense_value";
const DEFAULT_VALUE = 60;
const EVENT_NAME = "fixed-expense-updated";

const readStored = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch {}
  return DEFAULT_VALUE;
};

export const useFixedExpense = () => {
  const [fixedExpense, setFixedExpenseState] = useState<number>(() => readStored());

  useEffect(() => {
    const handler = () => setFixedExpenseState(readStored());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setFixedExpense = useCallback((value: number) => {
    const v = Number.isFinite(value) && value >= 0 ? value : DEFAULT_VALUE;
    localStorage.setItem(STORAGE_KEY, String(v));
    setFixedExpenseState(v);
    window.dispatchEvent(new Event(EVENT_NAME));
  }, []);

  return { fixedExpense, setFixedExpense };
};
