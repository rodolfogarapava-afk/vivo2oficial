import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star } from "lucide-react";
import { Client } from "@/hooks/useClients";

interface BonusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
}

const formatPhone = (phone: string) => {
  const n = phone.replace(/\D/g, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  return phone;
};

export const BonusModal = ({ open, onOpenChange, clients }: BonusModalProps) => {
  const bonusClients = useMemo(
    () =>
      clients
        .filter((c) => c.bonus && !c.name.toUpperCase().includes("CANCELADO"))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [clients]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-yellow-400 max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            Clientes Bônus
            <span className="ml-auto text-xs font-normal text-gray-600">
              {bonusClients.length} {bonusClients.length === 1 ? "cliente" : "clientes"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {bonusClients.length === 0 ? (
          <div className="py-10 text-center">
            <Star className="mx-auto h-10 w-10 text-yellow-400/60 mb-2" />
            <p className="text-sm text-gray-700">Nenhum cliente bônus.</p>
            <p className="text-xs text-gray-500 mt-1">
              Marque "Bônus" ao editar um cliente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {bonusClients.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-yellow-300 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate">{c.name}</p>
                    <p className="text-xs text-gray-600">{formatPhone(c.phone)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 rounded-full px-2 py-0.5">
                      DIA {c.due_day || 10}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
