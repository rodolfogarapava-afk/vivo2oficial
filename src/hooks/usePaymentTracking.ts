import { useState, useCallback, useMemo, useEffect } from "react";
import { Client } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { ALL_DUE_DAYS } from "@/lib/dueDays";
import { useToast } from "@/hooks/use-toast";

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// Local storage key for optimistic updates / offline fallback
const LOCAL_STORAGE_KEY = "payment_tracking_fallback";

interface LocalPaymentData {
  month: string;
  paidClientIds: string[];
}

const getLocalPayments = (): string[] => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const data: LocalPaymentData = JSON.parse(stored);
      if (data.month === getCurrentMonth()) {
        return data.paidClientIds;
      }
    }
  } catch {
    // ignore
  }
  return [];
};

const saveLocalPayments = (ids: string[]) => {
  const data: LocalPaymentData = {
    month: getCurrentMonth(),
    paidClientIds: ids,
  };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
};

export const usePaymentTracking = (clients: Client[], fixedExpense: number, userId?: string) => {
  const [paidClientIds, setPaidClientIds] = useState<string[]>(() => getLocalPayments());
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch paid clients from DB on mount and when userId changes
  useEffect(() => {
    if (!userId) {
      setPaidClientIds([]);
      return;
    }

    const fetchPayments = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("client_payments")
          .select("client_id")
          .eq("user_id", userId)
          .eq("month", getCurrentMonth())
          .eq("paid", true);

        if (error) {
          console.error("Error fetching payments:", error);
          // fallback to local
          setPaidClientIds(getLocalPayments());
        } else {
          const ids = (data || []).map((r) => r.client_id);
          setPaidClientIds(ids);
          saveLocalPayments(ids);
        }
      } catch (err) {
        console.error("Exception fetching payments:", err);
        setPaidClientIds(getLocalPayments());
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayments();
  }, [userId]);

  const togglePayment = useCallback(
    async (clientId: string) => {
      if (!userId) return;

      const currentMonth = getCurrentMonth();
      const isPaid = paidClientIds.includes(clientId);

      // Optimistic update
      const newIds = isPaid
        ? paidClientIds.filter((id) => id !== clientId)
        : [...paidClientIds, clientId];
      setPaidClientIds(newIds);
      saveLocalPayments(newIds);

      // Keep the value charged today, so past months stay correct if the price changes
      const client = clients.find((c) => c.id === clientId);
      const amount = client ? Number(client.value_paid) : null;

      try {
        if (isPaid) {
          const { error } = await supabase
            .from("client_payments")
            .delete()
            .eq("user_id", userId)
            .eq("client_id", clientId)
            .eq("month", currentMonth);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("client_payments")
            .upsert(
              {
                user_id: userId,
                client_id: clientId,
                month: currentMonth,
                paid: true,
                amount,
                paid_at: new Date().toISOString(),
              },
              { onConflict: "user_id,client_id,month" }
            );

          if (error) throw error;
        }
      } catch (err) {
        console.error("Error toggling payment:", err);
        // Revert on failure
        setPaidClientIds(paidClientIds);
        saveLocalPayments(paidClientIds);
        toast({
          title: "Não foi possível salvar",
          description: isPaid
            ? "A marcação de pagamento não foi removida."
            : "O pagamento não foi registrado. Tente de novo.",
          variant: "destructive",
        });
      }
    },
    [userId, paidClientIds, clients, toast]
  );

  const isClientPaid = useCallback(
    (clientId: string) => paidClientIds.includes(clientId),
    [paidClientIds]
  );

  // Calculate totals / remaining expenses by due day
  const { totalsByDay, remainingByDay } = useMemo(() => {
    const active = clients.filter(c => !c.name.toUpperCase().includes("CANCELADO") && !c.bonus);
    const totals: Record<number, number> = {};
    const remaining: Record<number, number> = {};

    ALL_DUE_DAYS.forEach((day) => {
      const dayClients = active.filter((c) => (c.due_day || 10) === day);
      const total = dayClients.length * fixedExpense;
      const paidCount = dayClients.filter((c) => paidClientIds.includes(c.id)).length;
      totals[day] = total;
      remaining[day] = total - paidCount * fixedExpense;
    });

    return { totalsByDay: totals, remainingByDay: remaining };
  }, [clients, paidClientIds, fixedExpense]);

  return {
    paidClientIds,
    togglePayment,
    isClientPaid,
    totalsByDay,
    remainingByDay,
    isLoading,
  };
};
