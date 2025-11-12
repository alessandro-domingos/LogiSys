-- Tabela de clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj_cpf TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_clientes_user_id ON public.clientes(user_id);
CREATE INDEX idx_clientes_ativo ON public.clientes(ativo);
CREATE INDEX idx_clientes_email ON public.clientes(email);

-- RLS Policies
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e Logística podem gerenciar clientes"
  ON public.clientes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('logistica', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('logistica', 'admin')
    )
  );

CREATE POLICY "Clientes podem ver próprio perfil"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Permissões na tabela role_permissions
INSERT INTO public.role_permissions (role, resource, can_create, can_read, can_update, can_delete)
VALUES 
  ('admin', 'clientes', true, true, true, true),
  ('logistica', 'clientes', true, true, true, true)
ON CONFLICT (role, resource) DO UPDATE SET
  can_create = EXCLUDED.can_create,
  can_read = EXCLUDED.can_read,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;

-- Adicionar coluna cliente_id na tabela liberacoes
ALTER TABLE public.liberacoes 
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id);

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_liberacoes_cliente_id ON public.liberacoes(cliente_id);
