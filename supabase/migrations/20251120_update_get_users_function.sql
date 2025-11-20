-- Update get_users_with_roles to query from entity tables instead of profiles
-- This function aggregates users from clientes, armazens, colaboradores, and auth.users

CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  created_at timestamptz,
  roles user_role[]
) AS $$
  WITH all_users AS (
    -- Get users from clientes
    SELECT 
      c.user_id AS id,
      c.nome,
      c.email,
      c.created_at
    FROM public.clientes c
    WHERE c.user_id IS NOT NULL
    
    UNION
    
    -- Get users from armazens
    SELECT 
      a.user_id AS id,
      a.nome,
      a.email,
      a.created_at
    FROM public.armazens a
    WHERE a.user_id IS NOT NULL
    
    UNION
    
    -- Get users from colaboradores
    SELECT 
      col.user_id AS id,
      col.nome,
      col.email,
      col.created_at
    FROM public.colaboradores col
    WHERE col.user_id IS NOT NULL
    
    UNION
    
    -- Get users directly from auth.users who might not be in entity tables yet
    -- This handles admin/logistica users that may not have entity records
    SELECT 
      au.id,
      COALESCE(au.raw_user_meta_data->>'nome', au.email) AS nome,
      au.email,
      au.created_at
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM public.clientes c WHERE c.user_id = au.id
      UNION
      SELECT 1 FROM public.armazens a WHERE a.user_id = au.id
      UNION
      SELECT 1 FROM public.colaboradores col WHERE col.user_id = au.id
    )
  )
  SELECT 
    u.id,
    u.nome,
    u.email,
    u.created_at,
    COALESCE(array_agg(DISTINCT ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::user_role[]) AS roles
  FROM all_users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  GROUP BY u.id, u.nome, u.email, u.created_at
  ORDER BY u.created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.get_users_with_roles() TO authenticated;
