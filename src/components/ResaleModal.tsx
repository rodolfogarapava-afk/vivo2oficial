import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Check, ShoppingCart, Store, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Client } from "@/hooks/useClients";

interface ResaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatPhone = (phone: string) => {
  const n = phone.replace(/\D/g, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  return phone;
};

const getReseller = (name: string) => {
  const idx = name.indexOf("-");
  return (idx >= 0 ? name.slice(0, idx) : name).trim() || "Sem nome";
};

const getClientLabel = (name: string) => {
  const idx = name.indexOf("-");
  return (idx >= 0 ? name.slice(idx + 1) : name).trim();
};

export const ResaleModal = ({ open, onOpenChange, clients }: ResaleModalProps) => {
  const { toast } = useToast();
  const [copiedReseller, setCopiedReseller] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Client[]>();
    clients
      .filter((c) => c.is_resale && !c.name.toUpperCase().includes("CANCELADO"))
      .forEach((c) => {
        const key = getReseller(c.name);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([reseller, list]) => ({
        reseller,
        clients: list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      }));
  }, [clients]);

  const handleCopy = (e: React.MouseEvent, reseller: string, list: Client[]) => {
    e.stopPropagation();
    const text = [
      `📦 *Revenda ${reseller}*`,
      ...list.map((c) => {
        const label = getClientLabel(c.name);
        return `• ${label} — ${formatPhone(c.phone)} — ${formatCurrency(Number(c.value_paid))} — dia ${c.due_day || 10}`;
      }),
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopiedReseller(reseller);
      toast({ title: "Copiado!", description: `Linhas de ${reseller} copiadas.` });
      setTimeout(() => setCopiedReseller(null), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-purple-900/60 w-[calc(100vw-1rem)] max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ShoppingCart className="h-5 w-5 text-purple-300" />
            Revendas
            <span className="ml-auto text-xs font-normal text-purple-300">
              {groups.length} {groups.length === 1 ? "revendedor" : "revendedores"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {groups.length === 0 ? (
          <div className="py-10 text-center">
            <Store className="mx-auto h-10 w-10 text-purple-400/50 mb-2" />
            <p className="text-sm text-purple-200">Nenhum cliente de revenda.</p>
            <p className="text-xs text-purple-300/70 mt-1">
              Marque "Revenda" no cadastro do cliente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map(({ reseller, clients: list }) => {
              const copied = copiedReseller === reseller;
              const isOpen = expanded === reseller;
              const total = list.reduce((s, c) => s + Number(c.value_paid), 0);
              const uniqueDays = Array.from(
                new Set(list.map((c) => c.due_day || 10))
              ).sort((a, b) => a - b);
              const byDay = uniqueDays.map((day) => ({
                day,
                items: list.filter((c) => (c.due_day || 10) === day),
              }));
              return (
                <div
                  key={reseller}
                  className={`rounded-xl border transition-all ${
                    copied
                      ? "border-green-500 bg-green-500/10"
                      : "border-purple-900/60 bg-purple-950/30"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : reseller)}
                    className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-purple-900/30 rounded-xl"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-purple-300 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-purple-300 flex-shrink-0" />
                      )}
                      <Store className="h-4 w-4 text-purple-300 flex-shrink-0" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-white text-sm truncate">{reseller}</span>
                          <span className="text-[10px] font-semibold text-purple-300 bg-purple-900/50 rounded-full px-2 py-0.5 flex-shrink-0">
                            {list.length}
                          </span>
                        </div>
                        <span className="text-[10px] text-purple-300 mt-0.5 truncate">
                          📅 Dia {uniqueDays.join(", ")}
                        </span>
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleCopy(e, reseller, list)}
                      className="flex items-center justify-center h-7 w-7 rounded-lg bg-purple-900/50 hover:bg-purple-800 flex-shrink-0"
                      title="Copiar linhas"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-purple-300" />
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3">
                      <div className="space-y-3 border-l-2 border-purple-700/40 pl-3 ml-1">
                        {byDay.map(({ day, items }) => (
                          <div key={day} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-purple-200 bg-purple-900/60 rounded-full px-2 py-0.5">
                                📅 Dia {day}
                              </span>
                              <span className="text-[10px] text-purple-400">
                                {items.length} {items.length === 1 ? "cliente" : "clientes"}
                              </span>
                            </div>
                            {items.map((c) => (
                              <div key={c.id} className="flex flex-col gap-0.5 text-xs min-w-0 pl-1">
                                <span className="text-white truncate">{getClientLabel(c.name)}</span>
                                <span className="text-purple-300 text-[10px] truncate">
                                  {formatPhone(c.phone)} · {formatCurrency(Number(c.value_paid))}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-purple-800/40 flex justify-between text-[10px]">
                        <span className="text-purple-300">Total</span>
                        <span className="font-bold text-green-400">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          </div>
        )}

        <p className="text-[10px] text-center text-purple-300/70 pt-1">
          Toque no revendedor para ver os clientes. Use o ícone de cópia para copiar.
        </p>
      </DialogContent>
    </Dialog>
  );
};
