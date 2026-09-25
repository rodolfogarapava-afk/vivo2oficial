import { useEffect, useState } from "react";
import { Ban, ChevronRight, CircleDollarSign, Copy, KeyRound, Trash2, Unlock, Loader2, MessageCircle, Plus, RefreshCw, Save, Signal, Smartphone, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePanelNames } from "@/hooks/usePanelNames";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface PanelNamesSectionProps {
  userId?: string;
  showMyPanel?: boolean;
}

export const PanelNamesSection = ({ userId, showMyPanel = true }: PanelNamesSectionProps) => {
  const { toast } = useToast();
  const { myLabel, others, loading, saveLabel, saveSupportWhatsapp, saveResellerWhatsapp, savePanelCosts, setBlocked, deleteReseller } = usePanelNames(userId);
  const [mine, setMine] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [newReseller, setNewReseller] = useState("");
  const [creating, setCreating] = useState(false);
  const [resellerToken, setResellerToken] = useState("");
  const [resellerLink, setResellerLink] = useState("");
  const [renewing, setRenewing] = useState<string | null>(null);
  const [renewedTokens, setRenewedTokens] = useState<Record<string, string>>({});
  const [supportDrafts, setSupportDrafts] = useState<Record<string, string>>({});
  const [resellerDrafts, setResellerDrafts] = useState<Record<string, string>>({});
  const [expenseDrafts, setExpenseDrafts] = useState<Record<string, string>>({});
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const [expandedCosts, setExpandedCosts] = useState<Record<string, boolean>>({});

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
    setExpenseDrafts((prev) => {
      const next = { ...prev };
      for (const panel of others) if (next[panel.userId] === undefined) next[panel.userId] = String(panel.fixedExpense ?? 0);
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
    setResellerDrafts((prev) => {
      const next = { ...prev };
      for (const panel of others) {
        if (next[panel.userId] === undefined) next[panel.userId] = panel.resellerWhatsapp ?? "";
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
       const code = String(data?.token?.code ?? "");
       setResellerToken(code);
       setResellerLink(`${window.location.origin}/auth?r=${encodeURIComponent(code)}`);
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

  const saveResellerNumber = async (targetUserId: string) => {
    setSaving(`reseller-${targetUserId}`);
    try {
      await saveResellerWhatsapp(targetUserId, resellerDrafts[targetUserId] ?? "");
      toast({ title: "WhatsApp da revenda salvo!" });
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

  const saveCosts = async (targetUserId: string, currentCosts: number[]) => {
    const expense = Number((expenseDrafts[targetUserId] ?? "0").replace(",", "."));
    const entered = Number((costDrafts[targetUserId] ?? "").replace(",", "."));
    const costs = Number.isFinite(entered) && entered >= 0 ? [...currentCosts, entered] : currentCosts;
    setSaving(`cost-${targetUserId}`);
    try {
      await savePanelCosts(targetUserId, Number.isFinite(expense) ? expense : 0, costs);
      setCostDrafts((current) => ({ ...current, [targetUserId]: "" }));
      toast({ title: "Custos da revenda salvos!" });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar os custos.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const copyToken = async () => {
    if (!resellerLink) return;
    await navigator.clipboard.writeText(resellerLink);
    toast({ title: "Link copiado!", description: "Envie este link para a revenda se cadastrar." });
  };

  const renewResellerToken = async (targetUserId: string, panelLabel: string) => {
    setRenewing(targetUserId);
    try {
      const { data, error } = await supabase.functions.invoke("access-token", {
        body: { action: "create_reseller", panelLabel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const code = String(data?.token?.code ?? "");
      if (!code) throw new Error("TOKEN_NOT_CREATED");
      setRenewedTokens((current) => ({ ...current, [targetUserId]: code }));
      await navigator.clipboard.writeText(code).catch(() => undefined);
      toast({ title: "Novo token criado e copiado!", description: code });
    } catch {
      toast({ title: "Erro", description: "Não foi possível gerar outro token.", variant: "destructive" });
    } finally {
      setRenewing(null);
    }
  };

  const toggleBlock = async (targetUserId: string, label: string, block: boolean) => {
    if (block && !window.confirm(`Bloquear a revenda ${label}? Ela não verá mais os clientes.`)) return;
    setSaving(`block-${targetUserId}`);
    try {
      await setBlocked(targetUserId, block);
      toast({ title: block ? "Revenda bloqueada" : "Revenda desbloqueada", description: label });
    } catch {
      toast({ title: "Erro", description: "Não foi possível alterar o bloqueio.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const removeReseller = async (targetUserId: string, label: string) => {
    if (!window.confirm(`Excluir a revenda ${label} e todos os clientes dela? Isso não pode ser desfeito.`)) return;
    setSaving(`delete-${targetUserId}`);
    try {
      await deleteReseller(targetUserId);
      toast({ title: "Revenda excluída", description: label });
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir a revenda.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const copyRenewedToken = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast({ title: "Token copiado!", description: code });
  };

  return (
    <section className="reseller-manager space-y-3">
      <div className="reseller-manager__heading">
        <span className="reseller-manager__marker" />
        <Store className="h-5 w-5" />
        <h3 className="text-sm font-extrabold uppercase">Revendas</h3>
        <span className="reseller-manager__count">{others.length || 0}</span>
      </div>

      <div className="reseller-manager__new space-y-2">
        <p className="text-[11px] font-extrabold uppercase">Nova revenda</p>
        <div className="flex gap-2">
          <input value={newReseller} onChange={(event) => setNewReseller(event.target.value)} placeholder="Nome da revenda" maxLength={40} className="reseller-manager__input min-w-0 flex-1" />
          <Button type="button" onClick={() => void createReseller()} disabled={creating} size="icon" className="reseller-manager__save reseller-manager__save--gold" aria-label="Adicionar revenda">
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
          </Button>
        </div>
        {resellerToken && (
          <Button type="button" variant="ghost" onClick={() => void copyToken()} className="reseller-manager__token w-full justify-between">
            <span className="min-w-0 truncate text-left text-xs font-bold">{resellerLink}</span><Copy />
          </Button>
        )}
        {resellerToken && <p className="text-center text-[11px] font-bold">Token: {resellerToken}</p>}
      </div>

      {showMyPanel && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-extrabold uppercase">Meu painel</p>
          <div className="flex gap-2">
            <div className="reseller-manager__field-icon"><Smartphone /></div>
            <input value={mine} onChange={(event) => setMine(event.target.value)} maxLength={40} className="reseller-manager__input min-w-0 flex-1" />
            <Button type="button" onClick={() => userId && save(userId, mine)} disabled={!userId || saving === userId} size="icon" className="reseller-manager__save reseller-manager__save--gold" aria-label="Salvar meu painel">
              {saving === userId ? <Loader2 className="animate-spin" /> : <Save />}
            </Button>
          </div>
        </div>
      )}

      {loading && others.length === 0 ? (
        <div className="flex justify-center py-5"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : others.length === 0 ? (
        <p className="reseller-manager__empty">Nenhuma revenda ligada ainda.</p>
      ) : (
        <div className="space-y-3">
          {others.map((panel, index) => {
            const costsOpen = expandedCosts[panel.userId] ?? false;
            return (
              <article key={panel.userId} className="reseller-manager__card space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="reseller-manager__index">{index + 1}ª</span>
                    <strong className="truncate text-xs uppercase">{panel.label}</strong>
                  </div>
                  {panel.blocked && <span className="reseller-manager__blocked">Bloqueada</span>}
                </div>

                <div className="flex gap-2">
                  <div className="reseller-manager__field-icon reseller-manager__field-icon--gold"><Smartphone /></div>
                  <input value={drafts[panel.userId] ?? panel.label} onChange={(event) => setDrafts((current) => ({ ...current, [panel.userId]: event.target.value }))} maxLength={40} className="reseller-manager__input min-w-0 flex-1" aria-label={`Nome da revenda ${panel.label}`} />
                  <Button type="button" onClick={() => void save(panel.userId, drafts[panel.userId] ?? panel.label)} disabled={saving === panel.userId} size="icon" className="reseller-manager__save reseller-manager__save--gold" aria-label="Salvar nome da revenda">
                    {saving === panel.userId ? <Loader2 className="animate-spin" /> : <Save />}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <div className="reseller-manager__field-icon reseller-manager__field-icon--support"><MessageCircle /></div>
                  <input value={supportDrafts[panel.userId] ?? ""} onChange={(event) => setSupportDrafts((current) => ({ ...current, [panel.userId]: event.target.value }))} placeholder="Seu WhatsApp para suporte" inputMode="tel" className="reseller-manager__input min-w-0 flex-1" />
                  <Button type="button" onClick={() => void saveSupport(panel.userId)} disabled={saving === `support-${panel.userId}`} size="icon" className="reseller-manager__save reseller-manager__save--support" aria-label="Salvar WhatsApp de suporte">
                    {saving === `support-${panel.userId}` ? <Loader2 className="animate-spin" /> : <Save />}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <div className="reseller-manager__field-icon reseller-manager__field-icon--reseller"><MessageCircle /></div>
                  <input value={resellerDrafts[panel.userId] ?? ""} onChange={(event) => setResellerDrafts((current) => ({ ...current, [panel.userId]: event.target.value }))} placeholder="WhatsApp da revenda" inputMode="tel" className="reseller-manager__input min-w-0 flex-1" />
                  <Button type="button" onClick={() => void saveResellerNumber(panel.userId)} disabled={saving === `reseller-${panel.userId}`} size="icon" className="reseller-manager__save reseller-manager__save--reseller" aria-label="Salvar WhatsApp da revenda">
                    {saving === `reseller-${panel.userId}` ? <Loader2 className="animate-spin" /> : <Save />}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="reseller-manager__number-field"><CircleDollarSign /><input value={expenseDrafts[panel.userId] ?? "0"} onChange={(event) => setExpenseDrafts((current) => ({ ...current, [panel.userId]: event.target.value }))} placeholder="Custo padrão" inputMode="decimal" aria-label="Custo padrão" /></label>
                  <label className="reseller-manager__number-field"><Signal /><input value={costDrafts[panel.userId] ?? ""} onChange={(event) => setCostDrafts((current) => ({ ...current, [panel.userId]: event.target.value }))} placeholder="Novo custo" inputMode="decimal" aria-label="Novo custo" /></label>
                </div>

                <Button type="button" onClick={() => setExpandedCosts((current) => ({ ...current, [panel.userId]: !costsOpen }))} className="reseller-manager__costs w-full justify-between">
                  <Save /><span>Custos</span><ChevronRight className={costsOpen ? "rotate-90 transition-transform" : "transition-transform"} />
                </Button>
                {costsOpen && (
                  <div className="reseller-manager__cost-list">
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {panel.lineCosts.length === 0 && <span className="text-[11px] opacity-70">Nenhum custo adicionado</span>}
                      {panel.lineCosts.map((cost) => (
                        <Button key={cost} type="button" variant="outline" size="sm" onClick={() => void savePanelCosts(panel.userId, panel.fixedExpense, panel.lineCosts.filter((item) => item !== cost))} className="h-7 px-2 text-[10px]">R$ {cost.toFixed(2).replace(".", ",")} ×</Button>
                      ))}
                    </div>
                    <Button type="button" onClick={() => void saveCosts(panel.userId, panel.lineCosts)} disabled={saving === `cost-${panel.userId}`} size="sm" className="reseller-manager__save-cost">
                      {saving === `cost-${panel.userId}` ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" onClick={() => void toggleBlock(panel.userId, panel.label, !panel.blocked)} disabled={saving === `block-${panel.userId}`} className="reseller-manager__block">
                    {saving === `block-${panel.userId}` ? <Loader2 className="animate-spin" /> : panel.blocked ? <Unlock /> : <Ban />}{panel.blocked ? "Desbloquear" : "Bloquear"}
                  </Button>
                  <Button type="button" onClick={() => void removeReseller(panel.userId, panel.label)} disabled={saving === `delete-${panel.userId}`} className="reseller-manager__delete">
                    {saving === `delete-${panel.userId}` ? <Loader2 className="animate-spin" /> : <Trash2 />}Excluir
                  </Button>
                </div>

                <Button type="button" onClick={() => void renewResellerToken(panel.userId, drafts[panel.userId] ?? panel.label)} disabled={renewing === panel.userId} className="reseller-manager__renew w-full">
                  {renewing === panel.userId ? <Loader2 className="animate-spin" /> : <RefreshCw />}Atualizar token<ChevronRight className="ml-auto" />
                </Button>
                {renewedTokens[panel.userId] && (
                  <Button type="button" variant="ghost" onClick={() => void copyRenewedToken(renewedTokens[panel.userId])} className="reseller-manager__token w-full justify-between">
                    <span className="flex min-w-0 items-center gap-2"><KeyRound /><span className="truncate">{renewedTokens[panel.userId]}</span></span><Copy />
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="reseller-manager__tip">O botão Revenda do topo abre seus painéis. Dentro de cada painel, use os botões superiores para trocar de revenda.</p>
    </section>
  );
};
