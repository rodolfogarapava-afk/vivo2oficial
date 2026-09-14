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

// Creates the account record when it is missing, or updates the saved value
const saveToCloud = async (value: number) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, fixed_expense: value }, { onConflict: "user_id" });
    if (error) console.error("Erro ao salvar o gasto na nuvem:", error.message);
  } catch (err) {
    console.error("Erro ao salvar o gasto na nuvem:", err);
  }
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
        if (cancelled) return;
        const remote = data?.fixed_expense;
        if (remote === null || remote === undefined) {
          // Nothing saved yet (or no record at all): keep this device's value safe in the cloud
          await saveToCloud(readStored());
          return;
        }
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
    void saveToCloud(v);
  }, []);

  return { fixedExpense, setFixedExpense };
};
