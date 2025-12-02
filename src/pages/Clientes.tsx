import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Filter as FilterIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

type Cliente = Database['public']['Tables']['clientes']['Row'];

const Clientes = () => {
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulário Novo Cliente
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    nome: "",
    cnpj_cpf: "",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
  });

  const [credenciaisModal, setCredenciaisModal] = useState({
    show: false,
    email: "",
    senha: "",
    nome: "",
  });

  const [detalhesCliente, setDetalhesCliente] = useState<Cliente | null>(null);

  const [filterStatus, setFilterStatus] = useState<"all" | "ativo" | "inativo">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const resetForm = () => {
    setNovoCliente({
      nome: "",
      cnpj_cpf: "",
      email: "",
      telefone: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
    });
  };

  const fetchClientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nome", { ascending: true });
      if (error) {
        setError(error.message);
        toast({
          variant: "destructive",
          title: "Erro ao carregar clientes",
          description: "Não foi possível carregar a lista de clientes.",
        });
        setLoading(false);
        return;
      }
      setClientes(data as Cliente[]);
      setLoading(false);
    } catch (err) {
      setError("Erro desconhecido");
      toast({
        variant: "destructive",
        title: "Erro ao carregar clientes",
        description: "Erro inesperado ao carregar clientes.",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateCliente = async () => {
    const { nome, cnpj_cpf, email, telefone, endereco, cidade, estado, cep } = novoCliente;
    if (!nome.trim() || !cnpj_cpf.trim() || !email.trim()) {
      toast({
        variant: "destructive",
        title: "Preencha os campos obrigatórios",
      });
      return;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        toast({
          variant: "destructive",
          title: "Erro de configuração",
          description: "Variáveis de ambiente do Supabase não configuradas.",
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: "destructive",
          title: "Não autenticado",
          description: "Sessão expirada. Faça login novamente.",
        });
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/create-customer-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          cnpj_cpf: cnpj_cpf.trim(),
          email: email.trim(),
          telefone: telefone?.trim() || null,
          endereco: endereco?.trim() || null,
          cidade: cidade?.trim() || null,
          estado: estado || null,
          cep: cep?.trim() || null,
        }),
      });

      let textBody = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(textBody);
      } catch {
        data = null;
      }

      if (!response.ok) {
        let errorMessage = "Erro ao criar cliente";
        if (data) {
          if (
            typeof data.details === "object" &&
            data.details !== null &&
            "fieldErrors" in data.details
          ) {
            errorMessage = Object.values(data.details.fieldErrors)
              .flat()
              .map(msg =>
                msg === "Invalid email" ? "Email inválido"
                : msg === "Required" ? "Campo obrigatório"
                : msg.includes("at least") ? msg.replace("String must contain at least", "Mínimo de").replace("character(s)", "caracteres")
                : msg
              ).join(" | ");
          } else if (typeof data.details === "string") {
            errorMessage = data.details;
          } else if (data.error) {
            errorMessage = data.error;
          } else {
            errorMessage = JSON.stringify(data.details);
          }
        }
        toast({
          variant: "destructive",
          title: "Erro ao criar cliente",
          description: errorMessage,
        });
        return;
      }

      if (data && data.success) {
        toast({
          title: "Cliente criado com sucesso!",
          description: `${nome} foi adicionado ao sistema.`,
        });

        setCredenciaisModal({
          show: true,
          email: email.trim(),
          senha: data.senha || "",
          nome: nome.trim(),
        });

        resetForm();
        setDialogOpen(false);
        fetchClientes();
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao criar cliente",
          description: data?.error || data?.details || "Resposta inesperada do servidor",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro de conexão/fetch",
        description: err instanceof Error ? err.message : JSON.stringify(err),
      });
    }
  };

  const handleToggleAtivo = async (id: string, ativoAtual: boolean) => {
    try {
      const { error } = await supabase
        .from("clientes")
        .update({ ativo: !ativoAtual, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({
        title: `Cliente ${!ativoAtual ? "ativado" : "desativado"} com sucesso!`,
      });
      fetchClientes();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar status",
      });
    }
  };

  const filteredClientes = useMemo(() => {
    if (!clientes) return [];
    return clientes.filter((cliente) => {
      if (filterStatus === "ativo" && !cliente.ativo) return false;
      if (filterStatus === "inativo" && cliente.ativo) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          cliente.nome?.toLowerCase().includes(term) ||
          cliente.email?.toLowerCase().includes(term) ||
          cliente.cnpj_cpf?.toLowerCase().includes(term) ||
          (cliente.cidade && cliente.cidade.toLowerCase().includes(term));
        if (!matches) return false;
      }
      return true;
    });
  }, [clientes, filterStatus, searchTerm]);

  const canCreate = hasRole("logistica") || hasRole("admin");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar clientes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Gerencie os clientes do sistema"
        icon={Users}
        actions={
          canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do cliente. Um usuário de acesso será criado automaticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={novoCliente.nome}
                        onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cnpj_cpf">CNPJ/CPF *</Label>
                      <Input
                        id="cnpj_cpf"
                        value={novoCliente.cnpj_cpf}
                        onChange={(e) => setNovoCliente({ ...novoCliente, cnpj_cpf: e.target.value })}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={novoCliente.email}
                        onChange={(e) => setNovoCliente({ ...novoCliente, email: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={novoCliente.telefone}
                        onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={novoCliente.cep}
                        onChange={(e) => setNovoCliente({ ...novoCliente, cep: e.target.value })}
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="endereco">Endereço</Label>
                      <Input
                        id="endereco"
                        value={novoCliente.endereco}
                        onChange={(e) => setNovoCliente({ ...novoCliente, endereco: e.target.value })}
                        placeholder="Rua, número, complemento"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        value={novoCliente.cidade}
                        onChange={(e) => setNovoCliente({ ...novoCliente, cidade: e.target.value })}
                        placeholder="Nome da cidade"
                      />
                    </div>
                    <div>
                      <Label htmlFor="estado">Estado (UF)</Label>
                      <Select
                        value={novoCliente.estado}
                        onValueChange={(value) => setNovoCliente({ ...novoCliente, estado: value })}
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
                  </div>
                  <p className="text-xs text-muted-foreground">
                    * Campos obrigatórios. Um usuário será criado automaticamente com uma senha temporária.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button className="bg-gradient-primary" onClick={handleCreateCliente}>
                    Criar Cliente
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {/* Filtros e busca */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="flex gap-2 items-center">
            <FilterIcon className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "ativo" | "inativo")}>
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
            placeholder="Buscar por nome, email, CNPJ/CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
      </div>

      {/* Modal credenciais temporárias do Cliente */}
      <Dialog
        open={credenciaisModal.show}
        onOpenChange={(open) =>
          setCredenciaisModal(
            open
              ? credenciaisModal
              : { show: false, email: "", senha: "", nome: "" }
          )
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>✅ Cliente cadastrado com sucesso!</DialogTitle>
            <DialogDescription>
              Credenciais de acesso criadas. Envie ao cliente por email ou WhatsApp.
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
                ⚠️ <strong>Importante:</strong> Envie estas credenciais ao cliente.
                Por segurança, esta senha só aparece uma vez. O cliente será obrigado a trocar a senha no primeiro login.
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const texto = `Credenciais de acesso ao LogiSys\n\nEmail: ${credenciaisModal.email}\nSenha: ${credenciaisModal.senha}\n\nImportante: Troque a senha no primeiro acesso.`;
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

      {/* Modal de detalhes do cliente */}
      <Dialog open={!!detalhesCliente} onOpenChange={open => !open && setDetalhesCliente(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Informações do Cliente</DialogTitle>
            <DialogDescription>
              Informações complementares de <b>{detalhesCliente?.nome}</b>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p><b>Email:</b> {detalhesCliente?.email}</p>
            <p><b>Telefone:</b> {detalhesCliente?.telefone || "—"}</p>
            <p><b>CEP:</b> {detalhesCliente?.cep || "—"}</p>
            <p><b>Endereço:</b> {detalhesCliente?.endereco || "—"}</p>
            <p><b>Cidade:</b> {detalhesCliente?.cidade || "—"}</p>
            <p><b>Estado:</b> {detalhesCliente?.estado || "—"}</p>
            <p><b>CNPJ/CPF:</b> {detalhesCliente?.cnpj_cpf || "—"}</p>
            <p><b>Status:</b> {detalhesCliente?.ativo ? "Ativo" : "Inativo"}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setDetalhesCliente(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lista de clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClientes.map((cliente) => (
          <Card
            key={cliente.id}
            className="cursor-pointer transition-all"
            onClick={() => setDetalhesCliente(cliente)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{cliente.nome}</h3>
                  <p className="text-sm text-muted-foreground">{cliente.email}</p>
                </div>
                <Badge variant={cliente.ativo ? "default" : "secondary"}>
                  {cliente.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">CNPJ/CPF:</span> {cliente.cnpj_cpf}
                </p>
              </div>
              {canCreate && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <Label htmlFor={`switch-${cliente.id}`} className="text-sm">
                    {cliente.ativo ? "Ativo" : "Inativo"}
                  </Label>
                  <Switch
                    id={`switch-${cliente.id}`}
                    checked={cliente.ativo}
                    onCheckedChange={() => handleToggleAtivo(cliente.id, cliente.ativo)}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {filteredClientes.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {searchTerm || filterStatus !== "all"
              ? "Nenhum cliente encontrado com os filtros aplicados"
              : "Nenhum cliente cadastrado ainda"}
          </p>
        </div>
      )}
    </div>
  );
};

export default Clientes;
