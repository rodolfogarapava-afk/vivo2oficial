import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "vivo-panel-phones";

const digits = (s: string) => (s || "").replace(/\D/g, "");

const readCache = (): Set<string> | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.phones)) return null;
    return new Set(data.phones.filter((p: unknown) => typeof p === "string"));
  } catch {
    return null;
  }
};

/**
 * Phone numbers (digits only) of lines present in the Vivo Gestão panel.
 * Returns null while unknown (never fetched) — callers should treat null as "show everything".
 */
export const usePanelPhones = () => {
  const [panelPhones, setPanelPhones] = useState<Set<string> | null>(() => readCache());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("vivo-gestao", {
          body: { action: "sync" },
        });
        if (error || !data?.lines) return;
        const phones = (data.lines as { phone?: string }[])
          .map((l) => digits(l.phone || ""))
          .filter((p) => p.length >= 10);
        if (cancelled || phones.length === 0) return;
        localStorage.setItem(CACHE_KEY, JSON.stringify({ phones, ts: Date.now() }));
        setPanelPhones(new Set(phones));
      } catch {
        // keep cached value
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isInPanel = (phone: string): boolean | null => {
    if (!panelPhones) return null;
    const d = digits(phone);
    if (d.length < 10) return null;
    return panelPhones.has(d);
  };

  return { panelPhones, isInPanel };
};
