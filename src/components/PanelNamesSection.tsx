import { useEffect, useState } from "react";
import { Copy, Loader2, MessageCircle, Plus, Save, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePanelNames } from "@/hooks/usePanelNames";
import { useToast } from "@/hooks/use-toast";

interface PanelNamesSectionProps {
  userId?: string;
  showMyPanel?: boolean;
}

export const PanelNamesSection = ({ userId, showMyPanel = true }: PanelNamesSectionProps) => {
  const { toast } = useToast();
  const { myLabel, others, loading, saveLabel, saveSupportWhatsapp } = usePanelNames(userId);
  const [mine, setMine] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [newReseller, setNewReseller] = useState("");
  const [creating, setCreating] = useState(false);
  const [resellerToken, setResellerToken] = useState("");
  const [supportDrafts, setSupportDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setMine(myLabel ?? "RAIO TELECOM");
  }, [myLabel]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const panel of others) if (next[panel.userId] === undefined) next[panel.userId] = panel.label;
      return next;
    });
  }, [others]);

  useEffect(() => {
    setSupportDrafts((prev) => {
      const next = { ...prev };
      for (const panel of others) {
        if (next[panel.userId] === undefined) next[panel.userId] = panel.supportWhatsapp ?? "";
      }
      return next;
    });
  }, [others]);

  const save = async (targetUserId: string, label: string) => {
    setSaving(targetUserId);
    try {
      await saveLabel(targetUserId, label);
      toast({ title: "Nome salvo!", description: label.trim().toUpperCase() });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar o nome.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const createReseller = async () => {
    const label = newReseller.trim().slice(0, 40);
    if (!label) {
      toast({ title: "Digite o nome da revenda", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("access-token", {
        body: { action: "create_reseller", panelLabel: label },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResellerToken(String(data?.token?.code ?? ""));
      setNewReseller("");
      toast({ title: "Token da revenda criado!", description: String(data?.token?.code ?? "") });
    } catch {
      toast({ title: "Erro", description: "Não foi possível criar a revenda.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const saveSupport = async (targetUserId: string) => {
    setSaving(`support-${targetUserId}`);
    try {
      await saveSupportWhatsapp(targetUserId, supportDrafts[targetUserId] ?? "");
      toast({ title: "WhatsApp de suporte salvo!" });
    } catch (error) {
      toast({
        title: "Número inválido",
        description: error instanceof Error ? error.message : "Confira o WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const copyToken = async () => {
    if (!resellerToken) return;
    await navigator.clipboard.writeText(resellerToken);
    toast({ title: "Token copiado!" });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">Painéis / Revenda</h3>
      </div>

      <div className="space-y-2 rounded-lg border border-cyan-500/40 bg-card p-2">
        <p className="text-[11px] font-bold uppercase text-muted-foreground">Nova revenda</p>
        <div className="flex gap-2">
          <input
            value={newReseller}
            onChange={(event) => setNewReseller(event.target.value)}
            placeholder="Nome da revenda"
            maxLength={40}
            className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => void createReseller()}
            disabled={creating}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-600 text-white disabled:opacity-60"
            aria-label="Adicionar revenda"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>
        {resellerToken && (
          <button
            type="button"
            onClick={() => void copyToken()}
            className="flex w-full items-center justify-between rounded-lg bg-secondary p-3 text-foreground"
          >
            <span className="font-bold tracking-wider">{resellerToken}</span>
            <Copy className="h-4 w-4" />
          </button>
        )}
        <p className="text-[11px] text-muted-foreground">Envie este token para a revenda criar a conta e aparecer aqui automaticamente.</p>
      </div>

      {showMyPanel && <div className="space-y-1">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Meu painel</label>
        <div className="flex gap-2">
          <input
            value={mine}
            onChange={(e) => setMine(e.target.value)}
            maxLength={40}
            className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={() => userId && save(userId, mine)}
            disabled={!userId || saving === userId}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-purple-600 to-purple-800 text-white disabled:opacity-60"
          >
            {saving === userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </button>
        </div>
      </div>}

      {loading && others.length === 0 ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-foreground/60" />
        </div>
      ) : others.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nenhuma revenda ligada ainda. Quando alguém criar o painel de revenda, o nome aparece aqui para você definir.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Revendas</p>
          {others.map((panel, index) => (
            <div key={panel.userId} className="space-y-2 rounded-xl border border-border bg-card p-2">
              <div className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-center text-xs font-extrabold text-cyan-400">{index + 1}ª</span>
                <input
                  value={drafts[panel.userId] ?? panel.label}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [panel.userId]: e.target.value }))}
                  maxLength={40}
                  className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => save(panel.userId, drafts[panel.userId] ?? panel.label)}
                  disabled={saving === panel.userId}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 text-white disabled:opacity-60"
                >
                  {saving === panel.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 pl-9">
                <MessageCircle className="h-4 w-4 shrink-0 text-green-500" />
                <input
                  value={supportDrafts[panel.userId] ?? ""}
                  onChange={(event) => setSupportDrafts((prev) => ({ ...prev, [panel.userId]: event.target.value }))}
                  placeholder="Seu WhatsApp para suporte"
                  inputMode="tel"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => void saveSupport(panel.userId)}
                  disabled={saving === `support-${panel.userId}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white disabled:opacity-60"
                  aria-label="Salvar WhatsApp de suporte"
                >
                  {saving === `support-${panel.userId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-snug text-muted-foreground">
        O botão azul do topo abre suas revendas. Dentro de cada painel, use os botões superiores para trocar de revenda.
      </p>
    </div>
  );
};
