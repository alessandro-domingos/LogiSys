-- Migration: Drop obsolete roles table
-- Date: 2025-11-24
-- Description: Removes the legacy public.roles table (name, description columns) that
-- is no longer used after the RBAC refactor. The system now uses the user_role enum,
-- user_roles table, and role_permissions table exclusively for role management.
-- A backup table roles_backup_20251124 is created for safety.

BEGIN;

-- 1. Create backup table if it doesn't already exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'roles_backup_20251124'
  ) THEN
    -- Check if roles table exists before backing it up
    IF EXISTS (
      SELECT FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'roles'
    ) THEN
      CREATE TABLE public.roles_backup_20251124 AS 
      SELECT * FROM public.roles;
      
      RAISE NOTICE 'Created backup table roles_backup_20251124';
    ELSE
      -- If roles table doesn't exist, create empty backup table for documentation
      CREATE TABLE public.roles_backup_20251124 (
        name TEXT,
        description TEXT,
        created_at TIMESTAMPTZ
      );
      
      RAISE NOTICE 'Created empty backup table roles_backup_20251124 (roles table already dropped)';
    END IF;
  ELSE
    RAISE NOTICE 'Backup table roles_backup_20251124 already exists, skipping creation';
  END IF;
END $$;

-- 2. Drop the roles table if it exists (idempotent)
DROP TABLE IF EXISTS public.roles CASCADE;

-- 3. Add documentation comment
COMMENT ON TABLE public.roles_backup_20251124 IS 
  'Backup of legacy roles table dropped on 2025-11-24. This table is no longer used. ' ||
  'RBAC now relies on user_role enum, user_roles table, and role_permissions table.';

COMMIT;
