import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Client } from "@/hooks/useClients";

export interface ReportEntry {
  id: string;
  name: string;
  phone: string;
  value: number;
  dueDay: number;
}

export interface HistoryPoint {
  key: string;
  label: string;
  total: number;
}

interface PaymentRow {
  client_id: string;
  month: string;
  amount: number | null;
}

const HISTORY_MONTHS = 6;

export const monthKeyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const currentMonthKey = () => monthKeyOf(new Date());

export const shiftMonthKey = (key: string, delta: number) => {
  const [year, month] = key.split("-").map(Number);
  return monthKeyOf(new Date(year, month - 1 + delta, 1));
};

export const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const shortMonthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short" });
  return label.replace(".", "").charAt(0).toUpperCase() + label.replace(".", "").slice(1);
};

const monthsWindow = (key: string) =>
  Array.from({ length: HISTORY_MONTHS }, (_, i) => shiftMonthKey(key, -(HISTORY_MONTHS - 1 - i)));

export const useMonthlyReport = (
  clients: Client[],
  fixedExpense: number,
  userId?: string
) => {
  const [monthKey, setMonthKey] = useState<string>(() => currentMonthKey());
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setRows([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_payments")
        .select("client_id, month, amount")
        .eq("user_id", userId)
        .eq("paid", true)
        .in("month", monthsWindow(monthKey));
      if (error) throw error;
      setRows((data ?? []) as PaymentRow[]);
    } catch (err) {
      console.error("Erro ao carregar o relatório:", err);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, monthKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const report = useMemo(() => {
    const byId = new Map(clients.map((c) => [c.id, c]));
    const valueOf = (row: PaymentRow) => {
      if (row.amount !== null && row.amount !== undefined) return Number(row.amount);
      const client = byId.get(row.client_id);
      return client ? Number(client.value_paid) : 0;
    };

    const active = clients.filter((c) => !c.name.toUpperCase().includes("CANCELADO"));
    const billable = active.filter((c) => !c.bonus);
    const expected = billable.reduce((sum, c) => sum + Number(c.value_paid), 0);

    const monthRows = rows.filter((r) => r.month === monthKey);
    const paidIds = new Set(monthRows.map((r) => r.client_id));
    const received = monthRows.reduce((sum, r) => sum + valueOf(r), 0);

    const entryOf = (client: Client): ReportEntry => ({
      id: client.id,
      name: client.name,
      phone: client.phone,
      value: Number(client.value_paid),
      dueDay: client.due_day || 10,
    });

    const paidList = billable
      .filter((c) => paidIds.has(c.id))
      .map(entryOf)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const owedList = billable
      .filter((c) => !paidIds.has(c.id))
      .map(entryOf)
      .sort(
        (a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name, "pt-BR")
      );

    const expenses = billable.length * fixedExpense;
    const history: HistoryPoint[] = monthsWindow(monthKey).map((key) => ({
      key,
      label: shortMonthLabel(key),
      total: rows
        .filter((r) => r.month === key)
        .reduce((sum, r) => sum + valueOf(r), 0),
    }));

    return {
      expected,
      received,
      pending: Math.max(expected - received, 0),
      expenses,
      profit: received - expenses,
      paidList,
      owedList,
      history,
      billableCount: billable.length,
    };
  }, [clients, rows, monthKey, fixedExpense]);

  const isCurrentMonth = monthKey === currentMonthKey();

  return {
    monthKey,
    setMonthKey,
    report,
    isLoading,
    reload,
    isCurrentMonth,
    goPrevious: () => setMonthKey((prev) => shiftMonthKey(prev, -1)),
    goNext: () => setMonthKey((prev) => (prev >= currentMonthKey() ? prev : shiftMonthKey(prev, 1))),
    goToday: () => setMonthKey(currentMonthKey()),
  };
};
