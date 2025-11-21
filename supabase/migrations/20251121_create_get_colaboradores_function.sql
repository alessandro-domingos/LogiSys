-- Create specialized function to fetch only colaboradores (admin and logistica roles)
-- This is an optional optimization to reduce filtering on the frontend
-- To use: update USERS_FUNCTION constant in Colaboradores.tsx to 'get_colaboradores'

CREATE OR REPLACE FUNCTION public.get_colaboradores()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  created_at timestamptz,
  role user_role
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT u.id,
         col.nome,
         u.email,
         u.created_at,
         MAX(ur.role) AS role
  FROM auth.users u
  JOIN public.colaboradores col ON col.user_id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE ur.role IN ('admin', 'logistica')
  GROUP BY u.id, col.nome, u.email, u.created_at
  ORDER BY u.created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_colaboradores() TO authenticated;

-- Alternative implementation that doesn't require colaboradores table:
-- This version gets users directly from auth.users with admin/logistica roles
-- Uncomment if you prefer this approach:
/*
CREATE OR REPLACE FUNCTION public.get_colaboradores()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  created_at timestamptz,
  role user_role
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT 
    u.id,
    COALESCE(
      col.nome,
      COALESCE(u.raw_user_meta_data->>'nome', u.email)
    ) AS nome,
    u.email,
    u.created_at,
    MAX(ur.role) AS role
  FROM auth.users u
  LEFT JOIN public.colaboradores col ON col.user_id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE ur.role IN ('admin', 'logistica')
  GROUP BY u.id, col.nome, u.email, u.created_at
  ORDER BY u.created_at DESC;
$$;
*/
