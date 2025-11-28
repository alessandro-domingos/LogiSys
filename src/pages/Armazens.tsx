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
import { Warehouse, Plus, Filter as FilterIcon } from "lucide-react";

const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

interface Armazem {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  email: string;
  telefone?: string;
  endereco?: string;
  capacidade_total?: number;
  capacidade_disponivel?: number;
  ativo: boolean;
  created_at: string;
}

const Armazens = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  const { data: armazensData, isLoading, error } = useQuery({
    queryKey: ["armazens"],
    queryFn: async () => {
      console.log("🔍 [DEBUG] Buscando armazéns...");
      const { data, error } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado, email, telefone, endereco, capacidade_total, capacidade_disponivel, ativo, created_at")
        .order("cidade", { ascending: true });
      
      if (error) {
        console.error("❌ [ERROR] Erro ao buscar armazéns:", error);
        throw error;
      }
      console.log("✅ [DEBUG] Armazéns carregados:", data?.length);
      return data as Armazem[];
    },
    refetchInterval: 30000,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoArmazem, setNovoArmazem] = useState({
    nome: "",
    cidade: "",
    estado: "",
    email: "",
    telefone: "",
    endereco: "",
    capacidade_total: "",
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
    setNovoArmazem({ 
      nome: "", 
      cidade: "", 
      estado: "", 
      email: "", 
      telefone: "", 
      endereco: "", 
      capacidade_total: "" 
    });
  };

  const handleCreateArmazem = async () => {
    const { nome, cidade, estado, email, telefone, endereco, capacidade_total } = novoArmazem;

    // Validações básicas
    if (!nome.trim() || !cidade.trim() || !estado || !email.trim()) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({ variant: "destructive", title: "Email inválido", description: "Por favor, insira um email válido" });
      return;
    }

    // Validação de capacidade_total (se fornecida)
    let capacidadeTotalNumber: number | undefined;
    if (capacidade_total && capacidade_total.trim()) {
      capacidadeTotalNumber = parseFloat(capacidade_total);
      if (isNaN(capacidadeTotalNumber) || capacidadeTotalNumber < 0) {
        toast({ variant: "destructive", title: "Capacidade inválida", description: "A capacidade deve ser um número positivo" });
        return;
      }
    }

    try {
      console.log("🔍 [DEBUG] Criando armazém:", { nome, cidade, estado, email });

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('create-armazem-user', {
        body: {
          nome: nome.trim(),
          email: email.trim(),
          cidade: cidade.trim(),
          estado,
          telefone: telefone?.trim() || undefined,
          endereco: endereco?.trim() || undefined,
          capacidade_total: capacidadeTotalNumber,
        }
      });

      if (error) {
        console.error("❌ [ERROR] Erro ao chamar função:", error);
        throw new Error(error.message || "Ocorreu um erro ao criar o armazém.");
      }

      if (data?.error || !data?.success) {
        console.error("❌ [ERROR] Erro nos dados retornados:", data);
        
        let errorMessage = data?.error || "Ocorreu um erro ao criar o armazém.";
        
        // Tratamento específico de erros
        if (data?.details) {
          const details = data.details.toLowerCase();
          
          // Erro de email duplicado
          if (details.includes('duplicate') && details.includes('email')) {
            errorMessage = "Este email já está cadastrado no sistema.";
          } else if (details.includes('armazens_email_unique')) {
            errorMessage = "Este email já está cadastrado no sistema.";
          } else if (details.includes('unique constraint')) {
            errorMessage = "Este email já está cadastrado no sistema.";
          }
          // Campos obrigatórios faltando
          else if (details.includes('not null') || details.includes('required')) {
            errorMessage = "Campos obrigatórios não preenchidos.";
          }
          // Nome duplicado (se o backend retornar)
          else if (details.includes('nome') && details.includes('duplicate')) {
            errorMessage = "Já existe um armazém com este nome.";
          }
          // Fallback para detalhes genéricos
          else {
            errorMessage = data.details;
          }
        }
        
        throw new Error(errorMessage);
      }

      console.log("✅ [SUCCESS] Armazém criado:", data.armazem);

      // Exibir modal de credenciais com fallback
      const senhaTemporaria = data.senha || "";
      setCredenciaisModal({
        show: true,
        email: email.trim(),
        senha: senhaTemporaria,
        nome: nome.trim()
      });

      resetForm();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["armazens-filtro"] });
      queryClient.invalidateQueries({ queryKey: ["armazens-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["armazens"] });

    } catch (err: unknown) {
      console.error("❌ [ERROR] Erro geral:", err);
      const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro ao criar o armazém.";
      toast({
        variant: "destructive",
        title: "Erro ao criar armazém",
        description: errorMessage
      });
    }
  };

  const handleToggleAtivo = async (id: string, currentStatus: boolean) => {
    try {
      console.log("🔍 [DEBUG] Alterando status do armazém:", id, "para:", !currentStatus);

      const { error } = await supabase
        .from("armazens")
        .update({ ativo: !currentStatus })
        .eq("id", id);

      if (error) {
        console.error("❌ [ERROR] Erro ao atualizar armazém:", error);
        throw error;
      }

      console.log("✅ [SUCCESS] Status do armazém atualizado");
      toast({ title: "Status atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["armazens-filtro"] });
      queryClient.invalidateQueries({ queryKey: ["armazens-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["armazens"] });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar status",
        description: err instanceof Error ? err.message : "Erro desconhecido"
      });
    }
  };

  const filteredArmazens = useMemo(() => {
    if (!armazensData) return [];
    
    return armazensData.filter((armazem) => {
      // Filter by status
      if (filterStatus === "ativo" && !armazem.ativo) return false;
      if (filterStatus === "inativo" && armazem.ativo) return false;
      
      // Filter by search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches = 
          armazem.nome.toLowerCase().includes(term) ||
          armazem.cidade.toLowerCase().includes(term) ||
          armazem.estado.toLowerCase().includes(term);
        if (!matches) return false;
      }
      
      return true;
    });
  }, [armazensData, filterStatus, searchTerm]);

  const canCreate = hasRole("admin") || hasRole("logistica");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Armazéns" description="Carregando..." actions={<></>} />
        <div className="container mx-auto px-6 py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando armazéns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Armazéns" description="Erro ao carregar dados" actions={<></>} />
        <div className="container mx-auto px-6 py-8 text-center">
          <p className="text-destructive">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Armazéns"
        description="Gerencie os armazéns do sistema"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary" disabled={!canCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Armazém
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Armazém</DialogTitle>
                <DialogDescription>
                  Preencha os dados do armazém. Um usuário de acesso será criado automaticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={novoArmazem.nome}
                      onChange={(e) => setNovoArmazem({ ...novoArmazem, nome: e.target.value })}
                      placeholder="Ex: Armazém Central"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={novoArmazem.email}
                      onChange={(e) => setNovoArmazem({ ...novoArmazem, email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={novoArmazem.telefone}
                      onChange={(e) => setNovoArmazem({ ...novoArmazem, telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={novoArmazem.endereco}
                      onChange={(e) => setNovoArmazem({ ...novoArmazem, endereco: e.target.value })}
                      placeholder="Rua, número, complemento"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cidade">Cidade *</Label>
                    <Input
                      id="cidade"
                      value={novoArmazem.cidade}
                      onChange={(e) => setNovoArmazem({ ...novoArmazem, cidade: e.target.value })}
                      placeholder="Ex: São Paulo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="estado">Estado (UF) *</Label>
                    <Select
                      value={novoArmazem.estado}
                      onValueChange={(value) => setNovoArmazem({ ...novoArmazem, estado: value })}
                    >
                      <SelectTrigger id="estado">
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {estadosBrasil.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="capacidade_total">Capacidade Total (toneladas)</Label>
                    <Input
                      id="capacidade_total"
                      type="number"
                      step="0.01"
                      value={novoArmazem.capacidade_total}
                      onChange={(e) => setNovoArmazem({ ...novoArmazem, capacidade_total: e.target.value })}
                      placeholder="Ex: 1000"
                    />
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
                <Button className="bg-gradient-primary" onClick={handleCreateArmazem}>
                  Criar Armazém
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Credentials Modal */}
      <Dialog open={credenciaisModal.show} onOpenChange={(open) => setCredenciaisModal({...credenciaisModal, show: open})}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>✅ Armazém cadastrado com sucesso!</DialogTitle>
            <DialogDescription>
              {credenciaisModal.senha 
                ? "Credenciais de acesso criadas. Envie ao responsável por email ou WhatsApp."
                : "Credenciais criadas. Verifique seu email ou consulte o administrador."}
            </DialogDescription>
          </DialogHeader>
          {credenciaisModal.senha ? (
            <>
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
                    ⚠️ <strong>Importante:</strong> Envie estas credenciais ao responsável. 
                    Por segurança, esta senha só aparece uma vez. O usuário será obrigado a trocar a senha no primeiro login.
                  </p>
                </div>
              </div>
              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const texto = `Credenciais de acesso ao Sistema\n\nEmail: ${credenciaisModal.email}\nSenha: ${credenciaisModal.senha}\n\nImportante: Troque a senha no primeiro acesso.`;
                    navigator.clipboard.writeText(texto);
                    toast({ title: "Credenciais copiadas!" });
                  }}
                >
                  📋 Copiar senha
                </Button>
                <Button onClick={() => setCredenciaisModal({ show: false, email: "", senha: "", nome: "" })}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <DialogFooter>
              <Button onClick={() => setCredenciaisModal({ show: false, email: "", senha: "", nome: "" })}>
                Fechar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="container mx-auto px-6 pt-3">
        <div className="flex items-center gap-3 mb-4">
          <Input
            className="h-9 flex-1"
            placeholder="Buscar por nome ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
            >
              Todos
            </Button>
            <Button
              variant={filterStatus === "ativo" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("ativo")}
            >
              Ativos
            </Button>
            <Button
              variant={filterStatus === "inativo" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("inativo")}
            >
              Inativos
            </Button>
          </div>
        </div>
      </div>

      {/* Grid of warehouse cards */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredArmazens.map((armazem) => (
            <Card key={armazem.id} className="transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                      <Warehouse className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{armazem.nome}</h3>
                      <p className="text-sm text-muted-foreground">
                        {armazem.cidade}/{armazem.estado}
                      </p>
                    </div>
                  </div>
                  <Badge variant={armazem.ativo ? "default" : "secondary"}>
                    {armazem.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                
                <div className="space-y-1 text-sm mt-3">
                  <p><span className="text-muted-foreground">Email:</span> {armazem.email}</p>
                  {armazem.telefone && (
                    <p><span className="text-muted-foreground">Telefone:</span> {armazem.telefone}</p>
                  )}
                  {armazem.endereco && (
                    <p><span className="text-muted-foreground">Endereço:</span> {armazem.endereco}</p>
                  )}
                  {armazem.capacidade_total != null && (
                    <p>
                      <span className="text-muted-foreground">Capacidade:</span> {armazem.capacidade_total}t 
                      {` / Disponível: ${armazem.capacidade_disponivel != null ? `${armazem.capacidade_disponivel}t` : '—'}`}
                    </p>
                  )}
                </div>

                {canCreate && (
                  <div className="flex items-center justify-between pt-3 mt-3 border-t">
                    <Label htmlFor={`switch-${armazem.id}`} className="text-sm">
                      {armazem.ativo ? "Ativo" : "Inativo"}
                    </Label>
                    <Switch
                      id={`switch-${armazem.id}`}
                      checked={armazem.ativo}
                      onCheckedChange={() => handleToggleAtivo(armazem.id, armazem.ativo)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {filteredArmazens.length === 0 && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhum armazém encontrado com os filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
};

export default Armazens;
