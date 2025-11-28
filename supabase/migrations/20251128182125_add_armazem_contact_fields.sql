-- Add contact and capacity fields to armazens table
ALTER TABLE public.armazens
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS capacidade_total DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS capacidade_disponivel DECIMAL(10, 2);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_armazens_email ON public.armazens(email);

-- Add comment for documentation
COMMENT ON COLUMN public.armazens.email IS 'Email de contato do armazém (obrigatório, único)';
COMMENT ON COLUMN public.armazens.telefone IS 'Telefone de contato do armazém (opcional)';
COMMENT ON COLUMN public.armazens.endereco IS 'Endereço completo do armazém (opcional)';
COMMENT ON COLUMN public.armazens.capacidade_total IS 'Capacidade total do armazém em toneladas (opcional)';
COMMENT ON COLUMN public.armazens.capacidade_disponivel IS 'Capacidade disponível do armazém em toneladas (calculada automaticamente)';
