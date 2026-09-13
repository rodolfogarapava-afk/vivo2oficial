import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Download, FileText, Copy, Check, MessageCircle, Save, ArrowLeft, Palette, Pencil, Trash2, X, Users, Lock, LockOpen, Unlock, Building2, RefreshCw, CloudDownload, CreditCard, Send, Ban, Search, Star, Store, ShoppingCart, Eye, EyeOff, Calendar, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Client } from "@/hooks/useClients";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { useAccounts } from "@/hooks/useAccounts";

import whatsappIcon from "@/assets/whatsapp-icon.png";
import { useFixedExpense } from "@/hooks/useFixedExpense";
import { ALL_DUE_DAYS, useVisibleDueDays } from "@/lib/dueDays";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  fixedExpense: number;
  onDeleteClient: (id: string) => void;
  onEditClient: (id: string, data: { name: string; phone: string; value_paid: number; due_day: number; bonus: boolean; is_resale: boolean; company: string; account: number | null }) => void;
  onBlockClient: (id: string, blocked: boolean) => void;
  onRefresh?: () => void;
  totalsByDay: Record<number, number>;
  remainingByDay: Record<number, number>;
  onResaleClick?: () => void;
  showPaymentCards?: boolean;
  onTogglePaymentCards?: () => void;
  onPaymentSent?: (days: number[]) => void;
  onCancelClick?: () => void;
  onBlockClick?: () => void;
  onUnblockClick?: () => void;
  hasBlockedClients?: boolean;
  totalGross?: number;
  totalProfit?: number;
  totalExpenses?: number;
  totalClients?: number;
  showAccountCounts?: boolean;
  onSetShowAccountCounts?: (value: boolean) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const PAYMENT_STORAGE_KEY = "payment-whatsapp-settings";
const BLOCK_STORAGE_KEY = "block-whatsapp-settings";

interface PaymentSettings {
  paymentPhone: string;
  paymentMessageTemplate: string;
  paymentUseBusiness?: boolean;
}

interface BlockSettings {
  blockPhone: string;
  blockMessageTemplate: string;
  unblockMessageTemplate: string;
  cancelMessageTemplate: string;
}

const DEFAULT_PAYMENT_MESSAGE = `▬▬▬▬▬▬▬▬▬▬▬▬▬
✅ *PAGAMENTO FEITO* ✅

📦 *Produto:*  Vivo 500GB
💰 *Valor:* {valor}
📅 *Data:* {data}
🕐 *Hora:* {hora}
✅ *Status:* APROVADO

🤝Obrigado pela parceria! 🙏
▬▬▬▬▬▬▬▬▬▬▬▬▬`;

const DEFAULT_BLOCK_MESSAGE = `🚫 *BLOQUEAR NÚMERO* 🚫

📱 *Cliente:* {nome}
📞 *Número para bloquear:*
👉 {telefone}

📅 *Data:* {data}
🕐 *Hora:* {hora}

Por favor, *BLOQUEAR* o número acima.`;

const DEFAULT_UNBLOCK_MESSAGE = `✅ *DESBLOQUEAR NÚMERO* ✅

📱 *Cliente:* {nome}
📞 *Número para desbloquear:*
👉 {telefone}

📅 *Data:* {data}
🕐 *Hora:* {hora}

Por favor, *DESBLOQUEAR* o número acima.`;

const DEFAULT_CANCEL_MESSAGE = `❌ *CANCELAR LINHA* ❌

📱 *Cliente:* {nome}
📞 *Número para cancelar:*
👉 {telefone}

📅 *Data:* {data}
🕐 *Hora:* {hora}

O cliente não vai mais utilizar o plano.
Por favor, *CANCELAR* a linha acima.`;

const getPaymentSettings = (): PaymentSettings => {
  const saved = localStorage.getItem(PAYMENT_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as PaymentSettings;
      // Migrate old default template to new one
      if (parsed.paymentMessageTemplate?.includes("PAGAMENTO APROVADO")) {
        parsed.paymentMessageTemplate = DEFAULT_PAYMENT_MESSAGE;
      }
      return parsed;
    } catch (e) {
      console.error("Error loading payment settings:", e);
    }
  }
  return {
    paymentPhone: "",
    paymentMessageTemplate: DEFAULT_PAYMENT_MESSAGE,
    paymentUseBusiness: false,
  };
};

const savePaymentSettings = (settings: PaymentSettings) => {
  localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(settings));
};

const getBlockSettings = (): BlockSettings => {
  const saved = localStorage.getItem(BLOCK_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Error loading block settings:", e);
    }
  }
  return {
    blockPhone: "",
    blockMessageTemplate: DEFAULT_BLOCK_MESSAGE,
    unblockMessageTemplate: DEFAULT_UNBLOCK_MESSAGE,
    cancelMessageTemplate: DEFAULT_CANCEL_MESSAGE,
  };
};

const saveBlockSettings = (settings: BlockSettings) => {
  localStorage.setItem(BLOCK_STORAGE_KEY, JSON.stringify(settings));
};

export const SettingsModal = ({ open, onOpenChange, clients, fixedExpense, onDeleteClient, onEditClient, onBlockClient, onRefresh, totalsByDay, remainingByDay, onResaleClick, showPaymentCards, onTogglePaymentCards, onPaymentSent, onCancelClick, onBlockClick, onUnblockClick, hasBlockedClients, totalGross = 0, totalProfit = 0, totalExpenses = 0, totalClients = 0, showAccountCounts = true, onSetShowAccountCounts }: SettingsModalProps) => {
  const { visibleDays, toggleDay } = useVisibleDueDays();
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const { toast } = useToast();
  const { settings: whatsAppSettings, saveSettings: saveWhatsAppSettings } = useWhatsAppSettings();
  const { settings: themeSettings, saveSettings: saveThemeSettings, setMode: setThemeMode, colors } = useThemeSettings();
  const { accounts, count: accountsCount, labels: accountLabels, setLabel: setAccountLabel, increase: increaseAccounts, decrease: decreaseAccounts } = useAccounts();

  
  const [destinationPhone, setDestinationPhone] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [useBusiness, setUseBusiness] = useState(false);
  const [isMessageLocked, setIsMessageLocked] = useState(true);
  const [isPhoneLocked, setIsPhoneLocked] = useState(true);
  
  // Payment settings state
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentMessage, setPaymentMessage] = useState(DEFAULT_PAYMENT_MESSAGE);
  const [paymentUseBusiness, setPaymentUseBusiness] = useState(false);
  const [isPaymentPhoneLocked, setIsPaymentPhoneLocked] = useState(true);
  const [isPaymentMessageLocked, setIsPaymentMessageLocked] = useState(true);
  const [selectedPaymentDay, setSelectedPaymentDay] = useState<number>(10);

  // Track which days had payment sent this month
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const [sentPaymentDays, setSentPaymentDays] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("payment_sent_days");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.month === getCurrentMonth()) return data.days;
      }
    } catch {}
    return [];
  });
  
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editDueDay, setEditDueDay] = useState<number>(10);
  const [editBonus, setEditBonus] = useState<boolean>(false);
  const [editIsResale, setEditIsResale] = useState<boolean>(false);
  const [editCompany, setEditCompany] = useState<string>("omega");
  const [editAccount, setEditAccount] = useState<number | null>(null);


  // Fixed expense settings
  const { fixedExpense: currentFixedExpense, setFixedExpense } = useFixedExpense();
  const [expenseInput, setExpenseInput] = useState<string>(String(currentFixedExpense));
  useEffect(() => {
    setExpenseInput(String(currentFixedExpense));
  }, [currentFixedExpense]);

  const handleSaveExpense = () => {
    const v = Number(expenseInput.replace(",", "."));
    if (Number.isNaN(v) || v < 0) {
      toast({ title: "Valor inválido", description: "Digite um número válido.", variant: "destructive" });
      return;
    }
    setFixedExpense(v);
    toast({ title: "Gasto atualizado", description: `Novo valor: ${formatCurrency(v)} por cliente.` });
  };

  
  // Block client states
  const [showBlockSearch, setShowBlockSearch] = useState(false);
  const [blockSearchQuery, setBlockSearchQuery] = useState("");
  const [blockPhone, setBlockPhone] = useState("");
  const [blockMessage, setBlockMessage] = useState(DEFAULT_BLOCK_MESSAGE);
  const [unblockMessage, setUnblockMessage] = useState(DEFAULT_UNBLOCK_MESSAGE);
  const [cancelMessage, setCancelMessage] = useState(DEFAULT_CANCEL_MESSAGE);
  const [isBlockPhoneLocked, setIsBlockPhoneLocked] = useState(true);
  const [isBlockMessageLocked, setIsBlockMessageLocked] = useState(true);
  const [isUnblockMessageLocked, setIsUnblockMessageLocked] = useState(true);
  const [isCancelMessageLocked, setIsCancelMessageLocked] = useState(true);

  useEffect(() => {
    if (open) {
      setDestinationPhone(whatsAppSettings.destinationPhone);
      setMessageTemplate(whatsAppSettings.messageTemplate);
      setUseBusiness(whatsAppSettings.useBusiness);
      
      // Load payment settings
      const paymentSettings = getPaymentSettings();
      setPaymentPhone(paymentSettings.paymentPhone);
      setPaymentMessage(paymentSettings.paymentMessageTemplate);
      setPaymentUseBusiness(!!paymentSettings.paymentUseBusiness);
      
      // Load block settings
      const blockSettings = getBlockSettings();
      setBlockPhone(blockSettings.blockPhone);
      setBlockMessage(blockSettings.blockMessageTemplate);
      setUnblockMessage(blockSettings.unblockMessageTemplate);
      setCancelMessage(blockSettings.cancelMessageTemplate || DEFAULT_CANCEL_MESSAGE);
    }
  }, [open]);

  const formatPhone = (digits: string) => {
    const numbers = digits.replace(/\D/g, "");
    if (numbers.length === 0) return "";

    // Formatação progressiva para não “travar” ao apagar (ex.: ficar preso no ")")
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;

    return digits;
  };

  const handleSaveWhatsApp = () => {
    saveWhatsAppSettings({
      destinationPhone,
      messageTemplate,
      useBusiness,
    });
    toast({
      title: "Configurações salvas!",
      description: "As configurações do WhatsApp foram atualizadas.",
    });
  };

  const handleSavePaymentSettings = () => {
    savePaymentSettings({
      paymentPhone,
      paymentMessageTemplate: paymentMessage,
      paymentUseBusiness,
    });
    toast({
      title: "Configurações de pagamento salvas!",
      description: "As configurações do WhatsApp de pagamento foram atualizadas.",
    });
  };

  const handleSaveBlockSettings = () => {
    saveBlockSettings({
      blockPhone,
      blockMessageTemplate: blockMessage,
      unblockMessageTemplate: unblockMessage,
      cancelMessageTemplate: cancelMessage,
    });
    toast({
      title: "Configurações de bloqueio salvas!",
      description: "As configurações do WhatsApp de bloqueio foram atualizadas.",
    });
  };

  const handleBlockWithWhatsApp = (client: Client, shouldBlock: boolean) => {
    // First update the block status
    onBlockClient(client.id, shouldBlock);
    
    // Then send WhatsApp message if phone is configured
    if (!blockPhone) {
      return; // Just block without WhatsApp if not configured
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString("pt-BR");
    const formattedTime = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    
    const messageTemplate = shouldBlock ? blockMessage : unblockMessage;
    
    const message = messageTemplate
      .replace("{nome}", client.name)
      .replace("{telefone}", client.phone)
      .replace("{data}", formattedDate)
      .replace("{hora}", formattedTime);

    const phoneNumbers = blockPhone.replace(/\D/g, "");
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
  };

  const handleSendPaymentMessage = () => {
    if (!paymentPhone) {
      toast({
        title: "Erro",
        description: "Configure o número de WhatsApp para pagamento.",
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString("pt-BR");
    const formattedTime = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    
    const paymentValue = totalsByDay[selectedPaymentDay] ?? 0;
    
    const message = paymentMessage
      .replace("{valor}", formatCurrency(paymentValue))
      .replace("{data}", formattedDate)
      .replace("{hora}", formattedTime);

    const phoneNumbers = paymentPhone.replace(/\D/g, "");
    const phoneWithCountry = phoneNumbers.startsWith("55") ? phoneNumbers : `55${phoneNumbers}`;
    const encodedMessage = encodeURIComponent(message);

    const isAndroid = /android/i.test(navigator.userAgent);

    let whatsappUrl: string;

    if (isAndroid) {
      // Android intent para abrir especificamente o WhatsApp Business ou o normal
      if (paymentUseBusiness) {
        whatsappUrl = `intent://send?phone=${phoneWithCountry}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
      } else {
        whatsappUrl = `intent://send?phone=${phoneWithCountry}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
      }
    } else {
      // iOS/outros: não dá para forçar Business vs Normal, então usamos o link padrão
      whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodedMessage}`;
    }

    window.open(whatsappUrl, "_blank");
  };

  const markPaymentSent = (day: number) => {
    const newDays = sentPaymentDays.includes(day) ? sentPaymentDays : [...sentPaymentDays, day];
    setSentPaymentDays(newDays);
    localStorage.setItem("payment_sent_days", JSON.stringify({ month: getCurrentMonth(), days: newDays }));
    window.dispatchEvent(new Event("payment-sent-updated"));
    onPaymentSent?.(newDays);
  };

  const handleSendPaymentForDay = (day: number) => {
    if (!paymentPhone) {
      toast({
        title: "Configure o WhatsApp",
        description: "Role para baixo e configure o número de pagamento.",
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString("pt-BR");
    const formattedTime = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    
    const paymentValue = totalsByDay[day] ?? 0;
    
    const message = paymentMessage
      .replace("{valor}", formatCurrency(paymentValue))
      .replace("{data}", formattedDate)
      .replace("{hora}", formattedTime);

    const phoneNumbers = paymentPhone.replace(/\D/g, "");
    const phoneWithCountry = phoneNumbers.startsWith("55") ? phoneNumbers : `55${phoneNumbers}`;
    const encodedMessage = encodeURIComponent(message);

    const isAndroid = /android/i.test(navigator.userAgent);

    let whatsappUrl: string;

    if (isAndroid) {
      if (paymentUseBusiness) {
        whatsappUrl = `intent://send?phone=${phoneWithCountry}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
      } else {
        whatsappUrl = `intent://send?phone=${phoneWithCountry}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
      }
    } else {
      whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodedMessage}`;
    }

    window.open(whatsappUrl, "_blank");
    markPaymentSent(day);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Vibrate feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    try {
      if (onRefresh) {
        await onRefresh();
      }
      toast({
        title: "Atualizado!",
        description: "Os dados foram atualizados com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectColor = (hsl: string) => {
    saveThemeSettings({ backgroundColor: hsl, mode: themeSettings.mode });
    toast({
      title: "Cor alterada!",
      description: "O tema foi atualizado.",
    });
  };


  const handleStartEdit = (client: Client) => {
    // Close the settings dialog first to release focus trap
    onOpenChange(false);
    setTimeout(() => {
      setEditingClient(client);
      setEditName(client.name);
      setEditPhone(client.phone);
      setEditValue(String(client.value_paid));
      setEditDueDay(client.due_day || 10);
      setEditBonus(Boolean(client.bonus));
      setEditIsResale(Boolean(client.is_resale));
      setEditCompany(client.company || "omega");
      setEditAccount(client.account ?? null);
    }, 100);
  };

  const handleSaveEdit = () => {
    if (!editingClient || !editName.trim() || !editPhone.trim() || !editValue) return;
    
    onEditClient(editingClient.id, {
      name: editName.trim(),
      phone: editPhone.trim(),
      value_paid: parseFloat(editValue),
      due_day: editDueDay,
      bonus: editBonus,
      is_resale: editIsResale,
      company: editCompany,
      account: editAccount,
    });

    setEditingClient(null);
    // Reopen settings after saving
    setTimeout(() => onOpenChange(true), 150);
  };

  const handleCancelEdit = () => {
    setEditingClient(null);
    // Reopen settings after canceling
    setTimeout(() => onOpenChange(true), 150);
  };

  const handleDeleteClient = (client: Client) => {
    if (confirm(`Deseja excluir o cliente ${client.name}?`)) {
      onDeleteClient(client.id);
    }
  };

  const generateBackupText = () => {
    let text = `Cliente vivo\n`;

    clients.forEach((client, index) => {
      text += `${index + 1}- *${client.name}* ${client.phone}\n`;
    });

    return text;
  };

  const handleCopyToClipboard = async () => {
    const text = generateBackupText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copiado!",
        description: "Backup copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o texto.",
        variant: "destructive",
      });
    }
  };

  const [copiedDay, setCopiedDay] = useState<number | null>(null);
  const [copiedResaleName, setCopiedResaleName] = useState<string | null>(null);

  const getResellerName = (name: string) => {
    const idx = name.indexOf("-");
    return idx > 0 ? name.slice(0, idx).trim() : name.trim();
  };

  const getClientLabel = (name: string) => {
    const idx = name.indexOf("-");
    return idx > 0 ? name.slice(idx + 1).trim() : name.trim();
  };

  const handleCopyResaleGroup = async (reseller: string, group: Client[]) => {
    const header = `📦 *Revenda ${reseller}*\n\n`;
    const body = group
      .map((c, i) => `${i + 1}) *${getClientLabel(c.name)}*\nTel: ${c.phone}\nValor: ${formatCurrency(c.value_paid)}\nVenc: dia ${c.due_day || 10}`)
      .join("\n----------------------------\n");
    const text = header + body;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedResaleName(reseller);
      toast({
        title: "Copiado!",
        description: `${group.length} linha(s) de ${reseller} copiadas.`,
      });
      setTimeout(() => setCopiedResaleName(null), 2000);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível copiar.",
        variant: "destructive",
      });
    }
  };

  const handleCopyClientsByDay = async (day: number) => {
    const dayClients = clients.filter(c => c.due_day === day && !c.name.toUpperCase().includes("CANCELADO"));
    if (dayClients.length === 0) {
      toast({
        title: "Nenhum cliente",
        description: `Não há clientes no dia ${day}.`,
        variant: "destructive",
      });
      return;
    }

    const header = `📅Vencimento *${day}*\n\n----------------------------\n\n`;
    const body = dayClients
      .map((c, i) => `*${i + 1})- ${c.name}*\nTel:${c.phone}`)
      .join("\n----------------------------\n");
    const text = header + body;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedDay(day);
      toast({
        title: "Copiado!",
        description: `${dayClients.length} clientes do dia ${day} copiados.`,
      });
      setTimeout(() => setCopiedDay(null), 2000);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível copiar.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadText = () => {
    const text = generateBackupText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-cliente-vivo-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download iniciado!",
      description: "O arquivo de backup foi baixado.",
    });
  };

  // ===== Backup completo (arquivo) e importação =====
  const handleDownloadBackupFile = () => {
    const payload = {
      app: "cliente-vivo",
      version: 1,
      exported_at: new Date().toISOString(),
      clients: clients.map((c) => ({
        name: c.name,
        phone: c.phone,
        value_paid: c.value_paid,
        due_day: c.due_day ?? 10,
        virtual_chip: !!c.virtual_chip,
        blocked: !!c.blocked,
        is_resale: !!c.is_resale,
        bonus: !!c.bonus,
        company: c.company ?? "omega",
        account: c.account ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-completo-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Backup gerado!",
      description: `${clients.length} cliente(s) salvos no arquivo.`,
    });
  };

  const parseBackupFile = (raw: string) => {
    // Formato completo (JSON)
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed?.clients;
      if (Array.isArray(list)) {
        return list
          .filter((c: any) => c && c.name && c.phone)
          .map((c: any) => ({
            name: String(c.name).trim(),
            phone: String(c.phone).replace(/\D/g, ""),
            value_paid: Number(c.value_paid) || 0,
            due_day: Number(c.due_day) || 10,
            virtual_chip: !!c.virtual_chip,
            blocked: !!c.blocked,
            is_resale: !!c.is_resale,
            bonus: !!c.bonus,
            company: c.company ? String(c.company) : "omega",
            account: c.account === null || c.account === undefined || c.account === "" ? null : Number(c.account),
          }));
      }
    } catch {
      // segue para o formato de texto
    }

    // Formato antigo em texto: "1- *Nome* 11999999999"
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /\d/.test(line))
      .map((line) => {
        const nameMatch = line.match(/\*(.+?)\*/);
        const digits = (line.match(/(\d[\d\s().-]{7,})\s*$/)?.[1] || "").replace(/\D/g, "");
        const name = (nameMatch?.[1] || line.replace(/^\d+\s*[-)]\s*/, "").replace(/[\d\s().-]+$/, "")).trim();
        return { name, phone: digits };
      })
      .filter((c) => c.name && c.phone.length >= 8)
      .map((c) => ({
        name: c.name,
        phone: c.phone,
        value_paid: 0,
        due_day: 10,
        virtual_chip: false,
        blocked: false,
        is_resale: false,
        bonus: false,
        company: "omega",
        account: null as number | null,
      }));
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    try {
      const raw = await file.text();
      const rows = parseBackupFile(raw);

      if (rows.length === 0) {
        toast({
          title: "Arquivo sem clientes",
          description: "Não encontrei clientes nesse arquivo.",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Faça login",
          description: "Entre na sua conta para importar os dados.",
          variant: "destructive",
        });
        return;
      }

      const existing = new Set(clients.map((c) => c.phone.replace(/\D/g, "")));
      const novos = rows.filter((r) => !existing.has(r.phone));

      if (novos.length === 0) {
        toast({
          title: "Nada novo para importar",
          description: "Todos os clientes do arquivo já estão cadastrados.",
        });
        return;
      }

      const { error } = await supabase
        .from("clients")
        .insert(novos.map((r) => ({ ...r, user_id: user.id })));

      if (error) throw error;

      toast({
        title: "Importação concluída!",
        description: `${novos.length} cliente(s) adicionados.`,
      });
      onRefresh?.();
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error?.message || "Não foi possível ler o arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <input
        id="backup-import-input"
        type="file"
        accept=".json,.txt,application/json,text/plain"
        className="hidden"
        onChange={handleImportFile}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-purple-800 border-none rounded-2xl w-[90vw] max-w-md max-h-[80vh] overflow-hidden p-3 sm:p-6">
          <DialogHeader className="flex flex-row items-center gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 -ml-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <DialogTitle className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Configurações
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4 overflow-y-auto max-h-[calc(80vh-80px)] pr-1">

            {/* ===== Ações Rápidas ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                ⚡ Ações Rápidas
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => { onOpenChange(false); setTimeout(() => onCancelClick?.(), 200); }}
                  className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all bg-gradient-to-b from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 shadow-[0_4px_0_0_#9a3412] hover:shadow-[0_2px_0_0_#9a3412] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
                >
                  <Ban className="h-5 w-5 text-white" />
                  <span className="text-white text-xs font-bold">Cancelar</span>
                </button>
                <button
                  onClick={() => { onOpenChange(false); setTimeout(() => onBlockClick?.(), 200); }}
                  className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 shadow-[0_4px_0_0_#7f1d1d] hover:shadow-[0_2px_0_0_#7f1d1d] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
                >
                  <Lock className="h-5 w-5 text-white" />
                  <span className="text-white text-xs font-bold">Bloquear</span>
                </button>
                {hasBlockedClients && (
                  <button
                    onClick={() => { onOpenChange(false); setTimeout(() => onUnblockClick?.(), 200); }}
                    className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 shadow-[0_4px_0_0_#166534] hover:shadow-[0_2px_0_0_#166534] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
                  >
                    <Unlock className="h-5 w-5 text-white" />
                    <span className="text-white text-xs font-bold">Desbloquear</span>
                  </button>
                )}
              </div>
            </div>




            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Gerenciar Clientes
              </h3>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleStartEdit(client)}
                    className="w-full text-left bg-purple-900/70 hover:bg-purple-800/80 active:scale-[0.99] transition-all rounded-xl px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold text-white break-words leading-snug">
                      {client.company === "nexus" ? "✅ " : ""}{client.name}
                    </p>
                  </button>
                ))}
              </div>

            </div>

            {/* ===== WhatsApp Cobrança ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp Cobrança
              </h3>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-white/70">Número de destino</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={destinationPhone}
                      onChange={(e) => !isPhoneLocked ? setDestinationPhone(formatPhone(e.target.value)) : null}
                      placeholder="(XX) XXXXX-XXXX"
                      className="bg-purple-900/50 border-purple-600 text-white text-sm h-10"
                      readOnly={isPhoneLocked}
                    />
                    <button
                      onClick={() => setIsPhoneLocked(!isPhoneLocked)}
                      className="p-2 rounded-lg bg-purple-700/50 text-white/80 hover:text-white"
                    >
                      {isPhoneLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-white/70">Mensagem</Label>
                  <div className="flex gap-2 mt-1 items-start">
                    <Textarea
                      value={messageTemplate}
                      onChange={(e) => !isMessageLocked ? setMessageTemplate(e.target.value) : null}
                      className="bg-purple-900/50 border-purple-600 text-white text-xs min-h-[120px]"
                      readOnly={isMessageLocked}
                    />
                    <button
                      onClick={() => setIsMessageLocked(!isMessageLocked)}
                      className="p-2 rounded-lg bg-purple-700/50 text-white/80 hover:text-white mt-1"
                    >
                      {isMessageLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch checked={useBusiness} onCheckedChange={setUseBusiness} className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-white/20 [&>span]:bg-white [&>span]:shadow-md" />
                  <span className="text-xs text-white/70 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    WhatsApp Business
                  </span>
                </div>

                <Button onClick={handleSaveWhatsApp} className="w-full h-10 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
              </div>
            </div>

            {/* ===== WhatsApp Pagamento ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                WhatsApp Pagamento
              </h3>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-white/70">Número de destino</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={paymentPhone}
                      onChange={(e) => !isPaymentPhoneLocked ? setPaymentPhone(formatPhone(e.target.value)) : null}
                      placeholder="(XX) XXXXX-XXXX"
                      className="bg-purple-900/50 border-purple-600 text-white text-sm h-10"
                      readOnly={isPaymentPhoneLocked}
                    />
                    <button
                      onClick={() => setIsPaymentPhoneLocked(!isPaymentPhoneLocked)}
                      className="p-2 rounded-lg bg-purple-700/50 text-white/80 hover:text-white"
                    >
                      {isPaymentPhoneLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-white/70">Mensagem de pagamento</Label>
                  <div className="flex gap-2 mt-1 items-start">
                    <Textarea
                      value={paymentMessage}
                      onChange={(e) => !isPaymentMessageLocked ? setPaymentMessage(e.target.value) : null}
                      className="bg-purple-900/50 border-purple-600 text-white text-xs min-h-[120px]"
                      readOnly={isPaymentMessageLocked}
                    />
                    <button
                      onClick={() => setIsPaymentMessageLocked(!isPaymentMessageLocked)}
                      className="p-2 rounded-lg bg-purple-700/50 text-white/80 hover:text-white mt-1"
                    >
                      {isPaymentMessageLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Payment tracking grid - Pago / Restante */}
                <div>
                  <p className="text-xs text-white/70 mb-2">Acompanhamento por dia</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ALL_DUE_DAYS.map((day) => {
                      const total = totalsByDay[day] ?? 0;
                      const remaining = remainingByDay[day] ?? 0;
                      const paid = total - remaining;
                      const pct = total > 0 ? (paid / total) * 100 : 0;
                      return (
                        <div key={day} className="bg-purple-900/70 rounded-xl p-3 space-y-1.5 border border-gray-400/50">
                          <p className="text-xs font-bold text-white text-center">Dia {day}</p>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-green-400">Pago</span>
                            <span className="text-green-400 font-semibold">{formatCurrency(paid)}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-yellow-400">Restante</span>
                            <span className="text-yellow-400 font-semibold">{formatCurrency(remaining)}</span>
                          </div>
                          <div className="w-full h-1.5 bg-purple-950 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/70 mb-2">Enviar pagamento por dia</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {ALL_DUE_DAYS.map((day) => {
                      const value = totalsByDay[day] ?? 0;
                      return (
                        <button
                          key={day}
                          onClick={() => handleSendPaymentForDay(day)}
                          className={`relative flex flex-col items-center rounded-xl p-1.5 transition-colors ${
                            sentPaymentDays.includes(day)
                              ? 'bg-red-900/50 hover:bg-red-800/50'
                              : 'bg-purple-900/70 hover:bg-purple-700/70'
                          }`}
                        >
                          {sentPaymentDays.includes(day) && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                              <X className="h-7 w-7 text-red-500 opacity-70" strokeWidth={3} />
                            </div>
                          )}
                          <span className="text-[11px] font-bold text-white">Dia {day}</span>
                          <span className="text-[9px] text-green-400 truncate w-full text-center">{formatCurrency(value)}</span>
                          <Send className="h-3 w-3 text-white/60 mt-1" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch checked={paymentUseBusiness} onCheckedChange={setPaymentUseBusiness} className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-white/20 [&>span]:bg-white [&>span]:shadow-md" />
                  <span className="text-xs text-white/70 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    WhatsApp Business
                  </span>
                </div>

                <Button onClick={handleSavePaymentSettings} className="w-full h-10 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
              </div>
            </div>

            {/* ===== WhatsApp Bloqueio ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Ban className="h-4 w-4" />
                WhatsApp Bloqueio / Desbloqueio
              </h3>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-white/70">Número de destino</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={blockPhone}
                      onChange={(e) => !isBlockPhoneLocked ? setBlockPhone(formatPhone(e.target.value)) : null}
                      placeholder="(XX) XXXXX-XXXX"
                      className="bg-purple-900/50 border-purple-600 text-white text-sm h-10"
                      readOnly={isBlockPhoneLocked}
                    />
                    <button
                      onClick={() => setIsBlockPhoneLocked(!isBlockPhoneLocked)}
                      className="p-2 rounded-lg bg-purple-700/50 text-white/80 hover:text-white"
                    >
                      {isBlockPhoneLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-white/70">Mensagem de bloqueio</Label>
                  <div className="flex gap-2 mt-1 items-start">
                    <Textarea
                      value={blockMessage}
                      onChange={(e) => !isBlockMessageLocked ? setBlockMessage(e.target.value) : null}
                      className="bg-purple-900/50 border-purple-600 text-white text-xs min-h-[100px]"
                      readOnly={isBlockMessageLocked}
                    />
                    <button
                      onClick={() => setIsBlockMessageLocked(!isBlockMessageLocked)}
                      className="p-2 rounded-lg bg-purple-700/50 text-white/80 hover:text-white mt-1"
                    >
                      {isBlockMessageLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-white/70">Mensagem de desbloqueio</Label>
                  <div className="flex gap-2 mt-1 items-start">
                    <Textarea
                      value={unblockMessage}
                      onChange={(e) => !isUnblockMessageLocked ? setUnblockMessage(e.target.value) : null}
                      className="bg-purple-900/50 border-purple-600 text-white text-xs min-h-[100px]"
                      readOnly={isUnblockMessageLocked}
                    />
                    <button
                      onClick={() => setIsUnblockMessageLocked(!isUnblockMessageLocked)}
                      className="p-2 rounded-lg bg-purple-700/50 text-white/80 hover:text-white mt-1"
                    >
                      {isUnblockMessageLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-white/70">Mensagem de cancelamento</Label>
                  <div className="flex gap-2 mt-1 items-start">
                    <Textarea
                      value={cancelMessage}
                      onChange={(e) => !isCancelMessageLocked ? setCancelMessage(e.target.value) : null}
                      className="bg-purple-900/50 border-purple-600 text-white text-xs min-h-[100px]"
                      readOnly={isCancelMessageLocked}
                    />
                    <button
                      onClick={() => setIsCancelMessageLocked(!isCancelMessageLocked)}
                      className="p-2 rounded-lg bg-purple-700/50 text-white/80 hover:text-white mt-1"
                    >
                      {isCancelMessageLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button onClick={handleSaveBlockSettings} className="w-full h-10 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
              </div>
            </div>

            {/* ===== Resumo Financeiro ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Resumo Financeiro
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-purple-950/50 border border-purple-700 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-purple-300/80">Faturamento Bruto</p>
                  <p className="text-base font-extrabold text-white">{formatCurrency(totalGross)}</p>
                </div>
                <div className="rounded-xl bg-purple-950/50 border border-purple-700 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-purple-300/80">Clientes</p>
                  <p className="text-base font-extrabold text-white">{totalClients}</p>
                </div>
                <div className="rounded-xl bg-purple-950/50 border border-purple-700 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-purple-300/80">Despesas</p>
                  <p className="text-base font-extrabold text-red-500">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className="rounded-xl bg-purple-950/50 border border-purple-700 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-purple-300/80">Lucro</p>
                  <p className="text-base font-extrabold text-green-500">{formatCurrency(totalProfit)}</p>
                </div>
              </div>
            </div>

            {/* ===== Atalhos (Revenda / Ocultar) ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Store className="h-4 w-4" />
                Atalhos
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); onResaleClick?.(); }}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl bg-purple-900/70 hover:bg-purple-700/70 border border-purple-600 transition-colors"
                >
                  <ShoppingCart className="h-4 w-4 text-white" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Revenda</span>
                </button>
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); onTogglePaymentCards?.(); }}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl bg-purple-900/70 hover:bg-purple-700/70 border border-purple-600 transition-colors"
                >
                  {showPaymentCards ? <Eye className="h-4 w-4 text-white" /> : <EyeOff className="h-4 w-4 text-white" />}
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Ocultar</span>
                </button>
              </div>
            </div>

            {/* ===== Dias Visíveis ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Dias Visíveis
              </h3>
              <p className="text-[11px] text-purple-200/80 mb-3">
                Escolha quais dias de vencimento aparecem no resumo da tela inicial.
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {ALL_DUE_DAYS.map((day) => {
                  const active = visibleDays.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`h-11 rounded-xl font-bold text-sm transition-colors border ${
                        active
                          ? 'bg-green-600 border-green-400 text-white'
                          : 'bg-purple-950/60 border-purple-700 text-white/50'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ===== Copiar Clientes por Dia ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copiar Clientes por Dia
              </h3>
              <div className="grid grid-cols-6 gap-1.5">
                {ALL_DUE_DAYS.map((day) => {
                  const count = clients.filter(c => c.due_day === day && !c.name.toUpperCase().includes("CANCELADO")).length;
                  return (
                    <button
                      key={day}
                      onClick={() => handleCopyClientsByDay(day)}
                      className="flex flex-col items-center rounded-xl p-1.5 bg-purple-900/70 hover:bg-purple-700/70 transition-colors"
                    >
                      <span className="text-[11px] font-bold text-white">Dia {day}</span>
                      <span className="text-[9px] text-white/60">{count}</span>
                      {copiedDay === day ? (
                        <Check className="h-3.5 w-3.5 text-green-400 mt-1" />
                      ) : (
                        <Copy className="h-3 w-3 text-white/60 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ===== Gasto Fixo ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Gasto por Cliente
              </h3>
              <p className="text-[11px] text-purple-200/80 mb-2">
                Este valor é aplicado a todos os clientes no cálculo de despesa e lucro.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-200 text-sm">R$</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={expenseInput}
                    onChange={(e) => setExpenseInput(e.target.value)}
                    className="h-10 pl-9 bg-purple-950/50 border-purple-700 text-white rounded-xl"
                    placeholder="60"
                  />
                </div>
                <Button
                  onClick={handleSaveExpense}
                  className="h-10 bg-green-600 hover:bg-green-700 text-white rounded-xl px-4"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Salvar
                </Button>
              </div>
            </div>

            {/* ===== Contas ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Contas</h3>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={decreaseAccounts}
                  className="h-12 flex-1 rounded-xl bg-red-700 border border-red-500 text-sm font-bold text-white"
                >
                  − Excluir conta
                </button>
                <span className="text-3xl font-black text-white">{accountsCount}</span>
                <button
                  type="button"
                  onClick={increaseAccounts}
                  className="h-12 flex-1 rounded-xl bg-green-700 border border-green-500 text-sm font-bold text-white"
                >
                  + Adicionar
                </button>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs text-white/70">Número de cada conta (aparece no botão)</p>
                {accounts.map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs font-bold text-white">Conta {n}</span>
                    <Input
                      value={accountLabels[n] ?? ""}
                      onChange={(e) => setAccountLabel(n, e.target.value)}
                      placeholder="Ex: 0476371128"
                      inputMode="numeric"
                      className="h-10 bg-purple-950/50 border-purple-700 text-white rounded-xl text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <Switch
                  checked={showAccountCounts}
                  onCheckedChange={onSetShowAccountCounts}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-white/20 [&>span]:bg-white [&>span]:shadow-md"
                />
                <span className="text-xs text-white/80">Mostrar quantidade de linhas em cada conta</span>
              </div>
              <p className="text-[11px] text-white/60 mt-2">
                Os botões aparecem 4 por linha na tela inicial e quebram para a linha de baixo.
              </p>
            </div>

            {/* ===== Tema ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Tema e Cores
              </h3>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setThemeMode("dark")}
                  className={`h-11 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                    themeSettings.mode === "dark"
                      ? "bg-purple-950 border-white text-white"
                      : "bg-purple-900/40 border-purple-600 text-white/60"
                  }`}
                >
                  Escuro
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode("light")}
                  className={`h-11 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                    themeSettings.mode === "light"
                      ? "bg-white border-white text-black"
                      : "bg-purple-900/40 border-purple-600 text-white/60"
                  }`}
                >
                  Claro
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {colors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => handleSelectColor(color.hsl)}
                    className={`w-full aspect-square rounded-xl border-2 transition-all ${
                      themeSettings.backgroundColor === color.hsl
                        ? 'border-white scale-110'
                        : 'border-transparent hover:border-white/50'
                    }`}
                    style={{ backgroundColor: `hsl(${color.hsl})` }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* ===== Backup ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Backup
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleCopyToClipboard} className="h-10 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-sm">
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copiado!" : "Copiar lista"}
                </Button>
                <Button onClick={handleDownloadText} className="h-10 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-sm">
                  <Download className="h-4 w-4 mr-1" />
                  Baixar lista
                </Button>
                <Button onClick={handleDownloadBackupFile} className="h-10 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm">
                  <Download className="h-4 w-4 mr-1" />
                  Gerar backup
                </Button>
                <Button
                  onClick={() => document.getElementById("backup-import-input")?.click()}
                  disabled={isImporting}
                  className="h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm"
                >
                  {isImporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  {isImporting ? "Importando..." : "Importar"}
                </Button>
              </div>
              <p className="text-[11px] text-purple-200 mt-2">
                "Gerar backup" salva um arquivo com todos os dados dos clientes. "Importar" adiciona os clientes desse arquivo nesta conta.
              </p>
            </div>

            {/* ===== Atualizar / Sincronizar ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <div className="flex gap-2">
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? "Atualizando..." : "Sincronizar Dados"}
                </Button>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Client Portal - rendered completely outside Dialog */}
      {editingClient && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelEdit();
          }}
        >
          <div 
            className="bg-purple-800 rounded-2xl p-4 sm:p-6 w-[90vw] max-w-sm space-y-3 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">Editar Cliente</h3>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nome"
              autoFocus
              className="w-full h-10 sm:h-12 bg-purple-900/50 border border-purple-600 text-white rounded-xl text-sm px-3 outline-none focus:ring-2 focus:ring-purple-400"
            />
            <input
              value={editPhone}
              onChange={(e) => {
                const value = e.target.value;
                const numbers = value.replace(/\D/g, "");
                if (numbers.length === 0) {
                  setEditPhone("");
                  return;
                }
                setEditPhone(formatPhone(numbers));
              }}
              placeholder="Telefone"
              className="w-full h-10 sm:h-12 bg-purple-900/50 border border-purple-600 text-white rounded-xl text-sm px-3 outline-none focus:ring-2 focus:ring-purple-400"
            />
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Valor"
              className="w-full h-10 sm:h-12 bg-purple-900/50 border border-purple-600 text-white rounded-xl text-sm px-3 outline-none focus:ring-2 focus:ring-purple-400"
            />
            <div>
              <p className="text-xs text-white/70 mb-2">Dia de Vencimento</p>
              <div className="grid grid-cols-6 gap-1.5">
                {ALL_DUE_DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => setEditDueDay(day)}
                    className={`h-10 sm:h-12 rounded-xl font-medium text-sm transition-colors ${
                      editDueDay === day 
                        ? 'bg-primary text-white' 
                        : 'bg-purple-900/50 text-white/70 hover:bg-purple-900/70'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditIsResale((v) => !v)}
              className={`w-full h-10 sm:h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                editIsResale
                  ? 'bg-blue-500/30 border-2 border-blue-400 text-blue-400'
                  : 'bg-purple-900/50 border border-purple-600 text-white/80 hover:bg-purple-900/70'
              }`}
            >
              <Store className={`h-4 w-4 ${editIsResale ? 'text-blue-400' : ''}`} />
              {editIsResale ? 'Revenda' : 'Cliente Final'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditCompany("omega")}
                className={`h-10 sm:h-12 rounded-xl font-bold text-xs transition-all ${
                  editCompany === "omega"
                    ? 'bg-primary text-white border-2 border-primary'
                    : 'bg-purple-900/50 border border-purple-600 text-white/80 hover:bg-purple-900/70'
                }`}
              >
                Raio Telecom
              </button>
              <button
                type="button"
                onClick={() => setEditCompany("nexus")}
                className={`h-10 sm:h-12 rounded-xl font-bold text-xs transition-all ${
                  editCompany === "nexus"
                    ? 'bg-white text-black border-2 border-gray-300'
                    : 'bg-purple-900/50 border border-purple-600 text-white/80 hover:bg-purple-900/70'
                }`}
              >
                Nexus Telecom
              </button>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Conta</p>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditAccount(null)}
                  className={`h-10 rounded-xl text-xs font-bold transition-all ${
                    editAccount === null
                      ? 'bg-primary text-white border-2 border-primary'
                      : 'bg-purple-900/50 border border-purple-600 text-white/80'
                  }`}
                >
                  —
                </button>
                {accounts.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEditAccount(n)}
                    className={`h-10 rounded-xl text-sm font-bold transition-all ${
                      editAccount === n
                        ? 'bg-primary text-white border-2 border-primary'
                        : 'bg-purple-900/50 border border-purple-600 text-white/80'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEditBonus((v) => !v)}
              className={`w-full h-10 sm:h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                editBonus
                  ? 'bg-white border-2 border-yellow-400 text-black'
                  : 'bg-purple-900/50 border border-purple-600 text-white/80 hover:bg-purple-900/70'
              }`}
            >
              <Star className={`h-4 w-4 ${editBonus ? 'fill-yellow-400 text-yellow-500' : ''}`} />
              {editBonus ? 'Bônus ativado' : 'Marcar como Bônus'}
            </button>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                onClick={handleSaveEdit}
                className="h-10 sm:h-12 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm"
              >
                <Check className="h-4 w-4 mr-1" />
                Salvar
              </Button>
              <Button
                onClick={() => {
                  const c = editingClient;
                  handleCancelEdit();
                  if (c) handleDeleteClient(c);
                }}
                className="h-10 sm:h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
              <Button
                onClick={() => {
                  const c = editingClient;
                  if (c) handleBlockWithWhatsApp(c, !c.blocked);
                }}
                className="h-10 sm:h-12 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-sm"
              >
                {editingClient?.blocked ? <Lock className="h-4 w-4 mr-1" /> : <LockOpen className="h-4 w-4 mr-1" />}
                {editingClient?.blocked ? 'Desbloquear' : 'Bloquear'}
              </Button>
              <Button
                onClick={handleCancelEdit}
                className="h-10 sm:h-12 bg-purple-900/70 hover:bg-purple-900 text-white rounded-xl text-sm"
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
};
