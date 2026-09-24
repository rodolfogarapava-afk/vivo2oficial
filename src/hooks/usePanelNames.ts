import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PanelName {
  user_id: string;
  label: string;
  support_whatsapp: string | null;
  reseller_whatsapp: string | null;
  fixed_expense: number;
  line_costs: number[];
}

export interface LinkedPanel {
  userId: string;
  label: string;
  supportWhatsapp: string | null;
  resellerWhatsapp: string | null;
  fixedExpense: number;
  lineCosts: number[];
}

const CACHE_KEY = "panel-names-cache";

const readCache = (): { myLabel: string | null; others: LinkedPanel[] } => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { myLabel: null, others: [] };
};

export const DEFAULT_PARTNER_LABEL = "CHIP NET";

export const usePanelNames = (userId?: string) => {
  const cached = readCache();
  const [myLabel, setMyLabel] = useState<string | null>(cached.myLabel);
  const [others, setOthers] = useState<LinkedPanel[]>(cached.others);
  const [allNames, setAllNames] = useState<PanelName[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [{ data: names }, { data: links }] = await Promise.all([
        supabase.from("panel_names").select("user_id, label, support_whatsapp, reseller_whatsapp, fixed_expense, line_costs"),
        supabase.from("panel_links").select("owner_user_id, partner_user_id, partner_label"),
      ]);

      const nameList = (names ?? []) as PanelName[];
      setAllNames(nameList);

      const labelFor = (id: string, fallback: string) =>
        nameList.find((n) => n.user_id === id)?.label ?? fallback;

      const mine = nameList.find((n) => n.user_id === userId)?.label ?? null;
      setMyLabel(mine);

      const linkedIds = new Map<string, LinkedPanel>();
      for (const link of links ?? []) {
        if (link.owner_user_id === userId) {
          linkedIds.set(link.partner_user_id, {
            userId: link.partner_user_id,
            label: labelFor(link.partner_user_id, link.partner_label ?? DEFAULT_PARTNER_LABEL),
            supportWhatsapp: nameList.find((name) => name.user_id === link.partner_user_id)?.support_whatsapp ?? null,
            resellerWhatsapp: nameList.find((name) => name.user_id === link.partner_user_id)?.reseller_whatsapp ?? null,
            fixedExpense: Number(nameList.find((name) => name.user_id === link.partner_user_id)?.fixed_expense ?? 0),
            lineCosts: nameList.find((name) => name.user_id === link.partner_user_id)?.line_costs ?? [],
          });
        } else if (link.partner_user_id === userId) {
          linkedIds.set(link.owner_user_id, {
            userId: link.owner_user_id,
            label: labelFor(link.owner_user_id, "PAINEL PRINCIPAL"),
            supportWhatsapp: nameList.find((name) => name.user_id === userId)?.support_whatsapp ?? null,
            resellerWhatsapp: nameList.find((name) => name.user_id === userId)?.reseller_whatsapp ?? null,
            fixedExpense: Number(nameList.find((name) => name.user_id === userId)?.fixed_expense ?? 0),
            lineCosts: nameList.find((name) => name.user_id === userId)?.line_costs ?? [],
          });
        }
      }

      const nextOthers = Array.from(linkedIds.values());
      setOthers(nextOthers);

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ myLabel: mine, others: nextOthers }));
      } catch {
        // ignore
      }
    } catch (error) {
      console.error("Erro ao carregar nomes dos painéis:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveLabel = useCallback(
    async (targetUserId: string, label: string) => {
      const clean = label.trim().slice(0, 40);
      if (!clean) throw new Error("Informe um nome");
      const { error } = await supabase
        .from("panel_names")
        .upsert({ user_id: targetUserId, label: clean }, { onConflict: "user_id" });
      if (error) throw error;
      await load();
    },
    [load],
  );

  const saveSupportWhatsapp = useCallback(
    async (targetUserId: string, whatsapp: string) => {
      const digits = whatsapp.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 13) throw new Error("Informe um WhatsApp válido");
      const existing = allNames.find((name) => name.user_id === targetUserId);
      const { error } = await supabase.from("panel_names").upsert(
        {
          user_id: targetUserId,
          label: existing?.label ?? DEFAULT_PARTNER_LABEL,
          support_whatsapp: digits,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      await load();
    },
    [allNames, load],
  );

  const savePanelCosts = useCallback(
    async (targetUserId: string, fixedExpense: number, lineCosts: number[]) => {
      const existing = allNames.find((name) => name.user_id === targetUserId);
      const cleanCosts = Array.from(new Set(lineCosts.filter((value) => Number.isFinite(value) && value >= 0))).sort((a, b) => a - b);
      const { error } = await supabase.from("panel_names").upsert(
        {
          user_id: targetUserId,
          label: existing?.label ?? DEFAULT_PARTNER_LABEL,
          fixed_expense: Math.max(0, fixedExpense),
          line_costs: cleanCosts,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      await load();
    },
    [allNames, load],
  );

  // Label shown on the panel button: the other panel's name
  const otherPanelLabel = others.length > 1 ? "REVENDAS" : (others[0]?.label ?? DEFAULT_PARTNER_LABEL);

  const mySupportWhatsapp = allNames.find((name) => name.user_id === userId)?.support_whatsapp ?? null;

  return { myLabel, mySupportWhatsapp, others, allNames, otherPanelLabel, loading, reload: load, saveLabel, saveSupportWhatsapp, savePanelCosts };
};
