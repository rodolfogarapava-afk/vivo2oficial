import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plus, RefreshCw, Signal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientCard } from "@/components/ClientCard";
import { NewClientForm } from "@/components/NewClientForm";
import { isFreeLine } from "@/hooks/useFreeLineColor";
import { useFixedExpense } from "@/hooks/useFixedExpense";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/hooks/useClients";

interface PartnerPanelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** User id of the linked panel (resale). */
  partnerUserId?: string;
  panelLabel?: string;
}

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const PartnerPanelModal = ({
  open,
  onOpenChange,
  partnerUserId,
  panelLabel,
}: PartnerPanelModalProps) => {
  const label = (panelLabel || "CHIP NET").toUpperCase();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { fixedExpense } = useFixedExpense();
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

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const ordered = useMemo(
    () => [...clients].sort((a, b) => Number(isFreeLine(b.name)) - Number(isFreeLine(a.name))),
    [clients],
  );

  const total = useMemo(
    () => clients.reduce((sum, c) => sum + Number(c.value_paid ?? 0), 0),
    [clients],
  );

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
  }) => {
    if (!partnerUserId) return;
    setSaving(true);
    try {
      const { error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>)("add_panel_client", {
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
      });
      if (rpcError) throw new Error(rpcError.message);
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

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Signal className="h-5 w-5 shrink-0 text-cyan-400" />
        <h2 className="min-w-0 flex-1 truncate text-base font-extrabold uppercase tracking-wider text-foreground">
          Painel {label}
        </h2>
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
        <div className="rounded-xl border border-purple-700/60 bg-purple-950/40 p-2 text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-200">Total</p>
          <p className="truncate text-sm font-extrabold text-foreground">{money(total)}</p>
        </div>
        <div className="rounded-xl border border-cyan-700/60 bg-cyan-950/40 p-2 text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-200">Linhas</p>
          <p className="text-sm font-extrabold text-foreground">{clients.length}</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-6">
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
            <ClientCard
              key={client.id}
              client={client}
              index={index}
              onToggleVirtualChip={() => {}}
              inPanel={null}
            />
          ))
        )}
      </div>
    </div>,
    document.body,
  );
};
