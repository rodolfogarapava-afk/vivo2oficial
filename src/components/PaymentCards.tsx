import whatsappIcon from "@/assets/whatsapp-icon.png";
import { usePaymentWhatsApp } from "@/hooks/usePaymentWhatsApp";
import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { useToast } from "@/hooks/use-toast";

interface PaymentCardsProps {
  totalDay10: number;
  totalDay15: number;
  totalDay20: number;
  remainingDay10: number;
  remainingDay15: number;
  remainingDay20: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const PaymentCards = ({ 
  totalDay10, 
  totalDay15,
  totalDay20, 
  remainingDay10, 
  remainingDay15,
  remainingDay20 
}: PaymentCardsProps) => {
  const { sendPaymentMessage, hasPaymentPhone } = usePaymentWhatsApp();
  const { settings: whatsAppSettings } = useWhatsAppSettings();
  const { toast } = useToast();

  const handleSendPayment = (day: 10 | 15 | 20) => {
    const totalValue = day === 10 ? totalDay10 : day === 15 ? totalDay15 : totalDay20;
    
    if (!hasPaymentPhone) {
      toast({
        title: "Configure o WhatsApp",
        description: "Vá em Configurações → Pagamento e defina o número.",
        variant: "destructive",
      });
      return;
    }

    const result = sendPaymentMessage(totalValue, whatsAppSettings.useBusiness);
    
    if (!result.success && result.error) {
      toast({
        title: "Erro",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3 mx-4 mt-4">
      {/* DIA 10 Card */}
      <button
        onClick={() => handleSendPayment(10)}
        className="relative bg-purple-900/50 rounded-xl p-3 text-center transition-all hover:bg-purple-900/70 active:scale-[0.98] group"
      >
        {/* WhatsApp Icon */}
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
          <img src={whatsappIcon} alt="WhatsApp" className="h-3 w-3" />
        </div>
        
        <p className="text-xs text-white/60 mb-1">DIA 10</p>
        <p className="text-base font-bold text-white">{formatCurrency(totalDay10)}</p>
        <div className="border-t border-white/20 mt-2 pt-2">
          <p className="text-[9px] text-white/50">Restante:</p>
          <p className="text-xs font-semibold text-yellow-400">{formatCurrency(remainingDay10)}</p>
        </div>
      </button>

      {/* DIA 15 Card */}
      <button
        onClick={() => handleSendPayment(15)}
        className="relative bg-purple-900/50 rounded-xl p-3 text-center transition-all hover:bg-purple-900/70 active:scale-[0.98] group"
      >
        {/* WhatsApp Icon */}
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
          <img src={whatsappIcon} alt="WhatsApp" className="h-3 w-3" />
        </div>
        
        <p className="text-xs text-white/60 mb-1">DIA 15</p>
        <p className="text-base font-bold text-white">{formatCurrency(totalDay15)}</p>
        <div className="border-t border-white/20 mt-2 pt-2">
          <p className="text-[9px] text-white/50">Restante:</p>
          <p className="text-xs font-semibold text-yellow-400">{formatCurrency(remainingDay15)}</p>
        </div>
      </button>

      {/* DIA 20 Card */}
      <button
        onClick={() => handleSendPayment(20)}
        className="relative bg-purple-900/50 rounded-xl p-3 text-center transition-all hover:bg-purple-900/70 active:scale-[0.98] group"
      >
        {/* WhatsApp Icon */}
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
          <img src={whatsappIcon} alt="WhatsApp" className="h-3 w-3" />
        </div>
        
        <p className="text-xs text-white/60 mb-1">DIA 20</p>
        <p className="text-base font-bold text-white">{formatCurrency(totalDay20)}</p>
        <div className="border-t border-white/20 mt-2 pt-2">
          <p className="text-[9px] text-white/50">Restante:</p>
          <p className="text-xs font-semibold text-yellow-400">{formatCurrency(remainingDay20)}</p>
        </div>
      </button>
    </div>
  );
};
