-- Update agendamentos table to support direct fields instead of only through liberacoes
-- This allows creating agendamentos independently while maintaining backward compatibility

-- Add new columns to agendamentos table
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS produto_id UUID REFERENCES public.produtos(id),
  ADD COLUMN IF NOT EXISTS armazem_id UUID REFERENCES public.armazens(id),
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
  ADD COLUMN IF NOT EXISTS pedido_interno TEXT,
  ADD COLUMN IF NOT EXISTS data_agendamento DATE,
  ADD COLUMN IF NOT EXISTS hora_agendamento TIME,
  ADD COLUMN IF NOT EXISTS placa_veiculo TEXT,
  ADD COLUMN IF NOT EXISTS motorista_nome TEXT,
  ADD COLUMN IF NOT EXISTS motorista_documento TEXT;

-- Make liberacao_id optional (nullable) for standalone agendamentos
ALTER TABLE public.agendamentos
  ALTER COLUMN liberacao_id DROP NOT NULL;

-- Make old columns nullable since we have new equivalents
ALTER TABLE public.agendamentos
  ALTER COLUMN data_retirada DROP NOT NULL,
  ALTER COLUMN horario DROP NOT NULL,
  ALTER COLUMN placa_caminhao DROP NOT NULL,
  ALTER COLUMN motorista_nome DROP NOT NULL,
  ALTER COLUMN motorista_documento DROP NOT NULL;

-- Add constraint to ensure either liberacao_id OR direct fields are provided
ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_data_source_check CHECK (
    (liberacao_id IS NOT NULL) OR 
    (produto_id IS NOT NULL AND armazem_id IS NOT NULL AND cliente_nome IS NOT NULL AND pedido_interno IS NOT NULL)
  );

-- Update RLS policies to allow logistica and clientes to create agendamentos
DROP POLICY IF EXISTS "Clientes podem criar agendamentos" ON public.agendamentos;

CREATE POLICY "Usuarios autorizados podem criar agendamentos"
  ON public.agendamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'cliente'::user_role) OR 
    public.has_role(auth.uid(), 'logistica'::user_role)
  );

-- Allow logistica to update all agendamentos, users can update their own
CREATE POLICY "Logistica e criadores podem atualizar agendamentos"
  ON public.agendamentos FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'logistica'::user_role) OR
    created_by = auth.uid()
  );
