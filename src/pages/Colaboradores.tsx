import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, UserPlus, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { passwordSchema } from "@/lib/validationSchemas";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database['public']['Enums']['user_role'];

interface User {
  id: string;
  nome: string;
  email: string;
  created_at: string;
  role: string | null;
}

// Tipo para o retorno da função RPC get_users_with_roles
interface RpcUserData {
  id: string;
  nome: string;
  email: string;
  created_at: string;
  roles?: UserRole[];
  role?: UserRole;
}

// Constante para facilitar troca futura de função RPC
const USERS_FUNCTION = 'get_users_with_roles';

// Helper para mapear e filtrar colaboradores (admin e logistica)
const mapAndFilterColaboradores = (usersData: RpcUserData[]): User[] => {
  const usersMapped: User[] = (usersData || []).map(u => {
    // Se roles é um array, selecionar role com prioridade: admin > logistica > outros
    let selectedRole: string | null = null;
    if (Array.isArray(u.roles)) {
      if (u.roles.includes('admin')) selectedRole = 'admin';
      else if (u.roles.includes('logistica')) selectedRole = 'logistica';
      else selectedRole = u.roles[0] ??  null;
    } else {
      selectedRole = u.role ??  null;
    }
    
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      created_at: u.created_at,
      role: selectedRole
    };
  });
  
  // Filtrar apenas colaboradores (admin ou logistica)
  return usersMapped.filter(u => u.role === 'admin' || u.role === 'logistica');
};

const Colaboradores = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserNome, setNewUserNome] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("logistica");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: usersData, error: rpcError } = await supabase. rpc(USERS_FUNCTION) as { data: RpcUserData[] | null; error: Error | null };
      if (rpcError) {
        setError(rpcError.message);
        toast({ 
          variant: 'destructive', 
          title: 'Erro ao carregar colaboradores', 
          description: 'Verifique se a função get_users_with_roles foi atualizada (migration 20251120_update_get_users_function.sql)'
        });
        setLoading(false);
        return;
      }
      const colaboradoresFiltrados = mapAndFilterColaboradores(usersData || []);
      setUsers(colaboradoresFiltrados);
      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao carregar colaboradores', 
        description: 'Não foi possível carregar colaboradores. Confirme se a função get_users_with_roles está atualizada.'
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateUser = async () => {
    if (!newUserEmail || ! newUserNome || !newUserPassword || !newUserRole) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha todos os campos"
      });
      return;
    }

    // Validar senha usando o schema
    const passwordValidation = passwordSchema.safeParse(newUserPassword);
    if (! passwordValidation.success) {
      const errorMessage = passwordValidation.error.issues[0]?.message || "Senha inválida";
    
      console.log('🔍 [DEBUG] Validação de senha falhou:', passwordValidation.error);
    
      toast({
        variant: "destructive",
        title: "Senha inválida",
        description: errorMessage
      });
      return;
    }

    try {
      console.log('🔍 [DEBUG] Tentando criar colaborador:', { email: newUserEmail, nome: newUserNome, role: newUserRole });
      
      // Get Supabase URL and anon key
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Validate environment variables
      if (!supabaseUrl || !supabaseAnonKey) {
        toast({
          variant: "destructive",
          title: "Erro de configuração",
          description: "Variáveis de ambiente do Supabase não configuradas."
        });
        return;
      }
      
      // Get current session for Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          variant: "destructive",
          title: "Erro de autenticação",
          description: "Sessão expirada. Faça login novamente."
        });
        return;
      }
      
      // Make manual fetch request to have full control over response
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          nome: newUserNome,
          role: newUserRole,
        })
      });
      
      // Parse response body
      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('❌ [ERROR] Failed to parse response JSON:', parseError);
        toast({
          variant: "destructive",
          title: "Erro ao criar colaborador",
          description: "Resposta inválida do servidor. Verifique os logs para mais detalhes."
        });
        return;
      }
      
      console.log('🔍 [DEBUG] Resposta da Edge Function:', { status: response.status, data });
      
      // Handle non-2xx responses
      if (!response.ok) {
        console.error('❌ [ERROR] Edge Function returned non-2xx status:', response.status);
        
        let errorMessage = "Erro ao criar colaborador";
        
        if (data) {
          // Extract error message from backend response
          if (data.details) {
            errorMessage = data.details;
          } else if (data.error) {
            errorMessage = data.error;
          }
          
          // Specific messages by stage
          if (data.stage === 'validation' && data.error?.includes('Weak password')) {
            errorMessage = "Senha muito fraca. Use pelo menos 6 caracteres e evite senhas comuns.";
          } else if (data.stage === 'createUser' && data.error?.includes('already exists')) {
            errorMessage = "Este email já está cadastrado no sistema.";
          } else if (data.stage === 'createColaborador') {
            // Nome duplicado ou email duplicado
            errorMessage = data.details || "Falha ao criar registro de colaborador.";
          } else if (data.stage === 'adminCheck' && data.error?.includes('Forbidden')) {
            errorMessage = "Você não tem permissão para criar usuários.";
          }
        }
        
        toast({
          variant: "destructive",
          title: "Erro ao criar colaborador",
          description: errorMessage
        });
        return;
      }
      
      // Success case - verify we have valid data
      if (!data) {
        toast({
          variant: "destructive",
          title: "Erro ao criar colaborador",
          description: "Resposta vazia do servidor."
        });
        return;
      }
      
      if (data.success) {
        console.log('✅ [SUCCESS] Colaborador criado com sucesso:', data);
        toast({
          title: "Colaborador criado com sucesso!",
          description: `${newUserNome} foi adicionado ao sistema com a role ${newUserRole}`
        });
        
        setNewUserEmail("");
        setNewUserNome("");
        setNewUserPassword("");
        setNewUserRole("logistica");
        setDialogOpen(false);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        fetchUsers();
      } else {
        // Unexpected response structure
        toast({
          variant: "destructive",
          title: "Erro ao criar colaborador",
          description: data.error || data.details || "Resposta inesperada do servidor"
        });
      }
    } catch (err) {
      console.error('❌ [ERROR] Exceção ao criar colaborador:', err);
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      toast({
        variant: "destructive",
        title: "Erro ao criar colaborador",
        description: errorMessage
      });
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    const { error } = await supabase.rpc('update_user_role', { _user_id: userId, _role: newRole }) as { error: Error | null };

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar role",
        description: error.message
      });
    } else {
      toast({
        title: "Role atualizada! ",
        description: "Permissões do usuário foram atualizadas"
      });
      fetchUsers();
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      logistica: 'Logística',
      armazem: 'Armazém',
      cliente: 'Cliente'
    };
    return labels[role] || role;
  };

  if (! hasRole('admin')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold mb-2">Acesso Negado</h2>
              <p className="text-muted-foreground">
                Você não tem permissão para acessar esta página.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Colaboradores"
        description="Gerencie colaboradores do sistema (Admin e Logística).  Roles exibidas são provenientes de user_roles."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Colaborador</DialogTitle>
                <DialogDescription>
                  Crie um novo colaborador (Admin ou Logística).  Clientes e armazéns são criados em suas respectivas páginas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    value={newUserNome}
                    onChange={(e) => setNewUserNome(e.target. value)}
                    placeholder="Nome do usuário"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e. target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Senha segura"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo 6 caracteres.  Evite senhas comuns como '123456' ou 'senha123'.
                  </p>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="logistica">Logística</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Para criar usuários de armazém ou clientes, use as páginas específicas.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser} className="bg-gradient-primary">
                  Criar Colaborador
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Carregando colaboradores...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md mx-auto">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-destructive" />
                  <h3 className="text-lg font-semibold mb-2 text-destructive">Erro ao Carregar Colaboradores</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Não foi possível carregar a lista de colaboradores. Verifique se a função get_users_with_roles foi atualizada para não usar a tabela profiles.
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Execute a migration: <code className="bg-muted px-2 py-1 rounded">20251120_update_get_users_function.sql</code>
                  </p>
                  <Button onClick={fetchUsers} variant="outline">
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum colaborador encontrado.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Apenas usuários com role "admin" ou "logistica" são exibidos aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{user.nome}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Criado em {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </p>
                      {! user.role && (
                        <p className="text-xs text-destructive mt-1">
                          ⚠️ Sem role - contate administrador
                        </p>
                      )}
                    </div>

                    <Select
                      value={user.role || ''}
                      onValueChange={(value) => handleUpdateUserRole(user.id, value as UserRole)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {! user.role && <SelectItem value="">Selecione uma role</SelectItem>}
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="logistica">Logística</SelectItem>
                        <SelectItem value="armazem">Armazém</SelectItem>
                        <SelectItem value="cliente">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Colaboradores;
