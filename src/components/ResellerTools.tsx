import { useMemo, useState } from "react";
import { ArrowLeft, Check, Circle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLineCosts } from "@/hooks/useLineCosts";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/hooks/useClients";
import { formatClientName } from "@/lib/formatName";
import { isFreeLine } from "@/hooks/useFreeLineColor";

const money = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export interface MessageLogEntry {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  message: string;
  at: string;
}

const logKey = (panel: string) => `reseller_message_log_${panel}`;

export const readMessageLog = (panel: string): MessageLogEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(logKey(panel)) || "[]");
  } catch {
    return [];
  }
};

export const addMessageLog = (panel: string, entry: Omit<MessageLogEntry, "id" | "at">) => {
  const list = readMessageLog(panel);
  list.unshift({ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() });
  localStorage.setItem(logKey(panel), JSON.stringify(list.slice(0, 500)));
};

const Screen = ({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-[10001] flex flex-col bg-background">
    <div className="flex items-center gap-2 border-b border-border px-3 py-3">
      <Button type="button" size="icon" variant="secondary" onClick={onBack} className="h-10 w-10 rounded-xl" aria-label="Voltar">
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <h3 className="min-w-0 flex-1 truncate text-base font-extrabold text-foreground">{title}</h3>
    </div>
    {children}
  </div>
);

export const ResellerValuesList = ({
  panelUserId,
  clients,
  onBack,
  onDone,
}: {
  panelUserId: string;
  clients: Client[];
  onBack: () => void;
  onDone: () => void;
}) => {
  const { list } = useLineCosts();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const items = useMemo(() => clients.filter((c) => !isFreeLine(c.name)), [clients]);

  const toggle = (id: string) =>
    setMarked((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const apply = async () => {
    const num = Number(value.replace(",", "."));
    if (!Number.isFinite(num) || num < 0 || marked.size === 0) return;
    setSaving(true);
    try {
      for (const c of items.filter((i) => marked.has(i.id))) {
        const { error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
          "update_panel_client",
          {
            p_panel_user: panelUserId,
            p_client_id: c.id,
            p_name: c.name,
            p_phone: c.phone,
            p_value: num,
            p_whatsapp: c.whatsapp ?? null,
            p_data_gb: c.data_gb ?? 0,
            p_data_used_gb: c.data_used_gb ?? 0,
          },
        );
        if (error) throw new Error(error.message);
      }
      toast({ title: "Valores atualizados!", description: `${marked.size} cliente(s) agora com ${money(num)}.` });
      setMarked(new Set());
      onDone();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Lista de valores" onBack={onBack}>
      <div className="flex gap-2 overflow-x-auto px-3 pt-3">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valor (ex.: 39,99)" inputMode="decimal" className="h-12 min-w-40" />
        {list.map((v) => (
          <Button key={v} type="button" variant="secondary" onClick={() => setValue(String(v).replace(".", ","))} className="h-12 shrink-0 font-bold">
            {money(v)}
          </Button>
        ))}
      </div>
      <p className="px-3 py-2 text-xs text-muted-foreground">
        Marque os clientes e toque em Aplicar para colocar o valor em todos os marcados ({marked.size} marcados).
      </p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary p-3 text-left"
          >
            {marked.has(c.id) ? <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" /> : <Circle className="h-6 w-6 shrink-0 text-muted-foreground" />}
            <span className="min-w-0 flex-1 font-semibold text-foreground">{formatClientName(c.name)}</span>
            <span className="shrink-0 font-bold text-green-400">{money(Number(c.value_paid ?? 0))}</span>
          </button>
        ))}
      </div>
      <div className="p-3">
        <Button type="button" onClick={() => void apply()} disabled={saving || marked.size === 0 || !value} className="h-12 w-full font-bold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Aplicar valor nos marcados
        </Button>
      </div>
    </Screen>
  );
};

export const ResellerHistory = ({
  panelUserId,
  clients,
  paidIds,
  onTogglePaid,
  onBack,
}: {
  panelUserId: string;
  clients: Client[];
  paidIds: Set<string>;
  onTogglePaid: (client: Client) => void;
  onBack: () => void;
}) => {
  const [tab, setTab] = useState<"status" | "history">("status");
  const [log, setLog] = useState(() => readMessageLog(panelUserId));
  const items = clients.filter((c) => !isFreeLine(c.name));
  const lastSent = (id: string) => log.find((l) => l.clientId === id)?.at;
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const paidCount = items.filter((c) => paidIds.has(c.id)).length;

  return (
    <Screen title="Status e mensagens" onBack={onBack}>
      <div className="grid grid-cols-2 gap-2 p-3">
        <Button type="button" variant={tab === "status" ? "default" : "secondary"} onClick={() => setTab("status")} className="h-11 font-bold">
          Status ({paidCount}/{items.length} pagos)
        </Button>
        <Button type="button" variant={tab === "history" ? "default" : "secondary"} onClick={() => setTab("history")} className="h-11 font-bold">
          Histórico ({log.length})
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-6">
        {tab === "status" ? (
          items.map((c) => {
            const paid = paidIds.has(c.id);
            const sent = lastSent(c.id);
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{formatClientName(c.name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(Number(c.value_paid ?? 0))} · vence dia {c.due_day ?? 10}
                    {sent ? ` · mensagem ${fmt(sent)}` : " · sem mensagem"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onTogglePaid(c)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-extrabold uppercase ${paid ? "bg-green-600 text-white" : "bg-red-600/80 text-white"}`}
                >
                  {paid ? "Pago" : "Não pago"}
                </button>
              </div>
            );
          })
        ) : log.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</p>
        ) : (
          <>
            {log.map((l) => (
              <div key={l.id} className="space-y-1 rounded-xl border border-border bg-secondary p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold text-foreground">{formatClientName(l.clientName)}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmt(l.at)}</span>
                </div>
                <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{l.message}</p>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!confirm("Apagar todo o histórico desta revenda?")) return;
                localStorage.removeItem(logKey(panelUserId));
                setLog([]);
              }}
              className="w-full text-red-400"
            >
              <Trash2 className="h-4 w-4" /> Limpar histórico
            </Button>
          </>
        )}
      </div>
    </Screen>
  );
};
