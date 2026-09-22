import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Loader2, LogOut, Search, X, Lock, Unlock, Ban, Save, Mail, UserPlus, Eye, EyeOff, Signal, RefreshCw, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ClientCard } from "@/components/ClientCard";
import { NewClientForm } from "@/components/NewClientForm";
import { SettingsModal } from "@/components/SettingsModal";
import { MonthlyReportModal } from "@/components/MonthlyReportModal";
import { DueTomorrowModal } from "@/components/DueTomorrowModal";
import { InstallPWA } from "@/components/InstallPWA";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { ResaleModal } from "@/components/ResaleModal";
import { PartnerPanelModal } from "@/components/PartnerPanelModal";
import { supabase } from "@/integrations/supabase/client";


import whatsappIcon from "@/assets/whatsapp-icon.png";

import { useClients, Client } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePaymentTracking } from "@/hooks/usePaymentTracking";
import { useBlockWhatsApp } from "@/hooks/useBlockWhatsApp";
import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { useVisibleDueDays } from "@/lib/dueDays";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { isFreeLine } from "@/hooks/useFreeLineColor";
import { checkForPWAUpdate } from "@/pwa";
import { usePanelPhones } from "@/hooks/usePanelPhones";
import { useAccessControl } from "@/hooks/useAccessControl";
import { usePanelNames } from "@/hooks/usePanelNames";
import { AccessBlocked } from "@/components/AccessBlocked";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getSentPaymentDaysFromStorage = (): number[] => {
  try {
    const saved = localStorage.getItem("payment_sent_days");
    if (!saved) return [];

    const data = JSON.parse(saved);
    return data.month === getCurrentMonthKey() && Array.isArray(data.days) ? data.days : [];
  } catch {
    return [];
  }
};

const Index = () => {
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDueTomorrow, setShowDueTomorrow] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDueDay, setSelectedDueDay] = useState<number | null>(null);
  const [sentPaymentDays, setSentPaymentDays] = useState<number[]>(getSentPaymentDaysFromStorage);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCancelClient, setSelectedCancelClient] = useState<Client | null>(null);
  const [blockSearchQuery, setBlockSearchQuery] = useState("");
  const [isCancelMessageLocked, setIsCancelMessageLocked] = useState(true);
  const [editedCancelMessage, setEditedCancelMessage] = useState("");
  const [showPaymentCards, setShowPaymentCards] = useState(() => {
    try { return localStorage.getItem("hide_payment_cards") !== "true"; } catch { return true; }
  });
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const [showShowConfirm, setShowShowConfirm] = useState(false);
  const [showResaleModal, setShowResaleModal] = useState(false);
  const [hidePaidClients, setHidePaidClients] = useState(() => {
    try { return localStorage.getItem("hide_paid_clients") === "true"; } catch { return false; }
  });
  const [showChipNet, setShowChipNet] = useState(false);
  const [showResellerPicker, setShowResellerPicker] = useState(false);
  const [openGestorList, setOpenGestorList] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>();
  const [crossPanelResults, setCrossPanelResults] = useState<
    { client_name: string; client_phone: string; panel: string }[]
  >([]);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, signOut } = useAuth();
  const { hasBlockPhone, sendBlockMessage, sendCancelMessage, settings: blockSettings } = useBlockWhatsApp();
  const { settings: whatsappSettings } = useWhatsAppSettings();
  const { isInPanel, refreshPanel } = usePanelPhones();
  
  const { 
    clients, 
    isLoading, 
    isOnline,
    addClient, 
    deleteClient,
    updateClient,
    toggleVirtualChip,
    toggleBlockClient,
    totalGross, 
    totalProfit, 
    fixedExpense,
    refetch
  } = useClients(user?.id);

  const { isAdmin, isBlocked, reload: reloadAccess } = useAccessControl(user?.id);
  const { otherPanelLabel, others: linkedPanels } = usePanelNames(user?.id);
  const selectedPartner = linkedPanels.find((panel) => panel.userId === selectedPartnerId) ?? linkedPanels[0];
  const otherPanelUserId = selectedPartner?.userId;
  const selectedPartnerLabel = selectedPartner?.label ?? otherPanelLabel;

  useEffect(() => {
    if (!selectedPartnerId && linkedPanels[0]?.userId) setSelectedPartnerId(linkedPanels[0].userId);
  }, [linkedPanels, selectedPartnerId]);

  useEffect(() => {
    const reloadSyncedClients = () => void refetch();
    window.addEventListener("vivo-panel-synced", reloadSyncedClients);
    return () => window.removeEventListener("vivo-panel-synced", reloadSyncedClients);
  }, [refetch]);


  const refreshApp = useCallback(async () => {
    if (!navigator.onLine) {
      toast({
        title: "Sem internet",
        description: "Conecte-se para buscar as informações mais recentes.",
        variant: "destructive",
      });
      return;
    }

    await refreshPanel();
    await Promise.allSettled([refetch(), checkForPWAUpdate()]);
    toast({
      title: "Atualizado!",
      description: "Clientes, painel Vivo e aplicativo estão atualizados.",
    });
  }, [refetch, refreshPanel, toast]);

  const { pullDistance, isRefreshing, pullHandlers } = usePullToRefresh(refreshApp);

  const {
    paidClientIds,
    togglePayment,
    isClientPaid,
    totalsByDay,
    remainingByDay,
  } = usePaymentTracking(clients, fixedExpense, user?.id);

  // Clientes que vencem amanhã e ainda não pagaram este mês
  const dueTomorrowClients = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = tomorrow.getDate();
    return clients
      .filter(
        (c) =>
          Number(c.due_day ?? 10) === day &&
          !String(c.name || "").toUpperCase().includes("CANCELADO") &&
          !c.bonus &&
          !paidClientIds.includes(c.id)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, paidClientIds]);

  // Busca o telefone nos dois painéis (principal + CHIP NET)
  useEffect(() => {
    const digits = searchQuery.replace(/\D/g, "");
    if (!user || digits.length < 4) {
      setCrossPanelResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("find_phone_across_panels", { p_phone: digits });
      if (!cancelled && !error && data) {
        setCrossPanelResults(data as { client_name: string; client_phone: string; panel: string }[]);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, user]);

  const { visibleDays } = useVisibleDueDays();
  const activeClients = useMemo(() => clients.filter(c => !c.name.toUpperCase().includes("CANCELADO")), [clients]);
  const billableClients = useMemo(() => activeClients.filter(c => !c.bonus), [activeClients]);
  const totalExpenses = billableClients.length * fixedExpense;

  // Stats per visible due day (excluding cancelled; bonus excluded from expenses)
  const dayStats = useMemo(
    () =>
      visibleDays.map((day) => ({
        day,
        clients: activeClients.filter(c => (c.due_day || 10) === day).length,
        total: totalsByDay[day] ?? 0,
        remaining: remainingByDay[day] ?? 0,
      })),
    [visibleDays, activeClients, totalsByDay, remainingByDay]
  );


  // Check if there are blocked clients
  const hasBlockedClients = useMemo(() => clients.some(c => c.blocked), [clients]);

  const filteredClients = useMemo(() => {
    let result = clients.filter(c => !c.bonus);

    // Filter by due day
    if (selectedDueDay !== null) {
      result = result.filter(client => (client.due_day || 10) === selectedDueDay);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const queryDigits = query.replace(/\D/g, "");
      result = result.filter(client => 
        client.name.toLowerCase().includes(query) ||
        client.phone.includes(query) ||
        (queryDigits && client.phone.replace(/\D/g, "").includes(queryDigits))
      );
    }
    
    if (hidePaidClients) {
      result = result.filter(client => !paidClientIds.includes(client.id));
    }

    // Linhas livres (nome começando com "LIVRE") sempre no topo da lista
    result = [...result].sort((a, b) => Number(isFreeLine(b.name)) - Number(isFreeLine(a.name)));

    return result;
  }, [clients, searchQuery, selectedDueDay, hidePaidClients, paidClientIds]);


  const handleAddClient = (client: { name: string; phone: string; whatsapp: string | null; value_paid: number; due_day: number; virtual_chip: boolean; is_resale: boolean; bonus: boolean; already_paid: boolean; company: string; account: number | null }) => {
    const { already_paid, ...clientData } = client;
    addClient.mutate(clientData, {
      onSuccess: (data) => {
        setShowForm(false);
        if (already_paid && data?.id) {
          // Mark as paid for current month so it only shows next month
          togglePayment(data.id);
        }
      },
    });
  };

  const handleBlockClick = () => {
    if (!hasBlockPhone) {
      toast({
        title: "Configure o número de bloqueio",
        description: "Vá em Configurações > Bloqueio e defina o número de destino.",
        variant: "destructive",
      });
      return;
    }
    setBlockSearchQuery("");
    setShowBlockModal(true);
  };

  const handleUnblockClick = () => {
    if (!hasBlockPhone) {
      toast({
        title: "Configure o número de bloqueio",
        description: "Vá em Configurações > Bloqueio e defina o número de destino.",
        variant: "destructive",
      });
      return;
    }
    setBlockSearchQuery("");
    setShowUnblockModal(true);
  };

  const handleSelectClientForBlock = (client: typeof clients[0]) => {
    toggleBlockClient.mutate({ id: client.id, blocked: true });
    sendBlockMessage(client.name, client.phone, true, whatsappSettings.useBusiness);
    setShowBlockModal(false);
  };

  const handleSelectClientForUnblock = (client: typeof clients[0]) => {
    toggleBlockClient.mutate({ id: client.id, blocked: false });
    sendBlockMessage(client.name, client.phone, false, whatsappSettings.useBusiness);
    setShowUnblockModal(false);
  };

  const handleCancelClick = () => {
    if (!hasBlockPhone) {
      toast({
        title: "Configure o número de bloqueio",
        description: "Vá em Configurações > Bloqueio e defina o número de destino.",
        variant: "destructive",
      });
      return;
    }
    setBlockSearchQuery("");
    setSelectedCancelClient(null);
    setShowCancelModal(true);
  };

  const handleSelectClientForCancel = (client: Client) => {
    setSelectedCancelClient(client);
    setEditedCancelMessage("");
    setIsCancelMessageLocked(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedCancelClient) return;
    const clientToCancel = selectedCancelClient;
    setShowCancelModal(false);
    
    // Rename client to "CANCELADO" and set value to 0
    try {
      await updateClient.mutateAsync({
        id: clientToCancel.id,
        name: `🚫 CANCELADO`,
        phone: clientToCancel.phone,
        value_paid: 0,
        due_day: clientToCancel.due_day,
      });
    } catch (err) {
      console.error("Erro ao cancelar cliente:", err);
    }

    setTimeout(() => {
      sendCancelMessage(clientToCancel.name, clientToCancel.phone, whatsappSettings.useBusiness, editedCancelMessage || undefined);
      toast({
        title: "Cliente cancelado",
        description: `${clientToCancel.name} foi marcado como cancelado.`,
      });
      setSelectedCancelClient(null);
    }, 300);
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const cancelMessagePreview = useMemo(() => {
    if (!selectedCancelClient) return "";
    const now = new Date();
    return blockSettings.cancelMessageTemplate
      .replace("{saudacao}", getGreeting())
      .replace("{nome}", selectedCancelClient.name)
      .replace("{telefone}", selectedCancelClient.phone)
      .replace("{data}", now.toLocaleDateString("pt-BR"))
      .replace("{hora}", now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }, [selectedCancelClient, blockSettings.cancelMessageTemplate]);

  const filteredClientsForBlock = useMemo(() => {
    if (!blockSearchQuery.trim()) return clients;
    const query = blockSearchQuery.toLowerCase();
    return clients.filter(client => 
      client.name.toLowerCase().includes(query) ||
      client.phone.includes(query)
    );
  }, [clients, blockSearchQuery]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível sair.",
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  useEffect(() => {
    const syncSentPaymentDays = () => {
      setSentPaymentDays(getSentPaymentDaysFromStorage());
    };

    window.addEventListener("payment-sent-updated", syncSentPaymentDays);
    window.addEventListener("storage", syncSentPaymentDays);

    return () => {
      window.removeEventListener("payment-sent-updated", syncSentPaymentDays);
      window.removeEventListener("storage", syncSentPaymentDays);
    };
  }, []);

  // Redirect to auth only if online, not loading, and no user
  useEffect(() => {
    if (!authLoading && !user && navigator.onLine) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Check if page was refreshed for update
  useEffect(() => {
    const wasRefreshed = localStorage.getItem("app_refreshed_for_update");
    if (wasRefreshed) {
      localStorage.removeItem("app_refreshed_for_update");
      toast({
        title: "App atualizado!",
        description: "Você está usando a versão mais recente.",
      });
    }
  }, [toast]);

  // Show loading only when we're actually waiting for data
  // Skip if offline and have cached user
  const showLoading = authLoading || (isLoading && navigator.onLine && !user);

  if (showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  // Don't render anything while redirecting (only when online)
  if (!user && navigator.onLine) {
    return null;
  }

  // If offline with no user, show message
  if (!user && !navigator.onLine) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-foreground text-lg">Você está offline</p>
          <p className="text-foreground/60 text-sm mt-2">
            Conecte-se à internet para fazer login
          </p>
        </div>
      </div>
    );
  }

  // Acesso vencido / sem token
  if (isBlocked) {
    return <AccessBlocked onUnlocked={() => void reloadAccess()} onSignOut={() => void signOut()} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background overflow-visible touch-pan-y" {...pullHandlers}>
      <div
        aria-live="polite"
        className={`fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground shadow-lg transition-all duration-200 ${
          pullDistance > 8 || isRefreshing ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
        }`}
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        {isRefreshing
          ? "Atualizando..."
          : pullDistance >= 72
            ? "Solte para atualizar"
            : "Puxe para atualizar"}
      </div>
      {/* Header card */}
      <header className="pt-4 pb-3 px-3">
        <div className="rounded-2xl border border-purple-900/50 bg-card/40 p-3 backdrop-blur-sm">
          {/* Top row: Gestor (ADM) / Painel parceiro / Novo */}
          <div className={`grid gap-2 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
            {isAdmin && (
              <div className="[&>button]:w-full [&>button]:h-11 [&>button]:rounded-xl [&>button]:border-2 [&>button]:border-green-500/70 [&>button]:bg-transparent [&>button]:text-green-400 [&>button]:justify-center [&>button]:text-xs [&>button]:font-bold">
                <OfflineIndicator onClick={() => {
                  setOpenGestorList(true);
                  setShowSettings(true);
                }} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowResellerPicker(true)}
              className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 border border-cyan-300/50 shadow-[0_3px_0_0_#155e75] hover:translate-y-[1px] active:translate-y-[2px] transition-all"
              title="Escolher revenda"
            >
              <Signal className="h-4 w-4 text-white" strokeWidth={2.5} />
              <span className="truncate text-xs font-extrabold text-white uppercase tracking-wider">Revenda</span>
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-gradient-to-b from-purple-600 to-purple-800 border border-purple-400/50 shadow-[0_3px_0_0_#581c87] hover:translate-y-[1px] active:translate-y-[2px] transition-all"
              title="Novo Cliente"
            >
              <UserPlus className="h-4 w-4 text-white" strokeWidth={2.5} />
              <span className="text-xs font-extrabold text-white uppercase tracking-wider">Novo</span>
            </button>
          </div>


          {/* Bottom row: Buscar / Visualizar / Configurações / Sair (tiles) */}
          <div className="mt-2 grid grid-cols-4 gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border border-purple-700/60 bg-purple-950/40 text-purple-100 hover:bg-purple-900/40 transition-colors"
              title="Buscar"
            >
              <Search className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Buscar</span>
            </button>
            <button
              onClick={() => {
                const next = !hidePaidClients;
                setHidePaidClients(next);
                try { localStorage.setItem("hide_paid_clients", String(next)); } catch {}
              }}
              className={`flex flex-col items-center justify-center gap-1 h-16 rounded-xl border transition-colors ${
                hidePaidClients
                  ? "border-green-500/60 bg-green-900/30 text-green-300"
                  : "border-purple-700/60 bg-purple-950/40 text-purple-100 hover:bg-purple-900/40"
              }`}
              title={hidePaidClients ? "Mostrar pagos" : "Ocultar pagos"}
            >
              {hidePaidClients ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              <span className="text-[10px] font-bold uppercase tracking-wider">Visualizar</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border border-purple-700/60 bg-purple-950/40 text-purple-100 hover:bg-purple-900/40 transition-colors"
              title="Configurações"
            >
              <Settings className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider leading-tight text-center">Config.</span>
            </button>
            {user ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border border-purple-700/60 bg-purple-950/40 text-purple-100 hover:bg-purple-900/40 transition-colors"
                    title="Sair"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Sair</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">Deseja sair?</AlertDialogTitle>
                    <AlertDialogDescription className="text-foreground/70">
                      Você será desconectado da sua conta.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-secondary text-secondary-foreground border-border">
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleSignOut}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sair
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div className="h-16" />
            )}
          </div>

          {/* Email row */}
          {user && (
            <>
              <div className="mt-3 h-px bg-purple-800/50" />
              <div className="mt-2 flex items-center justify-center gap-2">
                <Mail className="h-4 w-4 text-purple-400" />
                <p className="text-purple-200 text-xs font-medium truncate">{user.email}</p>
              </div>
            </>
          )}

          {/* Search Input */}
          {showSearch && (
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Buscar por nome ou telefone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-purple-950/50 border-purple-700/60 text-foreground placeholder:text-foreground/50"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Financial totals */}
      <div className="mx-3 grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-xl border border-purple-700/60 bg-purple-950/40 px-2 py-3 text-center">
          <p className="text-[9px] font-bold uppercase text-purple-300">Total</p>
          <p className="mt-1 truncate text-xs font-extrabold text-white" title={totalGross.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}>
            {totalGross.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-red-700/60 bg-red-950/30 px-2 py-3 text-center">
          <p className="text-[9px] font-bold uppercase text-red-300">Gastos</p>
          <p className="mt-1 truncate text-xs font-extrabold text-red-400" title={totalExpenses.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}>
            {totalExpenses.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-green-700/60 bg-green-950/30 px-2 py-3 text-center">
          <p className="text-[9px] font-bold uppercase text-green-300">Lucro</p>
          <p className="mt-1 truncate text-xs font-extrabold text-green-400" title={totalProfit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}>
            {totalProfit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
      </div>

      {/* Cobrança de amanhã */}
      <div className="mx-3 mt-2">
        <button
          type="button"
          onClick={() => setShowDueTomorrow(true)}
          className="flex w-full items-center justify-between rounded-xl border border-purple-700/60 bg-purple-950/40 px-3 py-2 active:scale-[0.99]"
          aria-label="Abrir lista de quem vence amanhã"
        >
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-white" />
            <span className="text-xs font-extrabold uppercase text-white">Vence amanhã</span>
          </span>
          <span className="rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-extrabold text-white tabular-nums">
            {dueTomorrowClients.length}
          </span>
        </button>
      </div>




      {/* Cross-panel phone lookup */}
      {searchQuery.replace(/\D/g, "").length >= 4 && crossPanelResults.length > 0 && (
        <div className="mx-3 mt-3 rounded-2xl border border-cyan-700/50 bg-cyan-950/30 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 mb-2">
            Número encontrado nos painéis
          </p>
          <div className="space-y-1">
            {crossPanelResults.map((r, i) => (
              <div key={`${r.client_phone}-${i}`} className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground truncate">{r.client_name}</span>
                <span className="text-[10px] font-bold uppercase text-cyan-300 whitespace-nowrap">{r.panel}</span>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Hide payment cards confirmation */}
      <AlertDialog open={showHideConfirm} onOpenChange={setShowHideConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Ocultar informações?</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Deseja ocultar os cards de pagamento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-secondary-foreground border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { localStorage.setItem("hide_payment_cards", "true"); setShowPaymentCards(false); setShowHideConfirm(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ocultar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Show payment cards confirmation */}
      <AlertDialog open={showShowConfirm} onOpenChange={setShowShowConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Mostrar informações?</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Deseja mostrar os cards de pagamento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-secondary-foreground border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { localStorage.removeItem("hide_payment_cards"); setShowPaymentCards(true); setShowShowConfirm(false); }} className="bg-green-600 text-white hover:bg-green-700">
              Mostrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resale Modal */}
      <ResaleModal
        open={showResaleModal}
        onOpenChange={setShowResaleModal}
        clients={clients}
      />

      <PartnerPanelModal
        open={showChipNet}
        onOpenChange={setShowChipNet}
        partnerUserId={otherPanelUserId}
        panelLabel={selectedPartnerLabel}
        panels={linkedPanels}
        onSelectPanel={setSelectedPartnerId}
      />

      <Dialog open={showResellerPicker} onOpenChange={setShowResellerPicker}>
        <DialogContent className="w-[92vw] max-w-sm rounded-xl border-border bg-card p-4">
          <DialogHeader>
            <DialogTitle className="text-foreground">Escolher revenda</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60dvh] space-y-2 overflow-y-auto overscroll-contain pt-1">
            {linkedPanels.map((panel) => (
              <button
                key={panel.userId}
                type="button"
                onClick={() => {
                  setSelectedPartnerId(panel.userId);
                  setShowResellerPicker(false);
                  setShowChipNet(true);
                }}
                className="flex h-14 w-full items-center gap-3 rounded-lg border border-border bg-secondary px-4 text-left text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <Signal className="h-5 w-5 shrink-0 text-cyan-400" />
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold uppercase">{panel.label}</span>
              </button>
            ))}
            {linkedPanels.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma revenda cadastrada.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* New Client Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="p-0 border-0 bg-transparent max-w-md w-[95vw] max-h-[90vh] overflow-y-auto shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <NewClientForm
            onSubmit={handleAddClient}
            onCancel={() => setShowForm(false)}
            isLoading={addClient.isPending}
            fixedExpense={fixedExpense}
            existingPhones={clients.map(c => c.phone)}
          />
        </DialogContent>
      </Dialog>


      {/* Client List */}
      <div className="mt-6 px-4 pb-24 space-y-3">
        {clients.length === 0 && !showForm ? (
          <div className="text-center py-12">
            <p className="text-foreground/70 text-lg">Nenhum cliente cadastrado</p>
            <p className="text-foreground/50 text-sm mt-1">
              Toque em "Novo Cliente" para começar
            </p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-foreground/70 text-lg">Nenhum cliente encontrado</p>
            <p className="text-foreground/50 text-sm mt-1">
              Tente buscar por outro termo
            </p>
          </div>
        ) : (
          filteredClients.map((client, index) => (
            <ClientCard 
              key={client.id} 
              client={client} 
              index={index}
              onToggleVirtualChip={(id, virtual_chip) => toggleVirtualChip.mutate({ id, virtual_chip })}
              onBlockClient={(id, blocked) => toggleBlockClient.mutate({ id, blocked })}
              isPaid={isClientPaid(client.id)}
              onTogglePayment={togglePayment}
              dayPaymentSent={sentPaymentDays.includes(client.due_day || 10)}
              inPanel={isInPanel(client.phone)}
            />
          ))
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        clients={clients}
        fixedExpense={fixedExpense}
        onDeleteClient={(id) => deleteClient.mutate(id)}
        onEditClient={(id, data) => updateClient.mutate({ id, ...data })}
        onBlockClient={(id, blocked) => toggleBlockClient.mutate({ id, blocked })}
        onRefresh={refetch}
        totalsByDay={totalsByDay}
        remainingByDay={remainingByDay}
        onReportClick={() => setShowReport(true)}
        showPaymentCards={showPaymentCards}
        onTogglePaymentCards={() => showPaymentCards ? setShowHideConfirm(true) : setShowShowConfirm(true)}

        onPaymentSent={(days: number[]) => setSentPaymentDays(days)}
        onCancelClick={handleCancelClick}
        onBlockClick={handleBlockClick}
        onUnblockClick={handleUnblockClick}
        hasBlockedClients={hasBlockedClients}
        isAdmin={isAdmin}
        userId={user?.id}
        openPanelListOnOpen={openGestorList}
        onPanelListOpened={() => setOpenGestorList(false)}
      />

      {/* Monthly report */}
      {showReport && (
        <MonthlyReportModal
          open
          onClose={() => setShowReport(false)}
          clients={clients}
          fixedExpense={fixedExpense}
          userId={user?.id}
        />
      )}

      {/* Cobrança de amanhã */}
      <DueTomorrowModal
        open={showDueTomorrow}
        onClose={() => setShowDueTomorrow(false)}
        clients={dueTomorrowClients}
        template={whatsappSettings.clientMessageTemplate}
        useBusiness={whatsappSettings.useBusiness}
        onTogglePayment={togglePayment}
      />

      {/* Install PWA Banner */}
      <InstallPWA />

      {/* Block Client Modal */}
      <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
        <DialogContent className="bg-card border-border max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground">Selecionar Cliente para Bloquear</DialogTitle>
          </DialogHeader>
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Buscar cliente..."
              value={blockSearchQuery}
              onChange={(e) => setBlockSearchQuery(e.target.value)}
              className="bg-primary/30 border-primary/50 text-foreground"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh]">
            {filteredClientsForBlock.map((client) => (
              <button
                key={client.id}
                onClick={() => handleSelectClientForBlock(client)}
                className="w-full p-3 rounded-lg bg-primary/20 hover:bg-primary/30 text-left transition-colors"
              >
                <p className="font-semibold text-foreground">{client.name}</p>
                <p className="text-sm text-muted-foreground">{client.phone}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unblock Client Modal */}
      <Dialog open={showUnblockModal} onOpenChange={setShowUnblockModal}>
        <DialogContent className="bg-card border-border max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground">Selecionar Cliente para Desbloquear</DialogTitle>
          </DialogHeader>
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Buscar cliente..."
              value={blockSearchQuery}
              onChange={(e) => setBlockSearchQuery(e.target.value)}
              className="bg-primary/30 border-primary/50 text-foreground"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh]">
            {filteredClientsForBlock.map((client) => (
              <button
                key={client.id}
                onClick={() => handleSelectClientForUnblock(client)}
                className="w-full p-3 rounded-lg bg-primary/20 hover:bg-primary/30 text-left transition-colors"
              >
                <p className="font-semibold text-foreground">{client.name}</p>
                <p className="text-sm text-muted-foreground">{client.phone}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Client Modal */}
      <Dialog open={showCancelModal} onOpenChange={(open) => {
        setShowCancelModal(open);
        if (!open) {
          setSelectedCancelClient(null);
          setIsCancelMessageLocked(true);
          setEditedCancelMessage("");
        }
      }}>
        <DialogContent className="bg-card border-border max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedCancelClient ? "Confirmar Cancelamento" : "Selecionar Cliente para Cancelar"}
            </DialogTitle>
          </DialogHeader>

          {!selectedCancelClient ? (
            <>
              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={blockSearchQuery}
                  onChange={(e) => setBlockSearchQuery(e.target.value)}
                  className="bg-primary/30 border-primary/50 text-foreground"
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh]">
                {filteredClientsForBlock.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClientForCancel(client)}
                    className="w-full p-3 rounded-lg bg-primary/20 hover:bg-primary/30 text-left transition-colors"
                  >
                    <p className="font-semibold text-foreground">{client.name}</p>
                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-orange-500/20 border border-orange-500/30">
                <p className="font-semibold text-foreground">{selectedCancelClient.name}</p>
                <p className="text-sm text-muted-foreground">{selectedCancelClient.phone}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Mensagem que será enviada:</p>
                  <div className="flex items-center gap-1">
                    {!isCancelMessageLocked && (
                      <button
                        onClick={() => {
                          // Convert rendered message back to template with placeholders
                          let templateToSave = editedCancelMessage;
                          if (selectedCancelClient) {
                            // Replace greeting back to placeholder
                            const greetings = ["Bom dia", "Boa tarde", "Boa noite"];
                            greetings.forEach(g => {
                              templateToSave = templateToSave.replace(new RegExp(g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '{saudacao}');
                            });
                            // Replace name
                            templateToSave = templateToSave
                              .replace(new RegExp(selectedCancelClient.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '{nome}');
                            // Replace phone - try exact match first, then digits-only match
                            const phoneEscaped = selectedCancelClient.phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            templateToSave = templateToSave.replace(new RegExp(phoneEscaped, 'g'), '{telefone}');
                            // Also try matching any formatted version of the same digits
                            const phoneDigits = selectedCancelClient.phone.replace(/\D/g, '');
                            if (phoneDigits.length >= 10) {
                              const phonePattern = phoneDigits.split('').join('[^\\d]*');
                              templateToSave = templateToSave.replace(new RegExp(phonePattern, 'g'), '{telefone}');
                            }
                          }
                          const saved = localStorage.getItem("block-whatsapp-settings");
                          const current = saved ? JSON.parse(saved) : {};
                          current.cancelMessageTemplate = templateToSave;
                          localStorage.setItem("block-whatsapp-settings", JSON.stringify(current));
                          setIsCancelMessageLocked(true);
                          toast({
                            title: "Template salvo",
                            description: "A mensagem será usada para todos os cancelamentos futuros.",
                          });
                        }}
                        className="p-1.5 rounded-lg transition-all bg-green-500/20 hover:bg-green-500/30 text-green-400"
                        title="Salvar template para todos"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (isCancelMessageLocked) {
                          setEditedCancelMessage(cancelMessagePreview);
                        }
                        setIsCancelMessageLocked(!isCancelMessageLocked);
                      }}
                      className={`p-1.5 rounded-lg transition-all ${
                        isCancelMessageLocked 
                          ? 'bg-muted hover:bg-muted/80 text-muted-foreground' 
                          : 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400'
                      }`}
                      title={isCancelMessageLocked ? "Editar mensagem" : "Travar mensagem"}
                    >
                      {isCancelMessageLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {isCancelMessageLocked ? (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground whitespace-pre-line max-h-[30vh] overflow-y-auto">
                    {editedCancelMessage || cancelMessagePreview}
                  </div>
                ) : (
                  <textarea
                    value={editedCancelMessage}
                    onChange={(e) => setEditedCancelMessage(e.target.value)}
                    className="w-full p-3 rounded-lg bg-muted/50 border border-yellow-500/50 text-sm text-foreground whitespace-pre-line max-h-[30vh] min-h-[120px] overflow-y-auto resize-none focus:outline-none focus:border-yellow-400"
                    autoFocus
                  />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCancelClient(null)}
                  className="flex-1 p-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleConfirmCancel}
                  className="flex-1 p-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <img src={whatsappIcon} alt="WhatsApp" className="w-5 h-5" />
                  Enviar WhatsApp
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
