import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

export type Resource = 
  | 'users' 
  | 'roles' 
  | 'estoque' 
  | 'produtos' 
  | 'armazens' 
  | 'liberacoes' 
  | 'agendamentos' 
  | 'carregamentos';

export interface Permission {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export const usePermissions = () => {
  const { userRole } = useAuth();
  const [permissions, setPermissions] = useState<Record<Resource, Permission>>({} as any);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!userRole) {
        setPermissions({} as any);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', userRole as UserRole);

      if (!error && data) {
        const permsMap: Record<string, Permission> = {};
        
        data.forEach(perm => {
          permsMap[perm.resource] = {
            can_create: !!perm.can_create,
            can_read: !!perm.can_read,
            can_update: !!perm.can_update,
            can_delete: !!perm.can_delete
          };
        });

        setPermissions(permsMap as any);
      }
      
      setLoading(false);
    };

    fetchPermissions();
  }, [userRole]);

  const canAccess = (resource: Resource, action: 'create' | 'read' | 'update' | 'delete' = 'read'): boolean => {
    const perm = permissions[resource];
    if (!perm) return false;

    switch (action) {
      case 'create':
        return perm.can_create;
      case 'read':
        return perm.can_read;
      case 'update':
        return perm.can_update;
      case 'delete':
        return perm.can_delete;
      default:
        return false;
    }
  };

  return { permissions, canAccess, loading };
};
