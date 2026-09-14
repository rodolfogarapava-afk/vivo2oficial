# Relatório de ganhos por mês

Uma tela nova no app que responde, para o mês que você escolher: quanto entrou, quanto ainda falta entrar, quanto foi de gasto e quanto sobrou de lucro — e a lista de quem pagou e quem está devendo.

## O que você vai ver

Um botão novo **Ganhos** (ícone de gráfico) na fileira de cima da tela inicial, ao lado de Gestor e Chip Net. Tocando nele, abre uma tela em tela cheia:

```text
+--------------------------------------------+
|  <  Setembro 2026                      >   |
+--------------------------------------------+
| RECEBIDO      | A RECEBER   | GASTOS      |
| R$ 1.240,00   | R$ 320,00   | R$ 1.519,62 |
+--------------------------------------------+
| LUCRO DO MÊS                    R$ -279,62 |
+--------------------------------------------+
| PAGO (38)                                  |
|  Alessandra Damaceno      (65) 9... R$ 40  |
|  Cleverton Jean do Amaral (65) 9... R$ 40  |
| DEVENDO (14)                               |
|  Maria da Silva           (65) 9... R$ 40  |
+--------------------------------------------+
| SET 1.240  AGO 1.310  JUL 1.180  ...       |
+--------------------------------------------+
```

- **Setas** trocam o mês (e um botão "Hoje" volta para o mês atual).
- **Recebido** = soma do que foi marcado como pago naquele mês.
- **A receber** = quanto falta entrar no mês.
- **Gastos** = quantidade de linhas pagantes × gasto fixo (39,99).
- **Lucro** = recebido − gastos (vermelho quando negativo).
- **Pago** em verde com o valor de cada um; **Devendo** em vermelho, com o valor e o dia de vencimento.
- Na barra final, o recebido dos últimos 6 meses, para comparar.
- Quem está cancelado ou é bônus não entra na conta (mesma regra dos totais de hoje).

## Correções que precisam vir junto

Sem isso o relatório sairia com número errado:

1. **O gasto fixo não está salvo na sua conta.** Hoje ele só existe na memória do seu celular: ao abrir em outro aparelho ou depois de limpar dados, volta para 60. Vou criar o registro da sua conta no banco (hoje ele **não existe**) e gravar 39,99 lá.
2. **O valor de cada pagamento não é guardado.** Hoje o app marca "pagou" sem anotar quanto. Se você mudar o preço de um cliente depois, o mês antigo seria recalculado errado. Vou gravar o valor junto da marcação.
3. **Conferir se marcar pago chega no banco.** A tabela de pagamentos está **vazia** — nenhum pagamento registrado chegou lá até hoje. Vou testar marcando um cliente e conferindo o registro real antes de contar qualquer coisa.

## Sobre meses passados

Não existe histórico para trás: como nada foi marcado no banco até hoje, o relatório começa a contar **daqui em diante**. O mês atual já aparece preenchido conforme você for marcando os pagamentos.

## Detalhes técnicos

**Banco (migração única, com GRANTs já existentes na tabela):**
```sql
ALTER TABLE public.client_payments
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NOT NULL DEFAULT now();
```
Sem tabela nova, sem mudança de políticas (a de dono já cobre tudo).

**Perfil na nuvem (`profiles` está com 0 linhas e sem gatilho de criação):**
- `useFixedExpense` e `useWhatsAppSettings` hoje fazem `UPDATE ... WHERE user_id = ...`, que **não encontra linha nenhuma** e não salva nada — é por isso que o 39,99 não sobrevive.
- Trocar os dois para **upsert** em `profiles` (o índice único em `user_id` já existe), criando a linha na primeira vez, e subir o valor salvo no aparelho quando a nuvem estiver vazia.

**Pagamentos (`src/hooks/usePaymentTracking.ts`):**
- Ao marcar pago: inserir `amount` = `value_paid` do cliente no momento, e `paid_at`.
- Verificar o erro retornado em vez de engolir (hoje um erro de gravação passa despercebido).

**Novo hook `src/hooks/useMonthlyReport.ts`:**
- Busca `client_payments` do mês (`user_id`, `month`, com `amount`) e junta com `clients`.
- Regras: ativo = nome sem "CANCELADO"; pagante = ativo e sem bônus; esperado = soma de `value_paid` dos pagantes; recebido = soma de `amount` (usando `value_paid` quando `amount` for nulo); gastos = pagantes × gasto fixo.
- Mesmas chaves de mês do app hoje: `YYYY-MM`.

**Interface:**
- `src/components/MonthlyReportModal.tsx`: tela em portal (mesmo padrão já usado na "Lista de nomes do gestor"), com seletor de mês, as 4 caixas de resumo, as listas Pago/Devendo roláveis e a faixa dos últimos 6 meses.
- `src/pages/Index.tsx`: fileira de cima passa de 3 para 4 botões (`grid-cols-4`) com o novo **Ganhos**; estado `showReport` e passagem de `clients`/`fixedExpense`.
- Cores e tema claro seguem os tokens do app (letras pretas no claro).

**Como vou conferir:**
1. Marcar um cliente como pago pelo navegador de teste e confirmar na tabela que a linha tem `amount` e `paid_at`.
2. Conferir que `profiles` passou a ter sua linha com `fixed_expense = 39.99`.
3. Abrir a tela de relatório em dois meses diferentes e ver recebido, devendo e lucro batendo com a lista.
