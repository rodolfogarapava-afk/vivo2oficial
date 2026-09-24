import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  useBusiness: settings.useBusiness ?? true,
  showClientWhatsApp: settings.showClientWhatsApp ?? true,
  clientMessageTemplate:
    settings.clientMessageTemplate && !LEGACY_CLIENT_MESSAGES.includes(settings.clientMessageTemplate)
      ? settings.clientMessageTemplate
      : DEFAULT_CLIENT_MESSAGE,
});

// Reads what is saved on this device
const readStoredSettings = (): WhatsAppSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return withDefaults(JSON.parse(saved));
  } catch (e) {
    console.error("Error loading WhatsApp settings:", e);
  }
  return withDefaults({});
};

// Creates the account record when it is missing, or updates the saved values
const saveProfileToCloud = async (
  userId: string,
  values: { showClientWhatsApp: boolean; clientMessageTemplate: string }
) => {
  try {
    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          whatsapp_show_card: values.showClientWhatsApp,
          whatsapp_client_message: values.clientMessageTemplate,
        },
        { onConflict: "user_id" }
      );
    if (error) console.error("Erro ao salvar o WhatsApp na nuvem:", error.message);
  } catch (err) {
    console.error("Erro ao salvar o WhatsApp na nuvem:", err);
  }
};

// Custom event for settings updates
const SETTINGS_UPDATED_EVENT = "whatsapp-settings-updated";

type CloudClientSettings = {
  showClientWhatsApp: boolean;
  clientMessageTemplate: string;
};

let cloudSettingsPromise: Promise<CloudClientSettings | null> | null = null;

// ClientCard uses this hook once per card. Share the cloud request so opening a
// list with many clients never performs the same account lookup dozens of times.
const loadCloudSettings = () => {
  if (cloudSettingsPromise) return cloudSettingsPromise;

  cloudSettingsPromise = (async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return null;

    const { data } = await supabase
      .from("profiles")
      .select("whatsapp_show_card, whatsapp_client_message")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      const stored = readStoredSettings();
      await saveProfileToCloud(userId, {
        showClientWhatsApp: stored.showClientWhatsApp,
        clientMessageTemplate: stored.clientMessageTemplate,
      });
      return {
        showClientWhatsApp: stored.showClientWhatsApp,
        clientMessageTemplate: stored.clientMessageTemplate,
      };
    }

    const stored = readStoredSettings();
    return {
      showClientWhatsApp:
        data.whatsapp_show_card === null || data.whatsapp_show_card === undefined
          ? stored.showClientWhatsApp
          : data.whatsapp_show_card,
      clientMessageTemplate: data.whatsapp_client_message ?? stored.clientMessageTemplate,
    };
  })().catch((error) => {
    cloudSettingsPromise = null;
    throw error;
  });

  return cloudSettingsPromise;
};

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
    return withDefaults({});
  });

  // Load client WhatsApp settings from the cloud so they survive cache cleanup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadCloudSettings();
        if (cancelled || !data) return;
        setSettings((prev) => {
          const merged = withDefaults({
            ...prev,
            showClientWhatsApp: data.showClientWhatsApp,
            clientMessageTemplate: data.clientMessageTemplate,
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) return;
        await saveProfileToCloud(userId, {
          showClientWhatsApp: newSettings.showClientWhatsApp,
          clientMessageTemplate: newSettings.clientMessageTemplate,
        });
      } catch {}
    })();
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
