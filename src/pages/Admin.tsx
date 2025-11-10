import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, UserPlus, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database['public']['Enums']['user_role'];

interface User {
  id: string;
  nome: string;
  email: string;
  created_at: string;
  roles: string[];
}

const Admin = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserNome, setNewUserNome] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("cliente");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const fetchUsers = async () => {
    setLoading(true);
    const { data: usersData, error } = await (supabase.rpc as any)('get_users_with_roles');
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao carregar usuários', description: error.message });
      setLoading(false);
      return;
    }
    const usersMapped: User[] = (usersData || []).map(u => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      created_at: u.created_at,
      roles: u.roles || []
    }));
    setUsers(usersMapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserNome || !newUserPassword || !newUserRole) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha todos os campos"
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          nome: newUserNome,
          role: newUserRole,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao criar usuário",
          description: (error as any)?.message || "Falha no servidor"
        });
        return;
      }

      if (data?.success) {
        toast({
          title: "Usuário criado com sucesso!",
          description: `${newUserNome} foi adicionado ao sistema com a role ${newUserRole}`
        });
        
        setNewUserEmail("");
        setNewUserNome("");
        setNewUserPassword("");
        setNewUserRole("cliente");
        setDialogOpen(false);
        
        // Aguardar um pouco antes de recarregar a lista
        await new Promise(resolve => setTimeout(resolve, 500));
        fetchUsers();
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar usuário",
        description: err.message || "Erro desconhecido"
      });
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    const { error } = await (supabase.rpc as any)('update_user_role', { _user_id: userId, _role: newRole });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar role",
        description: error.message
      });
    } else {
      toast({
        title: "Role atualizada!",
        description: "Permissões do usuário foram atualizadas"
      });
      fetchUsers();
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'logistica': return 'secondary';
      case 'armazem': return 'outline';
      case 'comercial': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      logistica: 'Logística',
      armazem: 'Armazém',
      cliente: 'Cliente',
      comercial: 'Comercial'
    };
    return labels[role] || role;
  };

  if (!hasRole('admin')) {
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
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Administração"
        description="Gerencie usuários e permissões do sistema"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    value={newUserNome}
                    onChange={(e) => setNewUserNome(e.target.value)}
                    placeholder="Nome do usuário"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
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
                      <SelectItem value="armazem">Armazém</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser} className="bg-gradient-primary">
                  Criar Usuário
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
                <p className="mt-2 text-muted-foreground">Carregando usuários...</p>
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
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex gap-2">
                        {/* Exibe apenas a role principal (user.roles[0]) */}
                        {user.roles[0] ? (
                          <Badge variant={getRoleBadgeVariant(user.roles[0])}>
                            {getRoleLabel(user.roles[0])}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{getRoleLabel('cliente')}</Badge>
                        )}
                      </div>
                      
                      <Select
                        value={user.roles[0] || 'cliente'}
                        onValueChange={(value) => handleUpdateUserRole(user.id, value as UserRole)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="logistica">Logística</SelectItem>
                          <SelectItem value="armazem">Armazém</SelectItem>
                          <SelectItem value="comercial">Comercial</SelectItem>
                          <SelectItem value="cliente">Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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

export default Admin;
