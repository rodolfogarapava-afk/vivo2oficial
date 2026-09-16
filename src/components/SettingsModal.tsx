import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Download, FileText, Signal, Copy, Check, MessageCircle, Save, ArrowLeft, Palette, Pencil, Trash2, X, Users, Lock, LockOpen, Unlock, Building2, RefreshCw, CloudDownload, CreditCard, Send, Ban, Search, Star, Store, ShoppingCart, Eye, EyeOff, Calendar, Upload, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVivoPanel, type SyncPlan } from "@/hooks/useVivoPanel";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Client } from "@/hooks/useClients";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { useThemeSettings } from "@/hooks/useThemeSettings";

import whatsappIcon from "@/assets/whatsapp-icon.png";
import { useFixedExpense } from "@/hooks/useFixedExpense";
import { ALL_DUE_DAYS, useVisibleDueDays } from "@/lib/dueDays";
import { formatClientName } from "@/lib/formatName";
import { AccessTokensSection } from "@/components/AccessTokensSection";
import { PanelNamesSection } from "@/components/PanelNamesSection";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  fixedExpense: number;
  onDeleteClient: (id: string) => void;
  onEditClient: (id: string, data: { name: string; phone: string; whatsapp: string | null; value_paid: number; due_day: number; bonus: boolean; is_resale: boolean; company: string; account: number | null; data_gb?: number; data_used_gb?: number }) => void;
  onBlockClient: (id: string, blocked: boolean) => void;
  onRefresh?: () => void;
  totalsByDay: Record<number, number>;
  remainingByDay: Record<number, number>;
  onResaleClick?: () => void;
  onReportClick?: () => void;
  showPaymentCards?: boolean;
  onTogglePaymentCards?: () => void;
  onPaymentSent?: (days: number[]) => void;
  onCancelClick?: () => void;
  onBlockClick?: () => void;
  onUnblockClick?: () => void;
  hasBlockedClients?: boolean;
  isAdmin?: boolean;
  userId?: string;
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

export const SettingsModal = ({ open, onOpenChange, clients, fixedExpense, onDeleteClient, onEditClient, onBlockClient, onRefresh, totalsByDay, remainingByDay, onResaleClick, onReportClick, showPaymentCards, onTogglePaymentCards, onPaymentSent, onCancelClick, onBlockClick, onUnblockClick, hasBlockedClients, isAdmin, userId }: SettingsModalProps) => {
  const { visibleDays, toggleDay } = useVisibleDueDays();
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const { toast } = useToast();
  const { settings: whatsAppSettings, saveSettings: saveWhatsAppSettings } = useWhatsAppSettings();
  const { settings: themeSettings, saveSettings: saveThemeSettings, setMode: setThemeMode, setButtonColor, setClientCardPurple, setClientCardText, colors, buttonColors } = useThemeSettings();

  
  const [destinationPhone, setDestinationPhone] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [useBusiness, setUseBusiness] = useState(true);
  const [showClientWhatsApp, setShowClientWhatsApp] = useState(false);
  const [clientMessageTemplate, setClientMessageTemplate] = useState("");
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
  const [showClientList, setShowClientList] = useState(false);
  const [showPanelList, setShowPanelList] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editDueDay, setEditDueDay] = useState<number>(10);
  const [editIsResale, setEditIsResale] = useState<boolean>(false);
  const [editDataGb, setEditDataGb] = useState<string>("0");
  const [editDataUsedGb, setEditDataUsedGb] = useState<string>("0");
  const [syncPlan, setSyncPlan] = useState<SyncPlan | null>(null);


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
  const [isClientMessageLocked, setIsClientMessageLocked] = useState(true);

  useEffect(() => {
    if (open) {
      setDestinationPhone(whatsAppSettings.destinationPhone);
      setMessageTemplate(whatsAppSettings.messageTemplate);
      setUseBusiness(whatsAppSettings.useBusiness);
      setShowClientWhatsApp(whatsAppSettings.showClientWhatsApp);
      setClientMessageTemplate(whatsAppSettings.clientMessageTemplate);
      
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

  // Exibição do número na lista (celular 11 dígitos e fixo 10 dígitos)
  const formatPhoneDisplay = (phone: string) => {
    const numbers = (phone || "").replace(/\D/g, "");
    if (numbers.length === 11)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    if (numbers.length === 10)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return phone || "";
  };


  const handleSaveWhatsApp = () => {
    saveWhatsAppSettings({
      destinationPhone,
      messageTemplate,
      useBusiness,
      showClientWhatsApp,
      clientMessageTemplate,
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


  const vivo = useVivoPanel();

  const handleCheckPanel = async () => {
    const panelLines = await vivo.fetchLines();
    if (!panelLines || panelLines.length === 0) return;
    setSyncPlan(vivo.buildPlan(panelLines, clients));
  };

  const handleOpenPanelList = async () => {
    const panelLines = await vivo.fetchLines();
    if (!panelLines || panelLines.length === 0) return;
    onOpenChange(false);
    setTimeout(() => setShowPanelList(true), 150);
  };

  const gigaForPhone = (phone: string) => {
    const key = (phone ?? "").replace(/\D/g, "");
    const match = clients.find((c) => (c.phone ?? "").replace(/\D/g, "") === key);
    return Number(match?.data_gb ?? 0);
  };

  const handleApplyPanel = async () => {
    if (!syncPlan) return;
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    const ok = await vivo.applyPlan(syncPlan, uid);
    if (ok) {
      setSyncPlan(null);
      onRefresh?.();
    }
  };

  const handleStartEdit = (client: Client) => {
    // Close the settings dialog first to release focus trap
    setShowClientList(false);
    onOpenChange(false);
    setTimeout(() => {
      setEditingClient(client);
      setEditName(client.name);
      setEditPhone(client.phone);
      setEditWhatsapp(client.whatsapp ?? "");
      setEditValue(String(client.value_paid));
      setEditDueDay(client.due_day || 10);
      setEditIsResale(Boolean(client.is_resale));
      setEditDataGb(String(client.data_gb ?? 0));
      setEditDataUsedGb(String(client.data_used_gb ?? 0));
    }, 100);
  };

  const handleSaveEdit = () => {
    if (!editingClient || !editName.trim() || !editPhone.trim() || !editValue) return;
    
    onEditClient(editingClient.id, {
      name: formatClientName(editName),
      phone: editPhone.trim(),
      whatsapp: editWhatsapp.trim() || null,
      value_paid: parseFloat(editValue),
      due_day: editDueDay,
      bonus: Boolean(editingClient.bonus),
      is_resale: editIsResale,
      company: editingClient.company ?? "omega",
      account: editingClient.account ?? null,
      data_gb: Number(editDataGb.replace(",", ".")) || 0,
      data_used_gb: Number(editDataUsedGb.replace(",", ".")) || 0,
    });

    setEditingClient(null);
    setTimeout(() => setShowClientList(true), 150);
  };

  const handleCancelEdit = () => {
    setEditingClient(null);
    setTimeout(() => setShowClientList(true), 150);
  };

  const handleDeleteClient = (client: Client) => {
    setClientToDelete(client);
  };

  const handleConfirmDelete = () => {
    if (!clientToDelete) return;
    onDeleteClient(clientToDelete.id);
    setClientToDelete(null);
    setEditingClient(null);
    setTimeout(() => setShowClientList(true), 150);
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
        whatsapp: c.whatsapp ?? null,
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
            whatsapp: c.whatsapp ? String(c.whatsapp) : null,
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
        whatsapp: null as string | null,
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

            {/* ===== ADM: tokens e nomes dos painéis ===== */}
            {isAdmin && (
              <>
                <AccessTokensSection />
                <PanelNamesSection userId={userId} />
              </>
            )}


            {/* ===== Ações Rápidas ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                ⚡ Ações Rápidas
              </h3>
              <div className="flex gap-2">
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
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(() => setShowClientList(true), 150);
                }}
                className="w-full h-12 mt-3 bg-purple-700 hover:bg-purple-600 text-white rounded-xl font-bold"
              >
                <Users className="h-5 w-5 mr-2" />
                Lista de clientes
              </Button>
            </div>

            {/* ===== Painel Vivo Gestão (somente ADM) ===== */}
            <div className={`bg-purple-900/50 rounded-xl p-3 sm:p-4 ${isAdmin ? "" : "hidden"}`}>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Signal className="h-4 w-4" />
                Painel Vivo Gestão
              </h3>
              <p className="text-xs text-white/70 mb-3">
                Puxa as linhas do painel. Linha sem nome entra como <strong>Livre</strong>.
              </p>
              <Button
                type="button"
                disabled={vivo.isLoading}
                onClick={handleCheckPanel}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold"
              >
                {vivo.isLoading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CloudDownload className="h-5 w-5 mr-2" />}
                {vivo.isLoading ? "Lendo o painel..." : "Conferir painel Vivo"}
              </Button>
              <Button
                type="button"
                disabled={vivo.isLoading}
                onClick={handleOpenPanelList}
                className="w-full h-12 mt-2 bg-purple-700 hover:bg-purple-600 text-white rounded-xl font-bold"
              >
                {vivo.isLoading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Users className="h-5 w-5 mr-2" />}
                Lista de nomes do gestor
              </Button>
              {syncPlan && (
                <div className="mt-3 space-y-2 text-xs text-white/80">
                  <p>Novas linhas para adicionar: <strong className="text-white">{syncPlan.toAdd.length}</strong></p>
                  <p>Nomes para atualizar: <strong className="text-white">{syncPlan.toUpdate.length}</strong></p>
                  <p>Iguais: <strong className="text-white">{syncPlan.unchanged}</strong></p>
                  <p>No app e não no painel: <strong className="text-white">{syncPlan.notInPanel.length}</strong></p>
                  {syncPlan.toAdd.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-lg bg-purple-950/60 p-2">
                      {syncPlan.toAdd.map((l) => (
                        <p key={l.phone}>{l.name} — {formatPhoneDisplay(l.phone)}</p>
                      ))}
                    </div>
                  )}
                  {syncPlan.toUpdate.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-lg bg-purple-950/60 p-2">
                      {syncPlan.toUpdate.map((u) => (
                        <p key={u.id}>{u.from} → {u.to}</p>
                      ))}
                    </div>
                  )}
                  {syncPlan.toAdd.length + syncPlan.toUpdate.length > 0 ? (
                    <Button
                      type="button"
                      disabled={vivo.isApplying}
                      onClick={handleApplyPanel}
                      className="w-full h-12 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold"
                    >
                      {vivo.isApplying ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Check className="h-5 w-5 mr-2" />}
                      Aplicar no aplicativo
                    </Button>
                  ) : (
                    <p className="font-bold text-green-400">Tudo igual ao painel!</p>
                  )}
                </div>
              )}
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
                  onClick={() => { onOpenChange(false); setTimeout(() => onReportClick?.(), 150); }}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl bg-purple-700 hover:bg-purple-600 border border-purple-500 transition-colors"
                >
                  <TrendingUp className="h-4 w-4 text-white" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Ganhos</span>
                </button>
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

              <p className="text-xs text-white/70 mt-4 mb-2">Cor dos botões</p>
              <div className="grid grid-cols-5 gap-2">
                {buttonColors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => {
                      setButtonColor(color.hsl);
                      toast({ title: "Cor dos botões alterada!", description: color.name });
                    }}
                    className={`w-full aspect-square rounded-xl border-2 flex items-center justify-center transition-all ${
                      (themeSettings.buttonColor || "") === color.hsl
                        ? 'border-white scale-110'
                        : 'border-transparent hover:border-white/50'
                    }`}
                    style={color.hsl ? { backgroundColor: `hsl(${color.hsl})` } : undefined}
                    title={color.name}
                  >
                    {!color.hsl && <span className="text-[9px] font-bold text-white">Padrão</span>}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-purple-700 bg-purple-950/40 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-white">Fundo do cartão</p>
                    <p className="text-[10px] text-purple-200">Branco até roxo</p>
                  </div>
                  <span className="min-w-10 text-right text-xs font-extrabold text-white">
                    {themeSettings.clientCardPurple ?? 0}%
                  </span>
                </div>
                <Slider
                  value={[themeSettings.clientCardPurple ?? 0]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(value) => setClientCardPurple(value[0] ?? 0)}
                  aria-label="Quantidade de roxo no cartão"
                />
                <div className="mt-2 flex justify-between text-[10px] font-bold text-purple-200">
                  <span>Branco</span>
                  <span>Roxo</span>
                </div>
              </div>

              <p className="mb-2 mt-4 text-xs text-white/70">Cor das letras e números</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setClientCardText("black")}
                  className={`h-11 bg-white text-black hover:bg-white hover:text-black ${
                    (themeSettings.clientCardText ?? "black") === "black" ? "border-2 border-green-500" : "border-purple-600"
                  }`}
                >
                  Preto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setClientCardText("white")}
                  className={`h-11 bg-purple-950 text-white hover:bg-purple-950 hover:text-white ${
                    themeSettings.clientCardText === "white" ? "border-2 border-green-500" : "border-purple-600"
                  }`}
                >
                  Branco
                </Button>
              </div>
            </div>


            {/* ===== WhatsApp ===== */}
            <div className="bg-purple-900/50 rounded-xl p-3 sm:p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-white">WhatsApp</h3>
                <p className="text-[11px] text-purple-200">Configure o botão exibido no cartão do cliente.</p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-purple-800/60 p-3">
                <div>
                  <p className="text-sm font-medium text-white">Mostrar logo no cartão</p>
                  <p className="text-[11px] text-purple-200">Só aparece nos clientes com WhatsApp cadastrado.</p>
                </div>
                <Switch
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-600"
                  checked={showClientWhatsApp}
                  onCheckedChange={(checked) => {
                    setShowClientWhatsApp(checked);
                    saveWhatsAppSettings({
                      destinationPhone,
                      messageTemplate,
                      useBusiness,
                      showClientWhatsApp: checked,
                      clientMessageTemplate,
                    });
                    toast({ title: checked ? "Logo ligada" : "Logo desligada", description: checked ? "O ícone do WhatsApp aparece no cartão." : "O ícone do WhatsApp não aparece no cartão." });
                  }}
                />
              </div>
              <div className="rounded-xl bg-purple-800/60 p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium text-white">Enviar pelo</p>
                  <p className="text-[11px] text-purple-200">Escolha qual WhatsApp abre ao enviar as mensagens.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "WhatsApp Business", value: true },
                    { label: "WhatsApp normal", value: false },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => {
                        setUseBusiness(option.value);
                        saveWhatsAppSettings({
                          destinationPhone,
                          messageTemplate,
                          useBusiness: option.value,
                          showClientWhatsApp,
                          clientMessageTemplate,
                        });
                        toast({ title: "Pronto", description: `As mensagens vão abrir no ${option.label}.` });
                      }}
                      className={`rounded-xl px-2 py-2 text-xs font-bold ${
                        useBusiness === option.value
                          ? "bg-green-600 text-white"
                          : "border border-purple-500 bg-purple-900/50 text-purple-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-white">Mensagem pré-programada</label>
                  <button
                    type="button"
                    onClick={() => setIsClientMessageLocked((prev) => !prev)}
                    className="flex items-center gap-1 rounded-lg border border-purple-500 bg-purple-800/60 px-2 py-1 text-[11px] font-medium text-white"
                    title={isClientMessageLocked ? "Abrir cadeado para editar" : "Fechar cadeado"}
                  >
                    {isClientMessageLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    {isClientMessageLocked ? "Bloqueado" : "Editando"}
                  </button>
                </div>
                <textarea
                  value={clientMessageTemplate}
                  onChange={(event) => setClientMessageTemplate(event.target.value)}
                  readOnly={isClientMessageLocked}
                  rows={10}
                  placeholder="Olá, {nome}!"
                  className={`w-full rounded-xl border border-purple-600 bg-purple-800/60 px-3 py-2 text-sm text-white placeholder:text-purple-300 outline-none focus:ring-2 focus:ring-purple-400 ${isClientMessageLocked ? "opacity-80" : ""}`}
                />
                <p className="text-[10px] text-purple-200">Use {"{nome}"}, {"{telefone}"}, {"{valor}"}, {"{data}"} e {"{hora}"}.</p>
              </div>
              <Button onClick={handleSaveWhatsApp} className="w-full h-10 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm">
                Salvar WhatsApp
              </Button>
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

      {showPanelList && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-purple-800 rounded-2xl p-4 w-full max-w-md h-[85dvh] min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setShowPanelList(false);
                  setTimeout(() => onOpenChange(true), 150);
                }}
                className="text-white hover:bg-purple-700"
                aria-label="Voltar para configurações"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h3 className="text-lg font-bold text-white">Nomes no gestor ({vivo.lines?.length ?? 0})</h3>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 pb-4 touch-pan-y">
              {(vivo.lines ?? []).map((line) => {
                const giga = gigaForPhone(line.phone);
                const isFree = !line.name.trim();
                const lineKey = (line.phone ?? "").replace(/\D/g, "");
                const inApp = !isFree && clients.some((c) => (c.phone ?? "").replace(/\D/g, "") === lineKey);
                return (
                  <div
                    key={line.phone}
                    className={`flex items-center gap-2 rounded-xl px-3 py-3 ${
                      isFree
                        ? "bg-green-900/60 text-white"
                        : inApp
                          ? "bg-purple-900/70 text-white"
                          : "bg-red-300 text-red-950"
                    }`}
                  >
                    <span className="shrink-0" aria-hidden>{isFree ? "🟢" : inApp ? "" : "🔵"}</span>
                    <span className="flex-1 text-left text-sm font-semibold whitespace-normal break-words">
                      {line.name.trim() || "LIVRE"}
                    </span>
                    <span className={`shrink-0 text-sm font-bold tabular-nums whitespace-nowrap ${inApp || isFree ? "text-green-300" : "text-red-900"}`}>
                      {formatPhoneDisplay(line.phone)}
                    </span>
                    <span className={`shrink-0 text-sm font-bold tabular-nums whitespace-nowrap ${inApp || isFree ? "text-blue-300" : "text-red-900"}`}>
                      {giga > 0 ? `${giga} GB` : "—"}
                    </span>
                  </div>
                );
              })}
              {(vivo.lines ?? []).length === 0 && (
                <p className="py-8 text-center text-sm text-purple-200">Nenhuma linha no painel.</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showClientList && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-purple-800 rounded-2xl p-4 w-full max-w-md h-[85dvh] min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setShowClientList(false);
                  setTimeout(() => onOpenChange(true), 150);
                }}
                className="text-white hover:bg-purple-700"
                aria-label="Voltar para configurações"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h3 className="text-lg font-bold text-white">Lista de clientes</h3>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 pb-4 touch-pan-y">
              {clients.map((client) => (
                <Button
                  key={client.id}
                  type="button"
                  variant="ghost"
                  onClick={() => handleStartEdit(client)}
                  className="w-full min-h-12 h-auto justify-start bg-purple-900/70 hover:bg-purple-700 text-white rounded-xl px-3 py-3"
                >
                  <Pencil className="h-4 w-4 mr-3 shrink-0" />
                  {Number(client.value_paid) > 0 && (
                    <Star className="h-4 w-4 mr-2 shrink-0 fill-current text-green-400" aria-label="Valor cadastrado" />
                  )}
                  <span className="flex-1 text-left whitespace-normal break-words">{formatClientName(client.name)}</span>
                  {client.phone?.replace(/\D/g, "") ? (
                    <span className="ml-2 shrink-0 text-sm font-bold text-green-300 tabular-nums whitespace-nowrap">
                      {formatPhoneDisplay(client.phone)}
                    </span>
                  ) : null}
                </Button>
              ))}

              {clients.length === 0 && (
                <p className="py-8 text-center text-sm text-purple-200">Nenhum cliente cadastrado.</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

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
              value={editWhatsapp}
              onChange={(e) => setEditWhatsapp(formatPhone(e.target.value))}
              placeholder="WhatsApp (opcional)"
              inputMode="tel"
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
              <p className="text-xs text-white/70 mb-2">Giga da linha</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={editDataGb}
                  onChange={(e) => setEditDataGb(e.target.value)}
                  placeholder="Giga"
                  className="flex-1 h-10 sm:h-12 bg-purple-900/50 border border-purple-600 text-white rounded-xl text-sm px-3 outline-none focus:ring-2 focus:ring-purple-400"
                />
                {[2, 5, 10].map((gb) => (
                  <button
                    key={gb}
                    type="button"
                    onClick={() => setEditDataGb(String((Number(editDataGb.replace(",", ".")) || 0) + gb))}
                    className="h-10 sm:h-12 px-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold"
                  >
                    +{gb}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-white/70 mb-2">Giga já usado pelo cliente</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={editDataUsedGb}
                  onChange={(e) => setEditDataUsedGb(e.target.value)}
                  placeholder="Usado"
                  className="flex-1 h-10 sm:h-12 bg-purple-900/50 border border-purple-600 text-white rounded-xl text-sm px-3 outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  type="button"
                  onClick={() => setEditDataUsedGb("0")}
                  className="h-10 sm:h-12 px-3 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold"
                >
                  Zerar
                </button>
              </div>
            </div>
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
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                onClick={handleSaveEdit}
                className="h-10 sm:h-12 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm"
              >
                <Check className="h-4 w-4 mr-1" />
                Salvar
              </Button>
              <Button
                onClick={() => editingClient && handleDeleteClient(editingClient)}
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

      {clientToDelete && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70">
          <div className="bg-purple-800 rounded-2xl p-5 w-[88vw] max-w-sm">
            <h3 className="text-lg font-bold text-white">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-purple-100">
              Deseja excluir o cliente <strong>{clientToDelete.name}</strong>?
            </p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <Button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="h-11 bg-purple-700 hover:bg-purple-600 text-white rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDelete}
                className="h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
