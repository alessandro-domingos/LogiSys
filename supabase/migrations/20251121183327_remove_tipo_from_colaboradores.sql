-- Migration: Remove legacy 'tipo' column from colaboradores table
-- Migração: Remove a coluna legada 'tipo' da tabela colaboradores
-- Esta migração garante que a coluna 'tipo' não exista na tabela colaboradores.
-- O sistema agora usa a tabela user_roles exclusivamente para gerenciamento de roles.
-- Esta é uma migração idempotente - ela só irá dropar a coluna se ela existir.

DO $$
BEGIN
  -- Check if the 'tipo' column exists in the colaboradores table
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'colaboradores' 
      AND column_name = 'tipo'
  ) THEN
    -- Drop the 'tipo' column
    RAISE NOTICE 'Dropping tipo column from colaboradores table...';
    ALTER TABLE public.colaboradores DROP COLUMN tipo;
    RAISE NOTICE 'Successfully removed tipo column from colaboradores table.';
  ELSE
    RAISE NOTICE 'Column tipo does not exist in colaboradores table. No action needed.';
  END IF;
END $$;

-- Adicionar comentário na tabela documentando a abordagem de gerenciamento de roles
COMMENT ON TABLE public.colaboradores IS 
  'Tabela de colaboradores (funcionários/staff). Roles são gerenciadas exclusivamente pela tabela user_roles. Cada usuário deve ter exatamente uma role em user_roles.';
