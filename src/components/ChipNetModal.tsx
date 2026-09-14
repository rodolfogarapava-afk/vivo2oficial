import { useState } from "react";
import { Loader2, LogIn, UserPlus, Signal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChipNetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current (main panel) user id, used to link the two panels. */
  ownerUserId?: string;
  /** Name of the other panel (resale), defined by the admin. */
  panelLabel?: string;
  onSwitched?: () => void;
}

const CHIPNET_DOMAIN = "chipnet.app";

const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

export const ChipNetModal = ({ open, onOpenChange, ownerUserId, onSwitched }: ChipNetModalProps) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const user = normalizeUsername(username);
    if (user.length < 3) {
      toast({ title: "Usuário inválido", description: "Use ao menos 3 caracteres (letras e números).", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha precisa ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }

    const email = `${user}@${CHIPNET_DOMAIN}`;
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        const newUserId = data.user?.id;
        if (newUserId && ownerUserId && newUserId !== ownerUserId) {
          await supabase
            .from("panel_links")
            .insert({ owner_user_id: ownerUserId, partner_user_id: newUserId, partner_label: "CHIP NET" });
        }
        toast({ title: "Painel CHIP NET criado!", description: `Bem-vindo, ${user}.` });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const newUserId = data.user?.id;
        if (newUserId && ownerUserId && newUserId !== ownerUserId) {
          await supabase
            .from("panel_links")
            .insert({ owner_user_id: ownerUserId, partner_user_id: newUserId, partner_label: "CHIP NET" });
        }
        toast({ title: "Painel CHIP NET", description: `Conectado como ${user}.` });
      }

      setUsername("");
      setPassword("");
      onOpenChange(false);
      onSwitched?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      toast({
        title: mode === "signup" ? "Não foi possível criar" : "Não foi possível entrar",
        description: message.includes("already registered")
          ? "Esse usuário já existe. Use a opção Entrar."
          : message.includes("Invalid login")
            ? "Usuário ou senha incorretos."
            : message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[92vw] rounded-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Signal className="h-5 w-5 text-cyan-400" />
            Painel CHIP NET
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`h-10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              mode === "login" ? "bg-cyan-600 text-white" : "bg-secondary text-foreground/70"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`h-10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              mode === "signup" ? "bg-cyan-600 text-white" : "bg-secondary text-foreground/70"
            }`}
          >
            Criar conta
          </button>
        </div>

        <div className="space-y-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuário"
            autoCapitalize="none"
            className="w-full h-11 rounded-xl bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full h-11 rounded-xl bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 text-sm font-extrabold uppercase tracking-wider text-white disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mode === "signup" ? (
            <UserPlus className="h-4 w-4" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {mode === "signup" ? "Criar painel" : "Abrir painel"}
        </button>

        <p className="text-[11px] leading-snug text-muted-foreground">
          O painel CHIP NET é uma conta separada com a mesma tela e as mesmas funções — cada um vê apenas as suas
          próprias linhas. A busca por telefone consulta os dois painéis.
        </p>
      </DialogContent>
    </Dialog>
  );
};
