import { Phone, Check, Globe2, Smartphone, Wifi } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Client } from "@/hooks/useClients";
import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { useBlockWhatsApp } from "@/hooks/useBlockWhatsApp";
import { isFreeLine } from "@/hooks/useFreeLineColor";
import { formatClientName } from "@/lib/formatName";
import { useToast } from "@/hooks/use-toast";
import whatsappIcon from "@/assets/whatsapp-icon.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ClientCardProps {
  valueOverride?: number;
  client: Client;
  index: number;
  onToggleVirtualChip: (id: string, virtual_chip: boolean) => void;
  onBlockClient?: (id: string, blocked: boolean) => void;
  isPaid?: boolean;
  onTogglePayment?: (clientId: string) => void;
  dayPaymentSent?: boolean;
  /** null = desconhecido (mostra o globo), true = está no gestor, false = não está */
  inPanel?: boolean | null;
  supportWhatsapp?: string | null;
  /** Reduz a altura do cartão (~20%) — usado no painel da revenda. */
  dense?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatPhoneDisplay = (phone: string) => {
  const numbers = phone.replace(/\D/g, "");
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  return phone;
};

export const ClientCard = ({ client, index, onToggleVirtualChip, onBlockClient, isPaid = false, onTogglePayment, dayPaymentSent = false, inPanel = null, supportWhatsapp = null, valueOverride, dense = false }: ClientCardProps) => {
  const showGlobe = client.company !== "nexus" && inPanel !== false;
  const showMissingPanelWarning = client.company !== "nexus" && inPanel === false;
  const { settings } = useWhatsAppSettings();
  const { hasBlockPhone, sendBlockMessage } = useBlockWhatsApp();
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showBlockConfirmDialog, setShowBlockConfirmDialog] = useState(false);
  const [paymentStampTick, setPaymentStampTick] = useState(0);

  useEffect(() => {
    const refreshStamp = () => setPaymentStampTick((v) => v + 1);
    window.addEventListener("payment-sent-updated", refreshStamp);
    window.addEventListener("storage", refreshStamp);

    return () => {
      window.removeEventListener("payment-sent-updated", refreshStamp);
      window.removeEventListener("storage", refreshStamp);
    };
  }, []);

  const dayPaymentSentFromStorage = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    try {
      const saved = localStorage.getItem("payment_sent_days");
      if (!saved) return false;

      const data = JSON.parse(saved);
      return data.month === currentMonth && Array.isArray(data.days)
        ? data.days.includes(client.due_day || 10)
        : false;
    } catch {
      return false;
    }
  }, [client.due_day, paymentStampTick]);

  const showPaymentStamp = (dayPaymentSent || dayPaymentSentFromStorage) && !client.blocked;

  const handleToggleVirtualChip = () => {
    onToggleVirtualChip(client.id, !client.virtual_chip);
  };

  const handleNumberClick = () => {
    if (!client.blocked) {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmPayment = () => {
    if (onTogglePayment) {
      onTogglePayment(client.id);
    }
    setShowConfirmDialog(false);
  };

  const handleWhatsAppClick = () => {
    if (supportWhatsapp) {
      handleWhatsApp();
      return;
    }
    // If client is blocked, clicking will unblock and send unblock message
    // If client is not blocked, clicking will send normal message OR block (show confirmation)
    if (client.blocked) {
      // Show confirmation to unblock
      setShowBlockConfirmDialog(true);
    } else {
      // Normal WhatsApp behavior - send billing message
      handleWhatsApp();
    }
  };

  const handleConfirmBlock = () => {
    if (onBlockClient) {
      if (client.blocked) {
        // Unblocking
        onBlockClient(client.id, false);
        if (hasBlockPhone) {
          sendBlockMessage(client.name, client.phone, false, settings.useBusiness);
        }
      } else {
        // Blocking
        onBlockClient(client.id, true);
        if (hasBlockPhone) {
          sendBlockMessage(client.name, client.phone, true, settings.useBusiness);
        }
      }
    }
    setShowBlockConfirmDialog(false);
  };


  const handleWhatsApp = () => {
    const destination =
      (supportWhatsapp?.replace(/\D/g, "") || client.whatsapp?.replace(/\D/g, "") || client.phone?.replace(/\D/g, "")) ?? "";
    if (!destination) {
      toast({
        title: "Telefone não cadastrado",
        description: "Edite o cliente e informe o número.",
        variant: "destructive",
      });
      return;
    }

    const phoneWithCountry = destination.startsWith("55") ? destination : `55${destination}`;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR");
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const dataAmount = Number(client.data_gb ?? 0);
    const offer = dataAmount > 0 ? `VIVO ${dataAmount.toLocaleString("pt-BR")}GB` : "VIVO";
    const message = supportWhatsapp
      ? `*👷${formatClientName(client.name)}!*▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n*🧑‍🔧SUPORTE ATUALIZAR LINHA*\n\n*📊${offer}*\n\n*📱Número: ${formatPhoneDisplay(client.phone)}*\n\n*📅Data: ${dateStr}*\n\n*🕕 Horas: ${timeStr}*\n\n*🚨SEM CONEXÃO*\n\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n*✅Preferência gera preferência✅*`
      : settings.clientMessageTemplate
        .replace(/\{nome\}/g, client.name)
        .replace(/\{telefone\}/g, formatPhoneDisplay(client.phone))
        .replace(/\{valor\}/g, formatCurrency(Number(client.value_paid)))
        .replace(/\{data\}/g, dateStr)
        .replace(/\{hora\}/g, timeStr);
    
    const encodedMessage = encodeURIComponent(message);
    
    // Detect if running on Android
    const isAndroid = /android/i.test(navigator.userAgent);
    
    let whatsappUrl: string;
    
    if (isAndroid) {
      // Use Android intent to specifically target WhatsApp Business or Regular
      if (settings.useBusiness) {
        whatsappUrl = `intent://send?phone=${phoneWithCountry}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
      } else {
        whatsappUrl = `intent://send?phone=${phoneWithCountry}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
      }
    } else {
      // For iOS and other platforms, use web URLs
      whatsappUrl = settings.useBusiness 
        ? `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodedMessage}`
        : `https://wa.me/${phoneWithCountry}?text=${encodedMessage}`;
    }
    
    window.open(whatsappUrl, "_blank");
  };

  // Long press to block (for non-blocked clients)
  const handleLongPress = () => {
    if (!client.blocked && onBlockClient) {
      setShowBlockConfirmDialog(true);
    }
  };

  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  const handleTouchStart = () => {
    if (!client.blocked) {
      pressTimer = setTimeout(handleLongPress, 800);
    }
  };

  const handleTouchEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  // Compact mode: when client is paid (and not blocked/bonus), show only name + WhatsApp button for support
  const compactMode = isPaid && !client.blocked && !client.bonus;

  // Cartão branco = empresa antiga (não Nexus). Nexus usa o tema roxo padrão.
  const isNexus = client.company !== "nexus";
  const isResale = client.is_resale === true;
  // Linha livre: nome cadastrado começando com "LIVRE" -> bordas verdes grossas, ✅ e sempre no topo.
  const isFree = !client.blocked && isFreeLine(client.name);

  // Barra de consumo de giga (franquia anotada no app)
  const totalGb = Number(client.data_gb ?? 0);
  const usedGb = Number(client.data_used_gb ?? 0);
  const usedPercent = totalGb > 0 ? Math.min(100, Math.round((usedGb / totalGb) * 100)) : 0;

  return (
    <>
      <div 
        className={`relative overflow-hidden rounded-[22px] ${compactMode ? 'p-3' : 'px-3 py-3.5'} animate-slide-up transition-all ${
          client.blocked 
            ? 'border-2 from-red-900/80 to-red-950/90 border-red-700 shadow-[0_6px_0_0_#7f1d1d] hover:shadow-[0_4px_0_0_#7f1d1d]' 
            : isFree
              ? 'border-[3px] border-free-card-border bg-free-card shadow-[0_7px_0_0_hsl(var(--free-card-deep))] active:translate-y-0.5'
              : 'border-2 border-client-card-border bg-client-card shadow-client-card active:translate-y-0.5'
        }`}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {compactMode ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleNumberClick}
               className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent shadow-client-action transition-transform active:translate-y-0.5"
              title="Desmarcar pagamento"
            >
               <Check className="h-5 w-5 text-accent-foreground" />
            </button>
            <h3 className={`flex-1 font-semibold text-sm whitespace-nowrap overflow-x-auto ${isFree ? 'text-black' : 'text-client-card-foreground'}`}>
              {isFree && <span className="mr-1">✅</span>}
              {showMissingPanelWarning && <span className="mr-1">⚠️</span>}
              {showGlobe && <Globe2 className="mr-1 inline h-4 w-4 text-client-card-highlight" />}
              {formatClientName(client.name)}
            </h3>
            {(supportWhatsapp || (settings.showClientWhatsApp && (client.whatsapp || client.phone))) && (
              <div className="flex flex-col items-center gap-1">
                {supportWhatsapp && (
                  <span className="flex items-center gap-1 whitespace-nowrap text-[9px] font-extrabold uppercase text-client-card-foreground">
                    {client.virtual_chip ? <Wifi className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                    {client.virtual_chip ? "Chip Virtual" : "Chip Físico"}
                  </span>
                )}
                <button
                  onClick={handleWhatsAppClick}
                 className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-accent shadow-client-action transition-transform active:translate-y-0.5"
                  title="Enviar suporte via WhatsApp"
                >
                  <img src={whatsappIcon} alt="WhatsApp" className="h-5 w-5 drop-shadow-sm" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[108px] items-center gap-3">
          <button
            onClick={handleNumberClick}
            disabled={client.blocked}
             className={`flex h-[76px] w-[58px] flex-shrink-0 items-center justify-center rounded-2xl transition-transform ${
              client.blocked
                ? 'bg-red-800 cursor-not-allowed'
                : isPaid 
                  ? 'bg-gradient-to-b from-green-400 to-green-600 shadow-[0_4px_0_0_#166534] hover:shadow-[0_2px_0_0_#166534]'
                    : isFree
                      ? 'bg-free-card-deep shadow-client-inset'
                       : 'bg-client-card-deep shadow-client-inset'
             } active:translate-y-0.5`}
          >
            {isPaid && !client.blocked ? (
              <Check className="h-5 w-5 text-white" />
            ) : (
               <span className={`text-[28px] font-extrabold ${
                client.blocked
                  ? 'text-red-300'
                   : isFree
                     ? 'text-client-card-foreground'
                     : 'text-client-card-foreground'
              }`}>
                {index + 1}
              </span>
            )}
          </button>
          
           <div className="min-w-0 flex-1 overflow-hidden">
             <h3 className={`overflow-x-auto whitespace-nowrap text-[17px] font-extrabold ${
              client.blocked 
                ? 'text-red-300 line-through' 
                : isFree
                  ? 'text-black'
                  : 'text-client-card-foreground'
            }`}>
              {client.phone.replace(/\D/g, "").length === 0 && <span className="mr-1">⚠️</span>}
              {isFree && <span className="mr-1">✅</span>}
              {showMissingPanelWarning && <span className="mr-1">⚠️</span>}
              {showGlobe && <Globe2 className="mr-1 inline h-4 w-4 text-client-card-highlight" />}
              {formatClientName(client.name)}
              {client.blocked && <span className="ml-2 text-[10px] font-bold text-red-400 no-underline">(BLOQUEADO)</span>}
              {client.bonus && !client.blocked && <span className="ml-2 text-[10px] font-bold text-yellow-600">★ BÔNUS</span>}
            </h3>
             <div className={`mt-0.5 flex items-center gap-1.5 ${client.blocked ? 'text-muted-foreground' : isFree ? 'text-black/70' : 'text-client-card-muted'}`}>
               <Phone className="h-4 w-4 flex-shrink-0" />
               <span className={`whitespace-nowrap text-[14px] font-medium ${client.blocked ? 'line-through text-red-400/60' : ''}`}>{formatPhoneDisplay(client.phone)}</span>
            </div>
              <p className={`mt-1 text-[22px] font-extrabold leading-none ${
              client.blocked
                ? 'text-red-400 line-through'
                : isFree
                  ? 'text-green-700'
                  : 'text-client-card-foreground'
            }`}>
              {formatCurrency(valueOverride ?? (client.bonus ? 0 : Number(client.value_paid)))}
              {Number(client.data_gb ?? 0) > 0 && (
                  <span className={`ml-3 text-[17px] font-extrabold ${client.blocked ? 'text-blue-400' : isFree ? 'text-black/70' : 'text-client-card-muted'}`}>
                  {Number(client.data_gb)} GB
                </span>
              )}
            </p>

            {totalGb > 0 && (
               <div className="mt-3">
                  <div className={`h-3 w-full overflow-hidden rounded-full shadow-client-inset ${isFree ? 'bg-black/10' : 'bg-client-card-deep'}`}>
                  <div
                    className={`h-full rounded-full transition-all ${
                       usedPercent >= 100 ? 'bg-destructive' : usedPercent >= 80 ? 'bg-warning' : 'bg-client-card-highlight'
                    }`}
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
                  <p className={`mt-1.5 whitespace-nowrap text-[12px] font-semibold ${
                  usedPercent >= 100
                    ? 'text-red-500'
                    : client.blocked
                      ? 'text-muted-foreground'
                      : isFree
                        ? 'text-black/70'
                         : 'text-client-card-muted'
                }`}>
                  {usedGb} de {totalGb} GB usados ({usedPercent}%)
                  {usedPercent >= 100 && " • franquia esgotada"}
                </p>
              </div>
            )}

          </div>
          
          
           <div className="flex flex-shrink-0 flex-col items-center gap-1">
              {supportWhatsapp && (
                 <span className="flex items-center gap-1 whitespace-nowrap text-[9px] font-extrabold uppercase text-client-card-muted">
                  {client.virtual_chip ? <Wifi className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                  {client.virtual_chip ? "Chip Virtual" : "Chip Físico"}
                </span>
              )}
              <div className="flex gap-2">
                {/* WhatsApp button */}
                {(supportWhatsapp || (settings.showClientWhatsApp && (client.whatsapp || client.phone))) && <button
                  onClick={handleWhatsAppClick}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={handleTouchStart}
                  onMouseUp={handleTouchEnd}
                  onMouseLeave={handleTouchEnd}
                    className={`flex h-[76px] w-[58px] items-center justify-center rounded-2xl transition-transform ${
                    client.blocked || client.name.toUpperCase().includes("CANCELADO")
                      ? 'bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 shadow-[0_4px_0_0_#7f1d1d] hover:shadow-[0_2px_0_0_#7f1d1d]'
                       : 'bg-accent shadow-client-action'
                  } active:translate-y-0.5`}
                >
                    <img src={whatsappIcon} alt="WhatsApp" className="h-9 w-9 drop-shadow-sm" />
                </button>}
              </div>
          </div>
        </div>
        )}


        {/* Inline Payment Confirmation Overlay */}
        {showConfirmDialog && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 rounded-xl backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <p className="text-white text-sm font-semibold text-center px-2">
                {isPaid ? `Desmarcar ${client.name}?` : `Cadastrar ${client.name}?`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-1.5 rounded-lg bg-gray-600 text-white text-xs font-bold hover:bg-gray-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmPayment}
                  className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold transition-colors ${
                    isPaid ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Block/Unblock Confirmation Dialog */}
      <AlertDialog open={showBlockConfirmDialog} onOpenChange={setShowBlockConfirmDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className={client.blocked ? "text-green-500" : "text-red-500"}>
              {client.blocked ? 'Desbloquear cliente?' : 'Bloquear cliente?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              {client.blocked 
                ? `Desbloquear ${client.name}? ${hasBlockPhone ? 'Uma mensagem será enviada via WhatsApp.' : ''}`
                : `Bloquear ${client.name}? ${hasBlockPhone ? 'Uma mensagem será enviada via WhatsApp.' : ''}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-secondary-foreground border-border">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmBlock}
              className={`${
                client.blocked
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {client.blocked ? 'Desbloquear' : 'Bloquear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
