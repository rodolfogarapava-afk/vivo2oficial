import { useState, useEffect, useCallback } from "react";
import { useWhatsAppSettings } from "./useWhatsAppSettings";

interface PaymentSettings {
  paymentPhone: string;
  paymentMessageTemplate: string;
}

const PAYMENT_STORAGE_KEY = "payment-whatsapp-settings";

const DEFAULT_PAYMENT_MESSAGE = `▬▬▬▬▬▬▬▬▬▬▬▬▬
✅ *PAGAMENTO FEITO* ✅

📦 *Produto:*  Vivo 500GB
💰 *Valor:* {valor}
📅 *Data:* {data}
🕐 *Hora:* {hora}
✅ *Status:* APROVADO

🤝Obrigado pela parceria! 🙏
▬▬▬▬▬▬▬▬▬▬▬▬▬`;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const usePaymentWhatsApp = () => {
  const { settings: whatsAppSettings } = useWhatsAppSettings();
  
  const [settings, setSettings] = useState<PaymentSettings>(() => {
    const saved = localStorage.getItem(PAYMENT_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading payment settings:", e);
      }
    }
    return {
      paymentPhone: "",
      paymentMessageTemplate: DEFAULT_PAYMENT_MESSAGE,
    };
  });

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(PAYMENT_STORAGE_KEY);
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
        } catch (e) {
          console.error("Error loading payment settings:", e);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const saveSettings = useCallback((newSettings: PaymentSettings) => {
    setSettings(newSettings);
    localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(newSettings));
  }, []);

  const sendPaymentMessage = useCallback((totalValue: number, useBusiness: boolean) => {
    if (!settings.paymentPhone) {
      return { success: false, error: "Configure o número de WhatsApp para pagamento nas configurações." };
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString("pt-BR");
    const formattedTime = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    
    const message = settings.paymentMessageTemplate
      .replace("{valor}", formatCurrency(totalValue))
      .replace("{data}", formattedDate)
      .replace("{hora}", formattedTime);

    const phoneNumbers = settings.paymentPhone.replace(/\D/g, "");
    const phoneWithCountry = phoneNumbers.startsWith("55") ? phoneNumbers : `55${phoneNumbers}`;
    const encodedMessage = encodeURIComponent(message);

    const isAndroid = /android/i.test(navigator.userAgent);

    let whatsappUrl: string;

    if (isAndroid) {
      if (useBusiness) {
        whatsappUrl = `intent://send?phone=${phoneWithCountry}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
      } else {
        whatsappUrl = `intent://send?phone=${phoneWithCountry}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
      }
    } else {
      whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodedMessage}`;
    }

    window.open(whatsappUrl, "_blank");
    return { success: true };
  }, [settings]);

  return {
    settings,
    saveSettings,
    sendPaymentMessage,
    hasPaymentPhone: !!settings.paymentPhone && settings.paymentPhone.replace(/\D/g, "").length >= 10,
  };
};
