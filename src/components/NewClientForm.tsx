import { useState } from "react";
import { User, Phone, Star, Store, Sparkles, CheckCircle2, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@/hooks/useAccounts";

interface NewClientFormProps {
  onSubmit: (client: { name: string; phone: string; value_paid: number; due_day: number; virtual_chip: boolean; is_resale: boolean; bonus: boolean; already_paid: boolean; company: string; account: number | null }) => void;

  onCancel: () => void;
  isLoading: boolean;
  fixedExpense: number;
  existingPhones?: string[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const NewClientForm = ({ onSubmit, onCancel, isLoading, fixedExpense, existingPhones = [] }: NewClientFormProps) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [valuePaid, setValuePaid] = useState("");
  const [dueDay, setDueDay] = useState<number>(10);
  const [virtualChip, setVirtualChip] = useState(false);
  const [isResale, setIsResale] = useState(false);
  const [bonus, setBonus] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [account, setAccount] = useState<number | null>(null);
  const { accounts } = useAccounts();



  const checkDuplicatePhone = (phoneValue: string) => {
    const digits = phoneValue.replace(/\D/g, "");
    if (digits.length === 0) {
      setPhoneError("");
      return;
    }
    const isDuplicate = existingPhones.some(p => p.replace(/\D/g, "") === digits);
    setPhoneError(isDuplicate ? "Este número já está cadastrado!" : "");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim() || !valuePaid || phoneError) return;

    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      value_paid: parseFloat(valuePaid),
      due_day: dueDay,
      virtual_chip: virtualChip,
      is_resale: isResale,
      bonus,
      already_paid: alreadyPaid,
      company: "omega",
      account,

    });

    setName("");
    setPhone("");
    setValuePaid("");
    setDueDay(10);
    setVirtualChip(false);
    setIsResale(false);
    setBonus(false);
    setAlreadyPaid(false);
  };

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

  const isFormValid = name.trim() && phone.trim() && valuePaid && !phoneError;

  return (
    <div className={`rounded-2xl p-5 ${isResale ? 'bg-blue-900/80 border-2 border-blue-600' : 'bg-card'}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Nome
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Digite o nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-12 h-14 bg-primary/30 border-primary/50 text-foreground placeholder:text-muted-foreground rounded-xl text-base"
              required
            />
          </div>
        </div>

        {/* Telefone */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Telefone
          </label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => {
                const value = e.target.value;
                const numbers = value.replace(/\D/g, "");

                if (numbers.length === 0) {
                  setPhone("");
                  setPhoneError("");
                  return;
                }

                const formatted = formatPhone(numbers);
                setPhone(formatted);
                checkDuplicatePhone(formatted);
              }}
              className={`pl-12 h-14 bg-primary/30 border-primary/50 text-foreground placeholder:text-muted-foreground rounded-xl text-base ${phoneError ? 'border-destructive' : ''}`}
              required
            />
          </div>
          {phoneError && (
            <p className="text-xs text-destructive font-medium mt-1">{phoneError}</p>
          )}
        </div>

        {/* Valor do Produto */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Valor do Produto
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={valuePaid}
            onChange={(e) => setValuePaid(e.target.value)}
            className="h-14 bg-primary/30 border-primary/50 text-foreground placeholder:text-muted-foreground rounded-xl text-base"
            required
          />
        </div>

        {/* Empresa */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Empresa
          </label>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              className="h-14 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 bg-primary text-primary-foreground shadow-[0_4px_0_0_#581c87]"
            >
              <Building2 className="h-4 w-4" />
              Raio Telecom
            </button>
          </div>
        </div>

        {/* Conta */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Conta
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setAccount(null)}
              className={`h-12 rounded-xl text-xs font-bold transition-all ${
                account === null
                  ? 'bg-primary text-primary-foreground shadow-[0_3px_0_0_#581c87]'
                  : 'bg-primary/30 border border-primary/50 text-foreground/70'
              }`}
            >
              —
            </button>
            {accounts.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAccount(n)}
                className={`h-12 rounded-xl text-base font-bold transition-all ${
                  account === n
                    ? 'bg-primary text-primary-foreground shadow-[0_3px_0_0_#581c87]'
                    : 'bg-primary/30 border border-primary/50 text-foreground/70'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>


        {/* Chip Virtual */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Tipo de Chip
          </label>
          <button
            type="button"
            onClick={() => setVirtualChip(!virtualChip)}
            className={`w-full h-14 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
              virtualChip 
                ? 'bg-yellow-500/20 border-2 border-yellow-400 text-yellow-400' 
                : isResale
                  ? 'bg-blue-800/50 border border-blue-500 text-foreground/70 hover:bg-blue-700/50'
                  : 'bg-primary/30 border border-primary/50 text-foreground/70 hover:bg-primary/40'
            }`}
          >
            <Star className={`h-5 w-5 ${virtualChip ? 'fill-yellow-400' : ''}`} />
            {virtualChip ? 'Chip Virtual' : 'Chip Físico'}
          </button>
        </div>

        {/* Revenda */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Tipo de Cliente
          </label>
          <button
            type="button"
            onClick={() => setIsResale(!isResale)}
            className={`w-full h-14 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
              isResale 
                ? 'bg-blue-500/30 border-2 border-blue-400 text-blue-400' 
                : 'bg-primary/30 border border-primary/50 text-foreground/70 hover:bg-primary/40'
            }`}
          >
            <Store className={`h-5 w-5 ${isResale ? 'text-blue-400' : ''}`} />
            {isResale ? 'Revenda' : 'Cliente Final'}
          </button>
        </div>

        {/* Bônus */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Bônus
          </label>
          <button
            type="button"
            onClick={() => setBonus(!bonus)}
            className={`w-full h-14 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
              bonus
                ? 'bg-white border-2 border-yellow-400 text-black'
                : 'bg-primary/30 border border-primary/50 text-foreground/70 hover:bg-primary/40'
            }`}
          >
            <Star className={`h-5 w-5 ${bonus ? 'fill-yellow-400 text-yellow-500' : ''}`} />
            {bonus ? 'Bônus ativado' : 'Marcar como Bônus'}
          </button>
        </div>

        {/* Já pagou este mês */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Pagamento deste mês
          </label>
          <button
            type="button"
            onClick={() => setAlreadyPaid(!alreadyPaid)}
            className={`w-full h-14 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
              alreadyPaid
                ? 'bg-green-500/20 border-2 border-green-400 text-green-400'
                : 'bg-primary/30 border border-primary/50 text-foreground/70 hover:bg-primary/40'
            }`}
          >
            <CheckCircle2 className={`h-5 w-5 ${alreadyPaid ? 'fill-green-400 text-green-900' : ''}`} />
            {alreadyPaid ? 'Já paguei este mês (só cobra no próximo)' : 'Já paguei este mês?'}
          </button>
        </div>


        {/* Despesa Fixa */}
        <div className="bg-primary/30 border border-primary/50 rounded-xl p-4 flex items-center justify-between">
          <span className="text-foreground font-medium">Despesa fixa</span>
          <span className="text-foreground font-bold text-xl">
            {formatCurrency(fixedExpense)}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            onClick={onCancel}
            className="flex-1 h-14 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-xl text-base"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !isFormValid}
            className="flex-1 h-14 bg-primary/60 hover:bg-primary/70 text-foreground/70 font-bold rounded-xl text-base disabled:opacity-50"
          >
            {isLoading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
};
