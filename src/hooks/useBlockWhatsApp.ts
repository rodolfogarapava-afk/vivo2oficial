import { useState, useEffect, useCallback } from "react";

const BLOCK_STORAGE_KEY = "block-whatsapp-settings";

interface BlockSettings {
  blockPhone: string;
  blockMessageTemplate: string;
  unblockMessageTemplate: string;
  cancelMessageTemplate: string;
}

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
};

const DEFAULT_BLOCK_MESSAGE = `{saudacao},

Poderia *BLOQUEAR*
Esse número 👉 {telefone}

📱 *Cliente:* {nome}
Cliente não efetuou o pagamento`;

const DEFAULT_UNBLOCK_MESSAGE = `{saudacao},

Poderia *DESBLOQUEAR*
Esse número 👉 {telefone}

📱 *Cliente:* {nome}
Cliente já negociou`;

const DEFAULT_CANCEL_MESSAGE = `{saudacao},

Poderia *CANCELAR* essa linha
👉 {telefone}

📱 *Cliente:* {nome}
O cliente não vai mais utilizar o plano.
Pode cancelar! ❌`;

export const useBlockWhatsApp = () => {
  const [settings, setSettings] = useState<BlockSettings>({
    blockPhone: "",
    blockMessageTemplate: DEFAULT_BLOCK_MESSAGE,
    unblockMessageTemplate: DEFAULT_UNBLOCK_MESSAGE,
    cancelMessageTemplate: DEFAULT_CANCEL_MESSAGE,
  });

  useEffect(() => {
    const saved = localStorage.getItem(BLOCK_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that cancel template has required placeholders, reset if corrupted
        let cancelTemplate = parsed.cancelMessageTemplate || DEFAULT_CANCEL_MESSAGE;
        if (!cancelTemplate.includes("{nome}") || !cancelTemplate.includes("{telefone}")) {
          cancelTemplate = DEFAULT_CANCEL_MESSAGE;
          // Fix the corrupted template in storage
          parsed.cancelMessageTemplate = cancelTemplate;
          localStorage.setItem(BLOCK_STORAGE_KEY, JSON.stringify(parsed));
        }
        setSettings({
          blockPhone: parsed.blockPhone || "",
          blockMessageTemplate: parsed.blockMessageTemplate || DEFAULT_BLOCK_MESSAGE,
          unblockMessageTemplate: parsed.unblockMessageTemplate || DEFAULT_UNBLOCK_MESSAGE,
          cancelMessageTemplate: cancelTemplate,
        });
      } catch (e) {
        console.error("Error loading block settings:", e);
      }
    }
  }, []);

  const hasBlockPhone = settings.blockPhone.trim().length > 0;

  const sendMessage = useCallback(
    (clientName: string, clientPhone: string, type: "block" | "unblock" | "cancel", useBusiness: boolean) => {
      if (!hasBlockPhone) return;

      const now = new Date();
      const formattedDate = now.toLocaleDateString("pt-BR");
      const formattedTime = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const messageTemplate = type === "block" 
        ? settings.blockMessageTemplate 
        : type === "unblock"
        ? settings.unblockMessageTemplate
        : settings.cancelMessageTemplate;

      const message = messageTemplate
        .replace("{saudacao}", getGreeting())
        .replace("{nome}", clientName)
        .replace("{telefone}", clientPhone)
        .replace("{data}", formattedDate)
        .replace("{hora}", formattedTime);

      const phoneNumbers = settings.blockPhone.replace(/\D/g, "");
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
    },
    [settings, hasBlockPhone]
  );

  const sendBlockMessage = useCallback(
    (clientName: string, clientPhone: string, isBlocking: boolean, useBusiness: boolean) => {
      sendMessage(clientName, clientPhone, isBlocking ? "block" : "unblock", useBusiness);
    },
    [sendMessage]
  );

  const sendCancelMessage = useCallback(
    (clientName: string, clientPhone: string, useBusiness: boolean, customMessage?: string) => {
      if (customMessage) {
        // Send the custom edited message directly
        if (!hasBlockPhone) return;
        const phoneNumbers = settings.blockPhone.replace(/\D/g, "");
        const phoneWithCountry = phoneNumbers.startsWith("55") ? phoneNumbers : `55${phoneNumbers}`;
        const encodedMessage = encodeURIComponent(customMessage);
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
      } else {
        sendMessage(clientName, clientPhone, "cancel", useBusiness);
      }
    },
    [sendMessage, hasBlockPhone, settings.blockPhone]
  );

  return {
    settings,
    hasBlockPhone,
    sendBlockMessage,
    sendCancelMessage,
  };
};
