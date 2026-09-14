import { useState, useEffect, useCallback } from "react";

interface WhatsAppSettings {
  destinationPhone: string;
  messageTemplate: string;
  useBusiness: boolean;
  showClientWhatsApp: boolean;
  clientMessageTemplate: string;
}

const DEFAULT_MESSAGE = `🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
🧑‍🔧{saudacao} *Renata* 
•Preciso de suporte⚙️

🫵*{nome}*
📶 *{chip}*
Me avisou que está sem internet no

📱 Telefone VIVO:  *{telefone}*

•✈️ Já fez o procedimento
e não voltou o Sinal *VIVO*.

🚫 *SEM INTERNET*👎

*♻️Pode atualizar a linha!*`;

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "Bom dia";
  } else if (hour >= 12 && hour < 18) {
    return "Boa tarde";
  } else {
    return "Boa noite";
  }
};

const formatPhoneForMessage = (phone: string): string => {
  const numbers = phone.replace(/\D/g, "");
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  return phone;
};

const STORAGE_KEY = "whatsapp-settings";
const LEGACY_CLIENT_MESSAGES = ["", "Olá, {nome}!"];
const DEFAULT_CLIENT_MESSAGE = `*👷{nome}!*

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

*♻️LINHA ATUALIZADA♻️*



*🚨Ativa e desativa modo ✈️ avião*



*🌐VIVO 200GB*

*📱Número: {telefone}*

*📅Data: {data}*

*🕕 Horas: {hora}*

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

*✅Preferência gera preferência✅*`;

const withDefaults = (settings: Partial<WhatsAppSettings>): WhatsAppSettings => ({
  destinationPhone: settings.destinationPhone ?? "",
  messageTemplate: settings.messageTemplate ?? DEFAULT_MESSAGE,
  useBusiness: settings.useBusiness ?? false,
  showClientWhatsApp: settings.showClientWhatsApp ?? true,
  clientMessageTemplate:
    settings.clientMessageTemplate && !LEGACY_CLIENT_MESSAGES.includes(settings.clientMessageTemplate)
      ? settings.clientMessageTemplate
      : DEFAULT_CLIENT_MESSAGE,
});

// Custom event for settings updates
const SETTINGS_UPDATED_EVENT = "whatsapp-settings-updated";

export const useWhatsAppSettings = () => {
  const [settings, setSettings] = useState<WhatsAppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return withDefaults(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading WhatsApp settings:", e);
      }
    }
    return {
      destinationPhone: "",
      messageTemplate: DEFAULT_MESSAGE,
      useBusiness: false,
      showClientWhatsApp: false,
      clientMessageTemplate: DEFAULT_CLIENT_MESSAGE,
    };
  });

  // Listen for settings updates from other components
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setSettings(withDefaults(JSON.parse(saved)));
        } catch (e) {
          console.error("Error loading WhatsApp settings:", e);
        }
      }
    };

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleStorageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const saveSettings = useCallback((newSettings: WhatsAppSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    // Dispatch event to notify other components
    window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
  }, []);

  const formatMessage = useCallback((clientName: string, clientPhone: string, clientValue: string, virtualChip: boolean = false) => {
    const chipType = virtualChip ? "Chip Virtual" : "Chip Físico";
    return settings.messageTemplate
      .replace("{saudacao}", getGreeting())
      .replace("{nome}", clientName)
      .replace("{chip}", chipType)
      .replace("{telefone}", formatPhoneForMessage(clientPhone))
      .replace("{valor}", clientValue);
  }, [settings.messageTemplate]);

  return {
    settings,
    saveSettings,
    formatMessage,
    hasDestination: !!settings.destinationPhone && settings.destinationPhone.replace(/\D/g, "").length >= 10,
  };
};
