import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Filter as FilterIcon } from "lucide-react";

interface Colaborador {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
  departamento: string | null;
  ativo: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

const Colaboradores = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  const { data: colaboradoresData, isLoading, error } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      console.log("🔍 [DEBUG] Buscando colaboradores...");
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .order("nome", { ascending: true });
      
      if (error) {
        console.error("❌ [ERROR] Erro ao buscar colaboradores:", error);
        throw error;
      }
      console.log("✅ [DEBUG] Colaboradores carregados:", data?.length);
      return data as Colaborador[];
    },
    refetchInterval: 30000,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoColaborador, setNovoColaborador] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    cargo: "",
    departamento: "",
    role: "comercial" as "logistica" | "comercial" | "admin",
  });

  const [credenciaisModal, setCredenciaisModal] = useState({
    show: false,
    email: "",
    senha: "",
    nome: "",
  });

  const [filterStatus, setFilterStatus] = useState<"all" | "ativo" | "inativo">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const resetForm = () => {
    setNovoColaborador({
      nome: "",
      cpf: "",
      email: "",
      telefone: "",
      cargo: "",
      departamento: "",
      role: "comercial",
    });
  };

  const handleCreateColaborador = async () => {
    const { nome, cpf, email, telefone, cargo, departamento, role } = novoColaborador;

    if (!nome.trim() || !cpf.trim() || !email.trim()) {
      toast({ variant: "destructive", title: "Preencha os campos obrigatórios" });
      return;
    }

    try {
      console.log("🔍 [DEBUG] Criando colaborador:", { nome, cpf, email, role });

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('create-colaborador-user', {
        body: {
          nome: nome.trim(),
          cpf: cpf.trim(),
          email: email.trim(),
          telefone: telefone?.trim() || null,
          cargo: cargo?.trim() || null,
          departamento: departamento?.trim() || null,
          role,
        }
      });

      if (error) {
        console.error("❌ [ERROR] Erro ao chamar função:", error);
        throw new Error(`Erro ao criar colaborador: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || "Erro desconhecido");
      }

      console.log("✅ [SUCCESS] Colaborador criado:", data.colaborador);

      // Show credentials modal
      setCredenciaisModal({
        show: true,
        email: email.trim(),
        senha: data.senha,
        nome: nome.trim()
      });

      resetForm();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });

    } catch (err: unknown) {
      console.error("❌ [ERROR] Erro geral:", err);
      toast({
        variant: "destructive",
        title: "Erro ao criar colaborador",
        description: err instanceof Error ? err.message : "Erro desconhecido"
      });
    }
  };

  const handleToggleAtivo = async (id: string, ativoAtual: boolean) => {
    try {
      console.log("🔍 [DEBUG] Alterando status colaborador:", { id, novoStatus: !ativoAtual });
      
      const { error } = await supabase
        .from("colaboradores")
        .update({ ativo: !ativoAtual, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      toast({ title: `Colaborador ${!ativoAtual ? "ativado" : "desativado"} com sucesso!` });
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao alterar status" });
    }
  };

  const filteredColaboradores = useMemo(() => {
    if (!colaboradoresData) return [];
    
    return colaboradoresData.filter((colaborador) => {
      // Filter by status
      if (filterStatus === "ativo" && !colaborador.ativo) return false;
      if (filterStatus === "inativo" && colaborador.ativo) return false;
      
      // Filter by search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches = 
          colaborador.nome.toLowerCase().includes(term) ||
          colaborador.email.toLowerCase().includes(term) ||
          colaborador.cpf.toLowerCase().includes(term) ||
          (colaborador.cargo && colaborador.cargo.toLowerCase().includes(term)) ||
          (colaborador.departamento && colaborador.departamento.toLowerCase().includes(term));
        if (!matches) return false;
      }
      
      return true;
    });
  }, [colaboradoresData, filterStatus, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando colaboradores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar colaboradores</p>
        </div>
      </div>
    );
  }

  const canCreate = hasRole("logistica") || hasRole("admin");

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHeader
        title="Colaboradores"
        subtitle="Gerencie os colaboradores do sistema"
        icon={Users}
      />

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="flex gap-2 items-center">
            <FilterIcon className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Buscar por nome, email, CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Colaborador</DialogTitle>
                <DialogDescription>
                  Preencha os dados do colaborador. Um usuário de acesso será criado automaticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={novoColaborador.nome}
                      onChange={(e) => setNovoColaborador({ ...novoColaborador, nome: e.target.value })}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      value={novoColaborador.cpf}
                      onChange={(e) => setNovoColaborador({ ...novoColaborador, cpf: e.target.value })}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={novoColaborador.email}
                      onChange={(e) => setNovoColaborador({ ...novoColaborador, email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={novoColaborador.telefone}
                      onChange={(e) => setNovoColaborador({ ...novoColaborador, telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cargo">Cargo</Label>
                    <Input
                      id="cargo"
                      value={novoColaborador.cargo}
                      onChange={(e) => setNovoColaborador({ ...novoColaborador, cargo: e.target.value })}
                      placeholder="Ex: Analista"
                    />
                  </div>
                  <div>
                    <Label htmlFor="departamento">Departamento</Label>
                    <Input
                      id="departamento"
                      value={novoColaborador.departamento}
                      onChange={(e) => setNovoColaborador({ ...novoColaborador, departamento: e.target.value })}
                      placeholder="Ex: Comercial"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Perfil de Acesso *</Label>
                    <Select
                      value={novoColaborador.role}
                      onValueChange={(value: "logistica" | "comercial" | "admin") => setNovoColaborador({ ...novoColaborador, role: value })}
                    >
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="logistica">Logística</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  * Campos obrigatórios. Um usuário será criado automaticamente com uma senha temporária.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateColaborador}>
                  Criar Colaborador
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Credentials Modal */}
      <Dialog open={credenciaisModal.show} onOpenChange={(open) => setCredenciaisModal({...credenciaisModal, show: open})}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>✅ Colaborador cadastrado com sucesso!</DialogTitle>
            <DialogDescription>
              Credenciais de acesso criadas. Envie ao colaborador por email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border p-4 space-y-3 bg-muted/50">
              <p className="text-sm font-medium">Credenciais de acesso para:</p>
              <p className="text-base font-semibold">{credenciaisModal.nome}</p>
              
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Email:</Label>
                  <p className="font-mono text-sm">{credenciaisModal.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Senha temporária:</Label>
                  <p className="font-mono text-sm font-bold">{credenciaisModal.senha}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                ⚠️ <strong>Importante:</strong> Envie estas credenciais ao colaborador. 
                Por segurança, esta senha só aparece uma vez. O colaborador será obrigado a trocar a senha no primeiro login.
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const texto = `Credenciais de acesso ao LogisticPro\n\nEmail: ${credenciaisModal.email}\nSenha: ${credenciaisModal.senha}\n\nImportante: Troque a senha no primeiro acesso.`;
                navigator.clipboard.writeText(texto);
                toast({ title: "Credenciais copiadas!" });
              }}
            >
              📋 Copiar credenciais
            </Button>
            <Button onClick={() => setCredenciaisModal({ show: false, email: "", senha: "", nome: "" })}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Colaboradores List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredColaboradores.map((colaborador) => (
          <Card key={colaborador.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{colaborador.nome}</h3>
                  <p className="text-sm text-muted-foreground">{colaborador.email}</p>
                </div>
                <Badge variant={colaborador.ativo ? "default" : "secondary"}>
                  {colaborador.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">CPF:</span> {colaborador.cpf}</p>
                {colaborador.telefone && (
                  <p><span className="text-muted-foreground">Telefone:</span> {colaborador.telefone}</p>
                )}
                {colaborador.cargo && (
                  <p><span className="text-muted-foreground">Cargo:</span> {colaborador.cargo}</p>
                )}
                {colaborador.departamento && (
                  <p><span className="text-muted-foreground">Departamento:</span> {colaborador.departamento}</p>
                )}
              </div>

              {canCreate && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <Label htmlFor={`switch-${colaborador.id}`} className="text-sm">
                    {colaborador.ativo ? "Ativo" : "Inativo"}
                  </Label>
                  <Switch
                    id={`switch-${colaborador.id}`}
                    checked={colaborador.ativo}
                    onCheckedChange={() => handleToggleAtivo(colaborador.id, colaborador.ativo)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredColaboradores.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {searchTerm || filterStatus !== "all"
              ? "Nenhum colaborador encontrado com os filtros aplicados"
              : "Nenhum colaborador cadastrado ainda"}
          </p>
        </div>
      )}
    </div>
  );
};

export default Colaboradores;
