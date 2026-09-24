import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AccessState {
  isAdmin: boolean;
  plan: string | null;
  expiresAt: string | null;
  loading: boolean;
  isBlocked: boolean;
}

const ACCESS_CACHE_KEY = "access-control-cache";

interface CachedAccess {
  isAdmin: boolean;
  plan: string | null;
  expiresAt: string | null;
}

const readCache = (): CachedAccess | null => {
  try {
    const raw = localStorage.getItem(ACCESS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedAccess) : null;
  } catch {
    return null;
  }
};

export const useAccessControl = (userId?: string) => {
  const cached = readCache();
  const [isAdmin, setIsAdmin] = useState(cached?.isAdmin ?? false);
  const [plan, setPlan] = useState<string | null>(cached?.plan ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(cached?.expiresAt ?? null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.rpc as any)("claim_owner_admin").then(() => undefined, () => undefined);
      const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
        supabase.from("profiles").select("access_plan, access_expires_at").eq("user_id", userId).maybeSingle(),
      ]);

      const nextIsAdmin = !!roleRow;
      const nextPlan = (profileRow?.access_plan as string | null) ?? null;
      const nextExpires = (profileRow?.access_expires_at as string | null) ?? null;

      setIsAdmin(nextIsAdmin);
      setPlan(nextPlan);
      setExpiresAt(nextExpires);

      try {
        localStorage.setItem(
          ACCESS_CACHE_KEY,
          JSON.stringify({ isAdmin: nextIsAdmin, plan: nextPlan, expiresAt: nextExpires }),
        );
      } catch {
        // ignore storage errors
      }
    } catch (error) {
      console.error("Erro ao verificar acesso:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const expired = !!expiresAt && new Date(expiresAt).getTime() < Date.now();
  const isBlocked = !loading && !isAdmin && !!userId && (plan === null || expired);

  return { isAdmin, plan, expiresAt, loading, isBlocked, reload: load };
};

export const redeemAccessToken = async (code: string) => {
  const { data, error } = await supabase.functions.invoke("access-token", {
    body: { action: "redeem", code },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { ok: boolean; plan: string; expires_at: string | null };
};
