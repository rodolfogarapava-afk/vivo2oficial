import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AccessToken {
  id: string;
  code: string;
  plan: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

const callAction = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("access-token", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export const AccessTokensSection = () => {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAction({ action: "list" });
      setTokens((data?.tokens ?? []) as AccessToken[]);
    } catch (error) {
      console.error("Erro ao listar tokens:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createToken = async (plan: "30d" | "lifetime") => {
    setCreating(true);
    try {
      await callAction({ action: "create", plan });
      toast({ title: "Token criado!", description: plan === "lifetime" ? "Vitalício" : "30 dias" });
      await load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível criar o token.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await callAction({ action: "revoke", id });
      toast({ title: "Token cancelado" });
      await load();
    } catch {
      toast({ title: "Erro", description: "Não foi possível cancelar.", variant: "destructive" });
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Token copiado!", description: code });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const statusOf = (token: AccessToken) => {
    if (token.revoked) return { text: "Cancelado", className: "text-red-400" };
    if (!token.used_by) return { text: "Disponível", className: "text-green-400" };
    if (token.plan === "lifetime") return { text: "Em uso • vitalício", className: "text-cyan-400" };
    if (token.expires_at && new Date(token.expires_at).getTime() < Date.now())
      return { text: "Vencido", className: "text-red-400" };
    return {
      text: `Em uso • até ${new Date(token.expires_at ?? "").toLocaleDateString("pt-BR")}`,
      className: "text-yellow-400",
    };
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-yellow-400" />
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">Tokens de acesso</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => createToken("30d")}
          disabled={creating}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-purple-600 to-purple-800 text-[11px] font-extrabold uppercase tracking-wider text-white disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> 30 dias
        </button>
        <button
          type="button"
          onClick={() => createToken("lifetime")}
          disabled={creating}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 text-[11px] font-extrabold uppercase tracking-wider text-white disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Vitalício
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-foreground/60" />
        </div>
      ) : tokens.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum token criado ainda.</p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {tokens.map((token) => {
            const status = statusOf(token);
            return (
              <div key={token.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold tracking-wider text-foreground">{token.code}</p>
                  <p className={`text-[11px] font-semibold ${status.className}`}>{status.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(token.code)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary text-foreground"
                  title="Copiar"
                >
                  <Copy className="h-4 w-4" />
                </button>
                {!token.revoked && !token.used_by && (
                  <button
                    type="button"
                    onClick={() => revoke(token.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/50 bg-red-950/40 text-red-300"
                    title="Cancelar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] leading-snug text-muted-foreground">
        Cada token serve para uma pessoa. Ela digita o código no cadastro; no fim dos 30 dias o app dela é bloqueado
        até você enviar um token novo.
      </p>
    </div>
  );
};
