import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "vivo-panel-phones";
let sharedRefreshPromise: Promise<{
  phones: string[];
  names: Record<string, string>;
  sync: unknown;
} | null> | null = null;

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

/** Returns the client name the Gestor has for a phone, from the last sync cache. */
export const getCachedPanelName = (phone: string): string | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const names = data.names as Record<string, string> | undefined;
    if (!names) return null;
    const name = names[digits(phone)];
    return typeof name === "string" && name.trim() ? name : null;
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
      if (!sharedRefreshPromise) {
        sharedRefreshPromise = (async () => {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) return null;
          const { data, error } = await supabase.functions.invoke("vivo-gestao", {
            body: { action: "auto_sync" },
          });
          if (error || !data?.lines) return null;
          const phones = [...new Set((data.lines as { phone?: string }[])
            .map((line) => digits(line.phone || ""))
            .filter((phone) => phone.length >= 10))];
          const names: Record<string, string> = {};
          for (const line of data.lines as { phone?: string; name?: string }[]) {
            const phone = digits(line.phone || "");
            const name = (line.name || "").trim();
            if (phone.length >= 10 && name) names[phone] = name;
          }
          return { phones, names, sync: data.sync ?? null };
        })().finally(() => {
          sharedRefreshPromise = null;
        });
      }
      const result = await sharedRefreshPromise;
      if (!result) return false;
      const { phones, names, sync } = result;
      if (phones.length === 0) return false;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ phones, names, ts: Date.now() }));
      setPanelPhones(new Set(phones));
      window.dispatchEvent(new CustomEvent("vivo-panel-synced", { detail: sync }));
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
