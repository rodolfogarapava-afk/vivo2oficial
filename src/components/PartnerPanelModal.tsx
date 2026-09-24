import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Loader2, Pencil, Plus, RefreshCw, Save, Settings, Signal, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientCard } from "@/components/ClientCard";
import { NewClientForm } from "@/components/NewClientForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isFreeLine } from "@/hooks/useFreeLineColor";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/hooks/useClients";
import { formatClientName } from "@/lib/formatName";
import { ResellerHistory, ResellerValuesList } from "@/components/ResellerTools";

const currentMonth = () => new Date().toISOString().slice(0, 7);

interface PartnerPanelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** User id of the linked panel (resale). */
  partnerUserId?: string;
  panelLabel?: string;
  supportWhatsapp?: string | null;
  resellerWhatsapp?: string | null;
  fixedExpense?: number;
  lineCosts?: number[];
  panels?: { userId: string; label: string }[];
  onSelectPanel?: (userId: string) => void;
}

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const PartnerPanelModal = ({
  open,
  onOpenChange,
  partnerUserId,
  panelLabel,
  supportWhatsapp,
  resellerWhatsapp,
  fixedExpense: panelFixedExpense = 0,
  lineCosts = [],
  panels = [],
  onSelectPanel,
}: PartnerPanelModalProps) => {
  const label = (panelLabel || "CHIP NET").toUpperCase();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAssociates, setShowAssociates] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editDataGb, setEditDataGb] = useState("0");
  const [editDataUsedGb, setEditDataUsedGb] = useState("0");
  const [showValues, setShowValues] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [myId, setMyId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!partnerUserId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: Client[] | null; error: { message: string } | null }>)(
        "list_panel_clients",
        { p_panel_user: partnerUserId },
      );
      if (rpcError) throw new Error(rpcError.message);
      setClients(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as linhas.");
    } finally {
      setLoading(false);
    }
  }, [partnerUserId]);

  const loadPaid = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id ?? null;
    setMyId(uid);
    if (!uid) return;
    const { data } = await supabase
      .from("client_payments")
      .select("client_id, paid")
      .eq("user_id", uid)
      .eq("month", currentMonth());
    setPaidIds(new Set((data ?? []).filter((r) => r.paid).map((r) => r.client_id)));
  }, []);

  useEffect(() => {
    if (open) {
      void load();
      void loadPaid();
    }
  }, [open, load, loadPaid]);

  const togglePaid = async (client: Client) => {
    if (!myId) return;
    const month = currentMonth();
    const isPaid = paidIds.has(client.id);
    const next = new Set(paidIds);
    if (isPaid) {
      next.delete(client.id);
      setPaidIds(next);
      await supabase.from("client_payments").delete().eq("user_id", myId).eq("client_id", client.id).eq("month", month);
    } else {
      next.add(client.id);
      setPaidIds(next);
      await supabase.from("client_payments").insert({ user_id: myId, client_id: client.id, month, paid: true, amount: Number(client.value_paid ?? 0) });
    }
  };

  const ordered = useMemo(
    () => [...clients].sort((a, b) => Number(isFreeLine(b.name)) - Number(isFreeLine(a.name))),
    [clients],
  );

  const total = useMemo(
    () => clients.reduce((sum, c) => sum + Number(c.line_cost ?? panelFixedExpense ?? 0), 0),
    [clients, panelFixedExpense],
  );

  const sendPaymentConfirmed = () => {
    const digits = (resellerWhatsapp ?? "").replace(/\D/g, "");
    if (!digits) {
      toast({
        title: "WhatsApp da revenda não configurado",
        description: "Adicione o WhatsApp da revenda nas configurações.",
        variant: "destructive",
      });
      return;
    }
    const now = new Date();
    const date = now.toLocaleDateString("pt-BR");
    const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toLocaleDateString("pt-BR", { month: "long" });
    const monthName = nextMonth.charAt(0).toUpperCase() + nextMonth.slice(1);
    const message = [
      "👤 *Boa noite 🌛*",
      "",
      `*${label}*`,
      "",
      "*✅PAGAMENTO CONFIRMADO✅*",
      "",
      "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬",
      "",
      "🔵 *Plano: VIVO*",
      "",
      `💰 *Valor: ${money(total)}*`,
      "",
      `📅 *Data: ${date}*`,
      "",
      `🕐 *Horário: ${time}*`,
      "",
      `*✅ ${monthName}: Pago*`,
      "",
      "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬",
      "",
      " *♻️Sistema Continuar 100%*",
      "",
      "🫵Agradecemos pela confiança! 🙏",
    ].join("\n");
    window.open(`https://wa.me/55${digits}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleCreate = async (client: {
    name: string;
    phone: string;
    whatsapp: string | null;
    value_paid: number;
    due_day: number;
    virtual_chip: boolean;
    is_resale: boolean;
    bonus: boolean;
    company: string;
    account: number | null;
    line_cost?: number | null;
  }) => {
    if (!partnerUserId) return;
    setSaving(true);
    try {
      const { data: created, error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: Client | null; error: { message: string } | null }>)('add_panel_client', {
        p_panel_user: partnerUserId,
        p_name: client.name,
        p_phone: client.phone,
        p_value: client.value_paid,
        p_due_day: client.due_day,
        p_virtual_chip: client.virtual_chip,
        p_is_resale: client.is_resale,
        p_bonus: client.bonus,
        p_company: client.company,
        p_account: client.account,
        p_whatsapp: client.whatsapp,
        p_line_cost: client.line_cost ?? null,
      });
      if (rpcError) throw new Error(rpcError.message);
      if (!created) throw new Error("O cliente não foi salvo.");
      setClients((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      toast({ title: "Cliente cadastrado!", description: `Adicionado no painel ${label}.` });
      setShowForm(false);
      await load();
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Não foi possível cadastrar.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (client: Client) => {
    setEditName(client.name);
    setEditPhone(client.phone);
    setEditWhatsapp(client.whatsapp ?? "");
    setEditValue(String(client.value_paid ?? 0));
    setEditDataGb(String(client.data_gb ?? 0));
    setEditDataUsedGb(String(client.data_used_gb ?? 0));
    setEditingClient(client);
  };

  const saveEdit = async () => {
    if (!partnerUserId || !editingClient || !editName.trim() || !editPhone.trim() || editValue === "") return;
    setSaving(true);
    try {
      const { error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>)('update_panel_client', {
        p_panel_user: partnerUserId,
        p_client_id: editingClient.id,
        p_name: formatClientName(editName),
        p_phone: editPhone.trim(),
        p_value: Number(editValue.replace(',', '.')) || 0,
        p_whatsapp: editWhatsapp.trim() || null,
        p_data_gb: Number(editDataGb.replace(',', '.')) || 0,
        p_data_used_gb: Number(editDataUsedGb.replace(',', '.')) || 0,
      });
      if (rpcError) throw new Error(rpcError.message);
      setEditingClient(null);
      await load();
      toast({ title: "Associado atualizado!" });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Não foi possível salvar.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!partnerUserId || !clientToDelete) return;
    setSaving(true);
    try {
      const { data, error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: boolean | null; error: { message: string } | null }>)('delete_panel_client', {
        p_panel_user: partnerUserId,
        p_client_id: clientToDelete.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      if (!data) throw new Error("Associado não encontrado.");
      setClientToDelete(null);
      setEditingClient(null);
      await load();
      toast({ title: "Associado excluído" });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Não foi possível excluir.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Signal className="h-5 w-5 shrink-0 text-cyan-400" />
        <h2 className="min-w-0 flex-1 truncate text-base font-extrabold uppercase tracking-wider text-foreground">
          Painel {label}
        </h2>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={() => setShowAssociates(true)}
          className="h-9 w-9 shrink-0 rounded-xl border border-border"
          aria-label="Editar associados"
          title="Editar associados"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex h-9 items-center gap-1 rounded-xl bg-green-600 px-3 text-[11px] font-extrabold uppercase tracking-wider text-white"
        >
          <Plus className="h-4 w-4" />
          Novo
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 text-[11px] font-extrabold uppercase tracking-wider text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary text-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-3">
        <button
          type="button"
          onClick={sendPaymentConfirmed}
          className="rounded-xl border border-purple-700/60 bg-purple-950/40 p-2 text-center transition active:scale-95"
          title="Enviar confirmação de pagamento no WhatsApp da revenda"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-200">Total</p>
          <p className="truncate text-sm font-extrabold text-foreground">{money(total)}</p>
        </button>
        <div className="rounded-xl border border-cyan-700/60 bg-cyan-950/40 p-2 text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-200">Linhas</p>
          <p className="text-sm font-extrabold text-foreground">{clients.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <Button type="button" onClick={() => setShowValues(true)} className="h-11 rounded-xl bg-green-700 font-bold text-white hover:bg-green-600">
          Lista de valores
        </Button>
        <Button type="button" variant="secondary" onClick={() => setShowHistory(true)} className="h-11 rounded-xl border border-border font-bold">
          Status e mensagens
        </Button>
      </div>

      {showValues && partnerUserId && (
        <ResellerValuesList panelUserId={partnerUserId} clients={ordered} onBack={() => setShowValues(false)} onDone={() => void load()} />
      )}
      {showHistory && partnerUserId && (
        <ResellerHistory panelUserId={partnerUserId} clients={ordered} paidIds={paidIds} onTogglePaid={(c) => void togglePaid(c)} onBack={() => setShowHistory(false)} />
      )}

      {panels.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-3">
          {panels.map((panel) => (
            <button
              key={panel.userId}
              type="button"
              onClick={() => onSelectPanel?.(panel.userId)}
              className={`h-10 shrink-0 rounded-lg border px-4 text-xs font-extrabold uppercase ${
                panel.userId === partnerUserId
                  ? "border-cyan-300 bg-cyan-600 text-white"
                  : "border-border bg-secondary text-foreground"
              }`}
            >
              {panel.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-6">
        {showForm && (
          <NewClientForm
            onSubmit={(client) => void handleCreate(client)}
            onCancel={() => setShowForm(false)}
            isLoading={saving}
            fixedExpense={panelFixedExpense}
            availableLineCosts={lineCosts}
            existingPhones={clients.map((c) => c.phone)}
          />
        )}
        {loading && clients.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-foreground/60" />
          </div>
        ) : error ? (
          <p className="text-xs font-semibold text-red-400">{error}</p>
        ) : ordered.length === 0 ? (
          <p className="text-xs leading-snug text-muted-foreground">Nenhuma linha nesse painel ainda.</p>
        ) : (
          ordered.map((client, index) => (
            <div key={client.id} className="space-y-1">
              <ClientCard
                client={client}
                index={index}
                onToggleVirtualChip={() => {}}
                inPanel={null}
                supportWhatsapp={supportWhatsapp}
                valueOverride={Number(client.line_cost ?? panelFixedExpense ?? 0)}
                dense
              />
            </div>
          ))
        )}
      </div>

      {showAssociates && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-border px-3 py-3">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => setShowAssociates(false)}
              className="h-10 w-10 rounded-xl border border-border"
              aria-label="Voltar ao painel"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h3 className="min-w-0 flex-1 truncate text-base font-extrabold uppercase text-foreground">
              Associados — {label}
            </h3>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pb-6 touch-pan-y">
            {ordered.map((client) => (
              <Button
                key={client.id}
                type="button"
                variant="secondary"
                onClick={() => startEdit(client)}
                className="h-auto min-h-14 w-full justify-start rounded-xl border border-border px-3 py-3 text-left"
              >
                <Pencil className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 whitespace-normal break-words font-bold">{formatClientName(client.name)}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{client.phone}</span>
              </Button>
            ))}
            {ordered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum associado cadastrado.</p>}
          </div>
        </div>
      )}

      {editingClient && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/90 p-4">
          <div className="max-h-[90dvh] w-full max-w-sm space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-foreground">Editar associado</h3>
              <Button type="button" size="icon" variant="ghost" onClick={() => setEditingClient(null)} aria-label="Fechar edição">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Nome" />
            <Input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} placeholder="Telefone" inputMode="tel" />
            <Input value={editWhatsapp} onChange={(event) => setEditWhatsapp(event.target.value)} placeholder="WhatsApp (opcional)" inputMode="tel" />
            <Input value={editValue} onChange={(event) => setEditValue(event.target.value)} placeholder="Valor" inputMode="decimal" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={editDataGb} onChange={(event) => setEditDataGb(event.target.value)} placeholder="Giga total" inputMode="decimal" />
              <Input value={editDataUsedGb} onChange={(event) => setEditDataUsedGb(event.target.value)} placeholder="Giga usado" inputMode="decimal" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button type="button" onClick={() => void saveEdit()} disabled={saving || !editName.trim() || !editPhone.trim()} className="h-11 rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
              <Button type="button" variant="destructive" onClick={() => setClientToDelete(editingClient)} disabled={saving} className="h-11 rounded-xl">
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {clientToDelete && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-background/90 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-muted-foreground">Deseja excluir <strong className="text-foreground">{clientToDelete.name}</strong> desta revenda?</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={() => setClientToDelete(null)} disabled={saving}>Voltar</Button>
              <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};
