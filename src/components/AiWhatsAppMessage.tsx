import { useEffect, useState } from "react";
import { Bot, Loader2, Lock, MessageCircle, RotateCcw, Save, Send, Unlock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { buildClientMessage, formatCurrency, formatPhoneDisplay } from "@/lib/whatsappMessage";
import type { Client } from "@/hooks/useClients";

interface AiWhatsAppMessageProps {
  client: Client;
  reseller: string;
  onClose: () => void;
  onSent?: (message: string, phone: string) => void;
}

export const AiWhatsAppMessage = ({ client, reseller, onClose, onSent }: AiWhatsAppMessageProps) => {
  const [clientName, setClientName] = useState(client.name);
  const [phone, setPhone] = useState(client.whatsapp || client.phone);
  const [chip, setChip] = useState(client.virtual_chip ? "Chip Virtual" : "Chip Físico");
  const [offer, setOffer] = useState(client.data_gb ? `${client.data_gb} GB` : "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMessageLocked, setIsMessageLocked] = useState(true);
  const { toast } = useToast();
  const { settings, saveSettings } = useWhatsAppSettings();

  const defaultMessage = () => buildClientMessage(settings.clientMessageTemplate, client);

  useEffect(() => {
    setClientName(client.name);
    setPhone(client.whatsapp || client.phone);
    setChip(client.virtual_chip ? "Chip Virtual" : "Chip Físico");
    setOffer(client.data_gb ? `${client.data_gb} GB` : "");
    setMessage("");
    setIsMessageLocked(true);
  }, [client]);

  const generate = async () => {
    if (!clientName.trim() || !phone.trim() || !chip.trim() || !offer.trim()) {
      toast({ title: "Preencha todos os dados", description: "Informe cliente, telefone, chip e oferta.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-whatsapp-message", {
        body: { clientName, phone, chip, offer, reseller },
      });
      if (error) {
        const context = await error.context?.json?.().catch(() => null);
        throw new Error(context?.error || error.message);
      }
      if (!data?.message) throw new Error(data?.error || "A mensagem voltou vazia.");
      setMessage(data.message);
      setIsMessageLocked(false);
    } catch (error) {
      toast({
        title: "Não foi possível gerar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Abre a mensagem padrão do painel já preenchida com os dados do cliente, pronta para editar
  const openDefaultMessage = () => {
    setMessage(defaultMessage());
    setIsMessageLocked(false);
  };

  const restoreDefault = () => {
    setMessage(defaultMessage());
    toast({ title: "Mensagem padrão restaurada", description: "O texto voltou ao padrão salvo do painel." });
  };

  // Converte os dados do cliente de volta em variáveis, para a mensagem valer para todos
  const toTemplate = (text: string) => {
    const now = new Date();
    const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pairs: Array<[string, string]> = [
      [clientName.trim(), "{nome}"],
      [formatPhoneDisplay(phone), "{telefone}"],
      [phone, "{telefone}"],
      [formatCurrency(Number(client.value_paid ?? 0)), "{valor}"],
      [now.toLocaleDateString("pt-BR"), "{data}"],
      [now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), "{hora}"],
    ];
    return pairs.reduce((acc, [from, to]) => (from ? acc.replace(new RegExp(escapeRe(from), "g"), to) : acc), text);
  };

  const saveAsDefault = () => {
    if (!message.trim()) return;
    saveSettings({ ...settings, clientMessageTemplate: toTemplate(message) });
    setIsMessageLocked(true);
    toast({ title: "Mensagem salva como padrão", description: "Ela será usada nos próximos envios deste painel." });
  };

  const send = () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits || !message.trim()) return;
    const destination = digits.startsWith("55") ? digits : `55${digits}`;
    onSent?.(message, phone);
    window.open(`https://api.whatsapp.com/send?phone=${destination}&text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-background/90 p-4">
      <div className="max-h-[92dvh] w-full max-w-sm space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-cyan-400" />
          <h3 className="min-w-0 flex-1 text-lg font-bold text-foreground">Mensagem com IA</h3>
          <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Nome do cliente" />
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="WhatsApp do cliente" inputMode="tel" />
        <Input value={chip} onChange={(event) => setChip(event.target.value)} placeholder="Dados do chip" />
        <Textarea value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="Oferta, valor, quantidade de giga e condições" className="min-h-24" />

        <Button type="button" onClick={() => void generate()} disabled={loading} className="h-11 w-full rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          {loading ? "Criando mensagem..." : "Gerar mensagem"}
        </Button>

        <Button type="button" variant="secondary" onClick={openDefaultMessage} className="h-11 w-full rounded-xl">
          <MessageCircle className="h-4 w-4" />
          Editar mensagem que vai para o WhatsApp
        </Button>

        {message && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center gap-1.5">
              <p className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">Mensagem que vai para o WhatsApp</p>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={restoreDefault}
                title="Restaurar mensagem padrão"
                className="h-8 w-8"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={saveAsDefault}
                title="Salvar como mensagem padrão"
                className="h-8 w-8"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={isMessageLocked ? "secondary" : "default"}
                onClick={() => setIsMessageLocked((value) => !value)}
                title={isMessageLocked ? "Editar mensagem" : "Travar mensagem"}
                className="h-8 w-8"
              >
                {isMessageLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </Button>
            </div>

            {isMessageLocked ? (
              <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-3 text-sm text-foreground">
                {message}
              </div>
            ) : (
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-44"
                autoFocus
              />
            )}

            <Button type="button" onClick={send} className="h-11 w-full rounded-xl bg-green-600 text-primary-foreground hover:bg-green-700">
              <Send className="h-4 w-4" />
              Enviar no WhatsApp
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
