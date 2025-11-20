-- Remove all dependencies on the profiles table before dropping it

-- 1. Drop trigger that creates profiles automatically
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop the handle_new_user function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Drop RLS policies on profiles table
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

-- 4. The profiles table will be dropped in a separate migration after data migration
-- This is intentionally done in steps to allow for rollback if needed
