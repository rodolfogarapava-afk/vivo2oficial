import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  // Load the saved value from the cloud so it survives cache/history cleanup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) return;
        const { data } = await supabase
          .from("profiles")
          .select("fixed_expense")
          .eq("user_id", userId)
          .maybeSingle();
        const remote = data?.fixed_expense;
        if (cancelled || remote === null || remote === undefined) return;
        const value = Number(remote);
        if (!Number.isFinite(value) || value < 0) return;
        localStorage.setItem(STORAGE_KEY, String(value));
        setFixedExpenseState(value);
        window.dispatchEvent(new Event(EVENT_NAME));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setFixedExpense = useCallback((value: number) => {
    const v = Number.isFinite(value) && value >= 0 ? value : DEFAULT_VALUE;
    localStorage.setItem(STORAGE_KEY, String(v));
    setFixedExpenseState(v);
    window.dispatchEvent(new Event(EVENT_NAME));
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) return;
        await supabase.from("profiles").update({ fixed_expense: v }).eq("user_id", userId);
      } catch {}
    })();
  }, []);

  return { fixedExpense, setFixedExpense };
};
