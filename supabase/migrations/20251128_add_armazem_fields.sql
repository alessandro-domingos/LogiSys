-- Add new fields to armazens table
ALTER TABLE public.armazens
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS capacidade_total NUMERIC,
  ADD COLUMN IF NOT EXISTS capacidade_disponivel NUMERIC;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_armazens_email ON public.armazens(email);

-- Add comment for documentation
COMMENT ON COLUMN public.armazens.email IS 'Email do armazém (obrigatório para criação de usuário)';
COMMENT ON COLUMN public.armazens.telefone IS 'Telefone de contato do armazém';
COMMENT ON COLUMN public.armazens.endereco IS 'Endereço completo do armazém';
COMMENT ON COLUMN public.armazens.capacidade_total IS 'Capacidade total de armazenamento';
COMMENT ON COLUMN public.armazens.capacidade_disponivel IS 'Capacidade disponível para armazenamento';
