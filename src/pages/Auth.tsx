import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Phone, KeyRound } from "lucide-react";
import { redeemAccessToken } from "@/hooks/useAccessControl";
import vivoLogo from "@/assets/vivo-logo.png";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "A senha deve ter no mínimo 6 caracteres");
const whatsappSchema = z.string().regex(/^\d{10,11}$/, "WhatsApp deve ter 10 ou 11 dígitos").optional().or(z.literal(""));
const tokenSchema = z.string().trim().min(6, "Informe o token de acesso").max(40, "Token muito longo");

type AuthMode = "login" | "signup" | "forgot" | "reset";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(() => {
    const urlMode = searchParams.get("mode");
    return urlMode === "reset" ? "reset" : "login";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; whatsapp?: string; token?: string }>({});
  const isOwnerEmail = email.trim().toLowerCase() === "www.raio.top@gmail.com";
  
  const { signIn, signUp, resetPassword, updatePassword, user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading && mode !== "reset") {
      navigate("/");
    }
  }, [user, loading, navigate, mode]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; whatsapp?: string; token?: string } = {};
    
    if (mode !== "reset") {
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        newErrors.email = emailResult.error.errors[0].message;
      }
    }
    
    if (mode === "login" || mode === "signup" || mode === "reset") {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    }

    if (mode === "signup" && !isOwnerEmail) {
      const tokenResult = tokenSchema.safeParse(accessToken);
      if (!tokenResult.success) {
        newErrors.token = tokenResult.error.errors[0].message;
      }
    }

    if (mode === "signup" && whatsapp) {
      const whatsappResult = whatsappSchema.safeParse(whatsapp);
      if (!whatsappResult.success) {
        newErrors.whatsapp = whatsappResult.error.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials") && isOwnerEmail) {
            const { data, error: signupError } = await signUp(email, password, whatsapp || undefined);
            if (signupError) {
              toast({
                title: "Não foi possível criar a conta",
                description: signupError.message.includes("weak")
                  ? "Escolha uma senha mais forte, com letras maiúsculas, minúsculas, números e símbolo."
                  : signupError.message,
                variant: "destructive",
              });
            } else if (data.session) {
              toast({ title: "Conta criada!", description: "Acesso de administrador liberado." });
            } else {
              toast({
                title: "Confirme seu e-mail",
                description: "Enviamos um link para seu e-mail. Confirme e depois toque em Entrar.",
              });
            }
          } else if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Erro no login",
              description: "Email ou senha incorretos. Verifique seus dados.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erro no login",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Bem-vindo!",
            description: "Login realizado com sucesso.",
          });
        }
      } else if (mode === "signup") {
        const { data, error } = await signUp(email, password, whatsapp || undefined);
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Erro no cadastro",
              description: "Este email já está cadastrado. Tente fazer login.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erro no cadastro",
              description: error.message,
              variant: "destructive",
            });
          }
        } else if (isOwnerEmail) {
          toast({
            title: data.session ? "Conta criada!" : "Confirme seu e-mail",
            description: data.session
              ? "Acesso de administrador liberado."
              : "Enviamos um link para seu e-mail. Confirme e depois toque em Entrar.",
          });
        } else {
          try {
            const result = await redeemAccessToken(accessToken);
            toast({
              title: "Conta criada!",
              description:
                result.plan === "lifetime"
                  ? "Acesso vitalício liberado."
                  : "Acesso liberado por 30 dias.",
            });
          } catch (redeemError) {
            const message = redeemError instanceof Error ? redeemError.message : "";
            toast({
              title: "Conta criada, mas o token não foi aceito",
              description:
                message === "TOKEN_NOT_FOUND"
                  ? "Esse token não existe, já foi usado ou foi cancelado. Fale com o administrador."
                  : "Confirme seu e-mail, entre e digite o token novamente.",
              variant: "destructive",
            });
          }
        }
      } else if (mode === "forgot") {
        const { error } = await resetPassword(email);
        if (error) {
          toast({
            title: "Erro",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Email enviado!",
            description: "Verifique sua caixa de entrada para redefinir sua senha.",
          });
          setMode("login");
        }
      } else if (mode === "reset") {
        const { error } = await updatePassword(password);
        if (error) {
          toast({
            title: "Erro",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Senha atualizada!",
            description: "Sua senha foi alterada com sucesso.",
          });
          navigate("/");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Entre na sua conta";
      case "signup": return "Crie sua conta";
      case "forgot": return "Recuperar senha";
      case "reset": return "Nova senha";
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case "login": return "Entrar";
      case "signup": return "Cadastrar";
      case "forgot": return "Enviar email";
      case "reset": return "Atualizar senha";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-900">
        <Loader2 className="h-8 w-8 animate-spin text-purple-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-purple-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <img 
            src={vivoLogo} 
            alt="Vivo Logo" 
            className="w-24 h-24 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-white">Cliente Vivo</h1>
          <p className="text-purple-200 mt-2">{getTitle()}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email field - shown in login, signup, forgot */}
          {mode !== "reset" && (
            <div className="space-y-2">
              <Label htmlFor="email" className="text-purple-100">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-300" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="seu@email.com"
                  className="pl-10 bg-purple-800 border-purple-600 text-white placeholder:text-purple-300"
                />
              </div>
              {errors.email && (
                <p className="text-red-300 text-sm">{errors.email}</p>
              )}
            </div>
          )}

          {/* Owner's support number is inherited automatically by reseller accounts. */}
          {mode === "signup" && isOwnerEmail && (
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="text-purple-100">
                Meu WhatsApp de suporte (opcional)
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-300" />
                <Input
                  id="whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setWhatsapp(value);
                    setErrors((prev) => ({ ...prev, whatsapp: undefined }));
                  }}
                  placeholder="11999999999"
                  maxLength={11}
                  className="pl-10 bg-purple-800 border-purple-600 text-white placeholder:text-purple-300"
                />
              </div>
              {errors.whatsapp && (
                <p className="text-red-300 text-sm">{errors.whatsapp}</p>
              )}
            </div>
          )}

          {/* Access token - signup only */}
          {mode === "signup" && !isOwnerEmail && (
            <div className="space-y-2">
              <Label htmlFor="token" className="text-purple-100">Token de acesso</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-300" />
                <Input
                  id="token"
                  value={accessToken}
                  onChange={(e) => {
                    setAccessToken(e.target.value.toUpperCase());
                    setErrors((prev) => ({ ...prev, token: undefined }));
                  }}
                  placeholder="RAIO-XXXX-XXXX"
                  autoCapitalize="characters"
                  className="pl-10 bg-purple-800 border-purple-600 text-white placeholder:text-purple-300 tracking-widest"
                />
              </div>
              {errors.token ? (
                <p className="text-red-300 text-sm">{errors.token}</p>
              ) : (
                <p className="text-purple-300 text-xs">Peça o token ao administrador.</p>
              )}
            </div>
          )}

          {/* Password field - shown in login, signup, reset */}
          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-purple-100">
                {mode === "reset" ? "Nova senha" : "Senha"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-300" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="••••••"
                  className="pl-10 bg-purple-800 border-purple-600 text-white placeholder:text-purple-300"
                />
              </div>
              {errors.password && (
                <p className="text-red-300 text-sm">{errors.password}</p>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-6"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              getButtonText()
            )}
          </Button>
        </form>

        {/* Forgot password link - shown in login */}
        {mode === "login" && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setErrors({});
              }}
              className="text-purple-300 text-sm hover:underline"
            >
              Esqueceu a senha?
            </button>
          </div>
        )}

        {/* Toggle Login/Signup */}
        <div className="mt-6 text-center">
          {mode === "login" && (
            <p className="text-purple-200">
              Não tem conta?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setErrors({});
                }}
                className="text-white font-semibold hover:underline"
              >
                Cadastre-se
              </button>
            </p>
          )}
          {mode === "signup" && (
            <p className="text-purple-200">
              Já tem conta?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrors({});
                }}
                className="text-white font-semibold hover:underline"
              >
                Entrar
              </button>
            </p>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <p className="text-purple-200">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrors({});
                }}
                className="text-white font-semibold hover:underline"
              >
                Voltar ao login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;