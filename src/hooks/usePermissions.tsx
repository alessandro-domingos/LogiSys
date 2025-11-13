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
  | 'carregamentos'
  | 'clientes';

export interface Permission {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export const usePermissions = () => {
  const { userRole, user } = useAuth();
  const [permissions, setPermissions] = useState<Record<Resource, Permission>>({} as any);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!userRole || !user) {
        console.log('🔍 [DEBUG] usePermissions - No user or role, clearing permissions');
        setPermissions({} as any);
        setLoading(false);
        return;
      }

      console.log('🔍 [DEBUG] usePermissions - Fetching permissions for role:', userRole);

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
        console.log('✅ [DEBUG] usePermissions - Loaded permissions:', permsMap);
      } else if (error) {
        console.error('❌ [DEBUG] usePermissions - Error fetching permissions:', error);
      }
      
      setLoading(false);
    };

    fetchPermissions();
  }, [userRole, user]);

  const canAccess = (resource: Resource, action: 'create' | 'read' | 'update' | 'delete' = 'read'): boolean => {
    const perm = permissions[resource];
    if (!perm) {
      console.log(`🔍 [DEBUG] canAccess - No permission found for resource: ${resource}`);
      return false;
    }

    let hasAccess = false;
    switch (action) {
      case 'create':
        hasAccess = perm.can_create;
        break;
      case 'read':
        hasAccess = perm.can_read;
        break;
      case 'update':
        hasAccess = perm.can_update;
        break;
      case 'delete':
        hasAccess = perm.can_delete;
        break;
      default:
        hasAccess = false;
    }
    
    console.log(`🔍 [DEBUG] canAccess - Resource: ${resource}, Action: ${action}, Access: ${hasAccess}`);
    return hasAccess;
  };

  return { permissions, canAccess, loading };
};
