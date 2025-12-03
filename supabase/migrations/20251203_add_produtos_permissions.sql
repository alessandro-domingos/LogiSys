-- Add produtos permissions to role_permissions table
-- This migration adds the missing permissions for the 'produtos' resource

INSERT INTO public.role_permissions (role, resource, can_create, can_read, can_update, can_delete)
VALUES 
  ('admin', 'produtos', true, true, true, true),
  ('logistica', 'produtos', true, true, true, true)
ON CONFLICT (role, resource) DO UPDATE SET
  can_create = EXCLUDED.can_create,
  can_read = EXCLUDED.can_read,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;

-- Add comment explaining the permissions
COMMENT ON TABLE public.role_permissions IS 'Stores role-based permissions for each resource in the system. produtos resource added on 2025-12-03.';
