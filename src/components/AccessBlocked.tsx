import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { redeemAccessToken } from "@/hooks/useAccessControl";
import { useToast } from "@/hooks/use-toast";

interface AccessBlockedProps {
  onUnlocked: () => void;
  onSignOut: () => void;
}

export const AccessBlocked = ({ onUnlocked, onSignOut }: AccessBlockedProps) => {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const automaticRedemptionStarted = useRef(false);

  useEffect(() => {
    const pendingResellerToken = localStorage.getItem("pending_reseller_token")?.trim() ?? "";
    if (!pendingResellerToken || automaticRedemptionStarted.current) return;

    automaticRedemptionStarted.current = true;
    setLoading(true);
    void redeemAccessToken(pendingResellerToken)
      .then(() => {
        localStorage.removeItem("pending_reseller_token");
        toast({ title: "Revenda ativada!", description: "Abrindo seu painel." });
        onUnlocked();
      })
      .catch((error) => {
        console.error("Não foi possível ativar a revenda pelo link:", error);
        toast({
          title: "Não foi possível ativar a revenda",
          description: "Abra novamente o link enviado pelo administrador.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [onUnlocked, toast]);

  const handleRedeem = async () => {
    if (code.trim().length < 6) {
      toast({ title: "Token inválido", description: "Digite o token completo.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await redeemAccessToken(code);
      localStorage.removeItem("pending_reseller_token");
      toast({
        title: "Acesso liberado!",
        description: result.plan === "lifetime" ? "Acesso vitalício." : "Acesso válido por 30 dias.",
      });
      setCode("");
      onUnlocked();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast({
        title: "Não foi possível liberar",
        description:
          message === "TOKEN_NOT_FOUND"
            ? "Esse token não existe, já foi usado ou foi cancelado."
            : message === "RESELLER_PROFILE_INCOMPLETE"
              ? "Abra novamente o link da revenda e complete seus dados."
            : "Confira o token e tente de novo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-yellow-400" />
          <h1 className="text-lg font-extrabold text-foreground">Acesso vencido</h1>
        </div>
        <p className="text-sm text-muted-foreground leading-snug">
          Seu acesso não está ativo. Fale com o administrador e digite abaixo o token que ele te enviar.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="RAIO-XXXX-XXXX"
          autoCapitalize="characters"
          className="w-full h-12 rounded-xl bg-secondary border border-border px-3 text-center text-base font-bold tracking-widest text-foreground outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="button"
          onClick={handleRedeem}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-purple-600 to-purple-800 text-sm font-extrabold uppercase tracking-wider text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Liberar acesso
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary text-xs font-bold uppercase tracking-wider text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
};
