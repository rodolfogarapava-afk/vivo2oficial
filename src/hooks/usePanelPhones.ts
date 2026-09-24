import { useCallback, useEffect, useRef, useState } from "react";
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
  const loadingRef = useRef(false);

  const refreshPanel = useCallback(async () => {
    if (!navigator.onLine || loadingRef.current) return false;
    loadingRef.current = true;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return false;
      const { data, error } = await supabase.functions.invoke("vivo-gestao", {
        body: { action: "auto_sync" },
      });
      if (error || !data?.lines) return false;
      const phones = (data.lines as { phone?: string }[])
        .map((line) => digits(line.phone || ""))
        .filter((phone) => phone.length >= 10);
      if (phones.length === 0) return false;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ phones, ts: Date.now() }));
      setPanelPhones(new Set(phones));
      window.dispatchEvent(new CustomEvent("vivo-panel-synced", { detail: data.sync ?? null }));
      return true;
    } catch {
      return false;
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refreshPanel();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshPanel();
    };
    const refreshWhenOnline = () => void refreshPanel();

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refreshWhenOnline);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenOnline);
    };
  }, [refreshPanel]);

  const isInPanel = (phone: string): boolean | null => {
    if (!panelPhones) return null;
    const d = digits(phone);
    if (d.length < 10) return null;
    return panelPhones.has(d);
  };

  return { panelPhones, isInPanel, refreshPanel };
};
