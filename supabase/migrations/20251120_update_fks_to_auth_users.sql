-- Update all foreign key constraints from profiles(id) to auth.users(id)
-- This migration removes dependencies on the profiles table

-- 1. Update estoque table
ALTER TABLE public.estoque
  DROP CONSTRAINT IF EXISTS estoque_updated_by_fkey,
  ADD CONSTRAINT estoque_updated_by_fkey 
    FOREIGN KEY (updated_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

-- 2. Update liberacoes table
ALTER TABLE public.liberacoes
  DROP CONSTRAINT IF EXISTS liberacoes_created_by_fkey,
  ADD CONSTRAINT liberacoes_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES auth.users(id) 
    ON DELETE RESTRICT;

-- 3. Update agendamentos table
ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_created_by_fkey,
  ADD CONSTRAINT agendamentos_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES auth.users(id) 
    ON DELETE RESTRICT;

-- 4. Update carregamentos table
ALTER TABLE public.carregamentos
  DROP CONSTRAINT IF EXISTS carregamentos_updated_by_fkey,
  ADD CONSTRAINT carregamentos_updated_by_fkey 
    FOREIGN KEY (updated_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

-- 5. Update fotos_carregamento table
ALTER TABLE public.fotos_carregamento
  DROP CONSTRAINT IF EXISTS fotos_carregamento_uploaded_by_fkey,
  ADD CONSTRAINT fotos_carregamento_uploaded_by_fkey 
    FOREIGN KEY (uploaded_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

-- 6. Update user_roles table to reference auth.users directly
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey,
  ADD CONSTRAINT user_roles_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
