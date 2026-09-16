import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PanelName {
  user_id: string;
  label: string;
}

export interface LinkedPanel {
  userId: string;
  label: string;
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
        supabase.from("panel_names").select("user_id, label"),
        supabase.from("panel_links").select("owner_user_id, partner_user_id, partner_label"),
      ]);

      const nameList = (names ?? []) as PanelName[];
      setAllNames(nameList);

      const labelFor = (id: string, fallback: string) =>
        nameList.find((n) => n.user_id === id)?.label ?? fallback;

      const mine = nameList.find((n) => n.user_id === userId)?.label ?? null;
      setMyLabel(mine);

      const linkedIds = new Map<string, string>();
      for (const link of links ?? []) {
        if (link.owner_user_id === userId) {
          linkedIds.set(link.partner_user_id, labelFor(link.partner_user_id, link.partner_label ?? DEFAULT_PARTNER_LABEL));
        } else if (link.partner_user_id === userId) {
          linkedIds.set(link.owner_user_id, labelFor(link.owner_user_id, "PAINEL PRINCIPAL"));
        }
      }

      const nextOthers = Array.from(linkedIds.entries()).map(([id, label]) => ({ userId: id, label }));
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

  // Label shown on the panel button: the other panel's name
  const otherPanelLabel = others.length > 1 ? "REVENDAS" : (others[0]?.label ?? DEFAULT_PARTNER_LABEL);

  return { myLabel, others, allNames, otherPanelLabel, loading, reload: load, saveLabel };
};
