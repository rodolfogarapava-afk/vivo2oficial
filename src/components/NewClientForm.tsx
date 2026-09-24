import { useState } from "react";
import { User, Phone, Star, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatClientName } from "@/lib/formatName";
import { useLineCosts } from "@/hooks/useLineCosts";

interface NewClientFormProps {
  onSubmit: (client: { name: string; phone: string; whatsapp: string | null; value_paid: number; due_day: number; virtual_chip: boolean; is_resale: boolean; bonus: boolean; already_paid: boolean; company: string; account: number | null; line_cost?: number | null }) => void;

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
  const [whatsapp, setWhatsapp] = useState("");
  const [valuePaid, setValuePaid] = useState("");
  const [dueDay, setDueDay] = useState<number>(10);
  const [virtualChip, setVirtualChip] = useState(false);
  const [isResale, setIsResale] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [lineCost, setLineCost] = useState<number | null>(null);
  const { list: costList } = useLineCosts();



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
      name: formatClientName(name),
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || null,
      value_paid: parseFloat(valuePaid),
      due_day: dueDay,
      virtual_chip: virtualChip,
      is_resale: isResale,
      bonus: false,
      already_paid: false,
      company: "omega",
      account: null,

    });

    setName("");
    setPhone("");
    setWhatsapp("");
    setValuePaid("");
    setDueDay(10);
    setVirtualChip(false);
    setIsResale(false);
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

        {/* WhatsApp opcional */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            WhatsApp (opcional)
          </label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="(00) 00000-0000"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
              className="pl-12 h-14 bg-primary/30 border-primary/50 text-foreground placeholder:text-muted-foreground rounded-xl text-base"
              inputMode="tel"
            />
          </div>
        </div>

        {/* Valor do Produto + Despesa fixa lado a lado */}
        <div className="grid grid-cols-2 gap-3">
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
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Despesa fixa
            </label>
            <div className="h-14 bg-primary/30 border border-primary/50 rounded-xl flex items-center justify-center text-foreground font-bold text-base">
              {formatCurrency(lineCost ?? fixedExpense)}
            </div>
          </div>
        </div>

        {/* Custo da linha */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Custo da linha
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLineCost(null)}
              className={`px-3 h-10 rounded-xl text-sm font-bold border ${lineCost === null ? 'bg-primary text-primary-foreground border-primary' : 'bg-primary/30 border-primary/50 text-foreground/80'}`}
            >
              Padrão {formatCurrency(fixedExpense)}
            </button>
            {costList.filter(c => c !== fixedExpense).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setLineCost(c)}
                className={`px-3 h-10 rounded-xl text-sm font-bold border ${lineCost === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-primary/30 border-primary/50 text-foreground/80'}`}
              >
                {formatCurrency(c)}
              </button>
            ))}
          </div>
          {costList.length === 0 && (
            <p className="text-[11px] text-muted-foreground">Adicione outros valores na engrenagem → Gasto por Cliente.</p>
          )}
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
