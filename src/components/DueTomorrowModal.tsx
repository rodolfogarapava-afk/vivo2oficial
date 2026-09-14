import { createPortal } from "react-dom";
import { ArrowLeft, MessageCircle, Check, CalendarClock } from "lucide-react";
import { Client } from "@/hooks/useClients";
import { formatClientName } from "@/lib/formatName";
import { formatCurrency, formatPhoneDisplay, openClientWhatsApp } from "@/lib/whatsappMessage";

interface DueTomorrowModalProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  template: string;
  useBusiness: boolean;
  onTogglePayment: (clientId: string) => void;
}

export const DueTomorrowModal = ({
  open,
  onClose,
  clients,
  template,
  useBusiness,
  onTogglePayment,
}: DueTomorrowModalProps) => {
  if (!open) return null;

  const total = clients.reduce((sum, c) => sum + Number(c.value_paid || 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-[9998] bg-black/60 p-4">
      <div className="mx-auto flex h-[85dvh] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl bg-purple-800 p-4">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Voltar"
            className="rounded-lg bg-purple-900/70 p-2 text-white active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-white">
              <CalendarClock className="h-4 w-4 text-purple-300" />
              Vence amanhã
            </h3>
            <p className="text-[11px] text-purple-200">
              {clients.length} {clients.length === 1 ? "cliente" : "clientes"} •{" "}
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 touch-pan-y">
          {clients.length === 0 && (
            <p className="rounded-xl bg-purple-900/60 p-3 text-sm text-purple-100">
              Ninguém para cobrar amanhã.
            </p>
          )}

          {clients.map((client) => (
            <div key={client.id} className="rounded-xl bg-purple-900/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm font-bold text-white">
                  {formatClientName(client.name)}
                </p>
                <p className="shrink-0 text-xs font-bold text-green-400 tabular-nums">
                  {formatPhoneDisplay(client.phone)}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-purple-200">
                {formatCurrency(Number(client.value_paid))} • dia {client.due_day ?? 10}
              </p>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openClientWhatsApp(client, template, useBusiness)}
                  className="flex items-center justify-center gap-1 rounded-lg bg-green-600 px-2 py-2 text-xs font-extrabold text-white active:scale-95"
                  aria-label={`Cobrar ${client.name} no WhatsApp`}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Cobrar
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePayment(client.id)}
                  className="flex items-center justify-center gap-1 rounded-lg border border-purple-500/70 bg-purple-950/40 px-2 py-2 text-xs font-bold text-white active:scale-95"
                  aria-label={`Marcar ${client.name} como pago`}
                >
                  <Check className="h-3.5 w-3.5" />
                  Já pagou
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};
