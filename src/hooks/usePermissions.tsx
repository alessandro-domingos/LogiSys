import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

export type Resource =
  | 'estoque'
  | 'liberacoes'
  | 'agendamentos'
  | 'carregamentos'
  | 'produtos'
  | 'clientes'
  | 'armazens'
  | 'colaboradores'
  | 'produtos';

export interface Permission {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export const usePermissions = () => {
  const { userRole, user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Record<Resource, Permission>>({} as any);
  const [loading, setLoading] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [armazemId, setArmazemId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (authLoading) {
        console.log('🔍 [DEBUG] usePermissions - Waiting for auth to load...');
        return;
      }

      if (!userRole || !user) {
        console.log('🔍 [DEBUG] usePermissions - No user or role after auth loaded, clearing permissions');
        setPermissions({} as any);
        setLoading(false);
        return;
      }

      console.log('🔍 [DEBUG] usePermissions - Fetching permissions for role:', userRole, 'user:', user.id);

      try {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('*')
          .eq('role', userRole as UserRole);

        if (error) {
          console.error('❌ [ERROR] usePermissions - Query error:', error);
          setPermissions({} as any);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          console.warn('⚠️ [WARN] usePermissions - No permissions found for role:', userRole);
          setPermissions({} as any);
          setLoading(false);
          return;
        }

        const permsMap: Record<string, Permission> = {};
        data.forEach(perm => {
          permsMap[perm.resource] = {
            can_create: !!perm.can_create,
            can_read: !!perm.can_read,
            can_update: !!perm.can_update,
            can_delete: !!perm.can_delete
          };
        });

        console.log('✅ [SUCCESS] usePermissions - Loaded permissions:', permsMap);
        setPermissions(permsMap as any);
      } catch (err) {
        console.error('❌ [ERROR] usePermissions - Exception:', err);
        setPermissions({} as any);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [userRole, user?.id, authLoading]);

  // Novo: busca clienteId/armazemId apenas se for cliente ou armazem!
  useEffect(() => {
    const fetchVinculos = async () => {
      if (authLoading || !userRole || !user) {
        setClienteId(null);
        setArmazemId(null);
        return;
      }

      if (userRole === 'cliente') {
        const { data, error } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", user.id)
          .single();
        setClienteId(data?.id ?? null);
      } else {
        setClienteId(null);
      }

      if (userRole === 'armazem') {
        const { data, error } = await supabase
          .from("armazens")
          .select("id")
          .eq("user_id", user.id)
          .single();
        setArmazemId(data?.id ?? null);
      } else {
        setArmazemId(null);
      }
    };

    fetchVinculos();
  }, [userRole, user?.id, authLoading]);

  /**
   * Permite visualizar ou manipular o recurso clientes apenas para admin ou logistica, sempre.
   */
  const canAccess = (resource: Resource, action: 'create' | 'read' | 'update' | 'delete' = 'read'): boolean => {
    // Permissão extra: admin ou logistica sempre podem ver "clientes"
    if (resource === "clientes" && (userRole === "admin" || userRole === "logistica")) {
      return true;
    }
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

  return { permissions, canAccess, loading, clienteId, armazemId };
};
