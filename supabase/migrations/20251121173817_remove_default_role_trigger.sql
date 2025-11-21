-- Migration: Remove automatic default role assignment trigger
-- Date: 2025-11-21
-- Description: 
--   Remove the trigger and function that automatically assigns 'cliente' role
--   to all new users. Role assignment is now explicit in edge functions.
--   
--   Edge functions will now:
--   - create-customer-user: explicitly assign 'cliente' role with rollback on error
--   - create-armazem-user: explicitly assign 'armazem' role with rollback on error
--   - create-colaborador-user: validate and assign only 'admin' or 'logistica' roles
--   - admin-users: restrict to 'admin' and 'logistica' roles only
--
--   This ensures users receive the correct role and prevents orphaned auth.users
--   without proper role assignment.

-- Drop the trigger that calls assign_default_role on user signup
DROP TRIGGER IF EXISTS assign_role_on_signup ON auth.users;

-- Drop the conditional trigger created in migration 20251106125543
DROP TRIGGER IF EXISTS on_auth_user_created_assign_default_role ON auth.users;

-- Drop the function that assigns default role
DROP FUNCTION IF EXISTS public.assign_default_role();

-- Add comment documenting the change
COMMENT ON TABLE public.user_roles IS 
  'User roles are now assigned explicitly by edge functions during user creation. 
   No automatic default role assignment via trigger.';
