-- Create colaboradores table for employees/staff users
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  cargo TEXT,
  departamento TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_colaboradores_user_id ON public.colaboradores(user_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_ativo ON public.colaboradores(ativo);
CREATE INDEX IF NOT EXISTS idx_colaboradores_email ON public.colaboradores(email);

-- RLS Policies
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

-- Admin and Logistica can manage all colaboradores
CREATE POLICY "Admin e Logística podem gerenciar colaboradores"
  ON public.colaboradores FOR ALL
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

-- Colaboradores can view their own profile
CREATE POLICY "Colaboradores podem ver próprio perfil"
  ON public.colaboradores FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add permissions to role_permissions table
INSERT INTO public.role_permissions (role, resource, can_create, can_read, can_update, can_delete)
VALUES 
  ('admin', 'colaboradores', true, true, true, true),
  ('logistica', 'colaboradores', true, true, true, false)
ON CONFLICT (role, resource) DO UPDATE SET
  can_create = EXCLUDED.can_create,
  can_read = EXCLUDED.can_read,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;
