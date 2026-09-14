import { Client } from "@/hooks/useClients";

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
};

export const formatPhoneDisplay = (phone: string) => {
  const numbers = (phone || "").replace(/\D/g, "");
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  return phone;
};

/**
 * Substitui as tags da mensagem do WhatsApp pelos dados do cliente.
 * Tags suportadas: {nome} {telefone} {valor} {data} {hora}
 */
export const buildClientMessage = (template: string, client: Client) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (template || "")
    .replace(/\{nome\}/g, client.name)
    .replace(/\{telefone\}/g, formatPhoneDisplay(client.phone))
    .replace(/\{valor\}/g, formatCurrency(Number(client.value_paid)))
    .replace(/\{data\}/g, dateStr)
    .replace(/\{hora\}/g, timeStr);
};

/**
 * Abre o WhatsApp do cliente com a mensagem pronta.
 * Usa o WhatsApp cadastrado no cliente e, se não houver, o telefone da linha.
 */
export const openClientWhatsApp = (
  client: Client,
  template: string,
  useBusiness: boolean
): boolean => {
  const destination =
    client.whatsapp?.replace(/\D/g, "") || client.phone?.replace(/\D/g, "") || "";
  if (!destination) return false;

  const phoneWithCountry = destination.startsWith("55") ? destination : `55${destination}`;
  const encodedMessage = encodeURIComponent(buildClientMessage(template, client));

  let whatsappUrl: string;
  if (/android/i.test(navigator.userAgent)) {
    const pkg = useBusiness ? "com.whatsapp.w4b" : "com.whatsapp";
    whatsappUrl = `intent://send?phone=${phoneWithCountry}&text=${encodedMessage}#Intent;scheme=whatsapp;package=${pkg};end`;
  } else {
    whatsappUrl = useBusiness
      ? `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodedMessage}`
      : `https://wa.me/${phoneWithCountry}?text=${encodedMessage}`;
  }

  window.open(whatsappUrl, "_blank");
  return true;
};
