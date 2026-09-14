ALTER TABLE public.client_payments
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.client_payments.amount IS 'Valor cobrado no momento em que o pagamento foi marcado';
COMMENT ON COLUMN public.client_payments.paid_at IS 'Data e hora em que o pagamento foi marcado';

ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_payments TO authenticated;
GRANT ALL ON public.client_payments TO service_role;