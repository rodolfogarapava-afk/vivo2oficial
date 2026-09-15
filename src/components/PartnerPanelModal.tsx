import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Signal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatClientName } from "@/lib/formatName";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PartnerLine {
  id: string;
  name: string;
  phone: string;
  value_paid: number | null;
  blocked: boolean;
  data_gb: number | null;
  data_used_gb: number | null;
}

interface PartnerPanelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** User id of the linked panel (resale). */
  partnerUserId?: string;
  panelLabel?: string;
}

const formatPhone = (value: string) => {
  const d = (value || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
};

const money = (value: number | null) =>
  `R$ ${Number(value ?? 0).toFixed(2).replace(".", ",")}`;

export const PartnerPanelModal = ({
  open,
  onOpenChange,
  partnerUserId,
  panelLabel,
}: PartnerPanelModalProps) => {
  const label = (panelLabel || "CHIP NET").toUpperCase();
  const [lines, setLines] = useState<PartnerLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!partnerUserId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: PartnerLine[] | null; error: { message: string } | null }>)(
        "list_panel_clients",
        { p_panel_user: partnerUserId },
      );
      if (rpcError) throw new Error(rpcError.message);
      setLines(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as linhas.");
    } finally {
      setLoading(false);
    }
  }, [partnerUserId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[92vw] rounded-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Signal className="h-5 w-5 text-cyan-400" />
            Painel {label}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">
            {loading ? "Carregando..." : `${lines.length} linha(s)`}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 text-[11px] font-extrabold uppercase tracking-wider text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>

        {loading && lines.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-foreground/60" />
          </div>
        ) : error ? (
          <p className="text-xs font-semibold text-red-400">{error}</p>
        ) : lines.length === 0 ? (
          <p className="text-xs leading-snug text-muted-foreground">
            Nenhuma linha nesse painel ainda.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {lines.map((line, index) => {
              const isFree = !line.name?.trim() || line.name.trim().toUpperCase() === "LIVRE";
              return (
                <div
                  key={line.id}
                  className={`flex items-center gap-2 rounded-xl border p-2 ${
                    isFree
                      ? "border-green-500/60 bg-green-950/30"
                      : line.blocked
                        ? "border-red-500/50 bg-red-950/30"
                        : "border-border bg-secondary/50"
                  }`}
                >
                  <span className="w-6 shrink-0 text-center text-[11px] font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">
                      {isFree ? "Livre" : formatClientName(line.name)}
                    </p>
                    <p className="text-[11px] font-semibold text-green-400">{formatPhone(line.phone)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-extrabold text-foreground">{money(line.value_paid)}</p>
                    {Number(line.data_gb ?? 0) > 0 && (
                      <p className="text-[10px] font-semibold text-cyan-400">
                        {Number(line.data_used_gb ?? 0)}/{Number(line.data_gb)} GB
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] leading-snug text-muted-foreground">
          Estas são as linhas do painel {label}. Aqui é só para conferir — as alterações são feitas no painel dele.
        </p>
      </DialogContent>
    </Dialog>
  );
};
