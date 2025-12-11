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
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Warehouse, Plus, Filter as FilterIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Helpers de máscara e formatação
function maskPhoneInput(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length === 11)
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (cleaned.length === 10)
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (cleaned.length > 6)
    return cleaned.replace(/^(\d{2})(\d{0,5})(\d{0,4})$/, "($1) $2-$3");
  if (cleaned.length > 2)
    return cleaned.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  if (cleaned.length > 0)
    return cleaned.replace(/^(\d{0,2})/, "($1");
  return "";
}
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (cleaned.length === 10)
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return phone;
}
function maskCEPInput(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 8);
  if (cleaned.length > 5)
    return cleaned.replace(/^(\d{5})(\d{0,3})$/, "$1-$2");
  return cleaned;
}
function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, "").slice(0, 8);
  if (cleaned.length === 8)
    return cleaned.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return cep;
}

const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

type Armazem = {
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
  cep?: string;
};

const Armazens = () => {
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoArmazem, setNovoArmazem] = useState({
    nome: "",
    cidade: "",
    estado: "",
    email: "",
    telefone: "",
    endereco: "",
    capacidade_total: "",
    cep: "",
  });

  const [credenciaisModal, setCredenciaisModal] = useState({
    show: false,
    email: "",
    senha: "",
    nome: "",
  });

  // Modal de detalhes do armazém
  const [detalhesArmazem, setDetalhesArmazem] = useState<Armazem | null>(null);

  // Filtros
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
      capacidade_total: "",
      cep: "",
    });
  };

  const fetchArmazens = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("armazens")
        .select("*")
        .order("cidade", { ascending: true });
      if (error) {
        setError(error.message);
        toast({
          variant: "destructive",
          title: "Erro ao carregar armazéns",
          description: "Não foi possível carregar os armazéns.",
        });
        setLoading(false);
        return;
      }
      setArmazens(data as Armazem[]);
      setLoading(false);
    } catch (err) {
      setError("Erro desconhecido");
      toast({
        variant: "destructive",
        title: "Erro ao carregar armazéns",
        description: "Erro inesperado ao carregar armazéns.",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArmazens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateArmazem = async () => {
    const { nome, cidade, estado, email, telefone, endereco, capacidade_total, cep } = novoArmazem;
    if (!nome.trim() || !cidade.trim() || !estado.trim() || !email.trim()) {
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
      let capacidadeTotalNumber: number | undefined = undefined;
      if (capacidade_total && capacidade_total.trim()) {
        capacidadeTotalNumber = parseFloat(capacidade_total);
        if (isNaN(capacidadeTotalNumber) || capacidadeTotalNumber < 0) {
          toast({
            variant: "destructive",
            title: "Capacidade inválida",
            description: "A capacidade deve ser um número positivo",
          });
          return;
        }
      }

      // Salva telefone e CEP sem formatação
      const cleanTelefone = telefone ? telefone.replace(/\D/g, "") : undefined;
      const cleanCep = cep ? cep.replace(/\D/g, "") : undefined;

      const response = await fetch(`${supabaseUrl}/functions/v1/create-armazem-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          cidade: cidade.trim(),
          estado: estado.trim(),
          telefone: cleanTelefone,
          endereco: endereco?.trim() || undefined,
          capacidade_total: capacidadeTotalNumber,
          cep: cleanCep,
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
        let errorMessage = "Erro ao criar armazém";
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
                      : msg)
              .join(" | ");
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
          title: "Erro ao criar armazém",
          description: errorMessage,
        });
        return;
      }

      if (data && data.success) {
        toast({
          title: "Armazém criado com sucesso!",
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
        fetchArmazens();
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao criar armazém",
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
        .from("armazens")
        .update({ ativo: !ativoAtual, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({
        title: `Armazém ${!ativoAtual ? "ativado" : "desativado"} com sucesso!`,
      });
      fetchArmazens();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar status",
      });
    }
  };

  const filteredArmazens = useMemo(() => {
    if (!armazens) return [];
    return armazens.filter((armazem) => {
      if (filterStatus === "ativo" && !armazem.ativo) return false;
      if (filterStatus === "inativo" && armazem.ativo) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          armazem.nome.toLowerCase().includes(term) ||
          armazem.cidade.toLowerCase().includes(term) ||
          armazem.estado.toLowerCase().includes(term) ||
          armazem.email?.toLowerCase().includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }, [armazens, filterStatus, searchTerm]);

  const canCreate = hasRole("admin") || hasRole("logistica");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando armazéns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar armazéns</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <PageHeader
        title="Armazéns"
        subtitle="Gerencie os armazéns do sistema"
        icon={Warehouse}
        actions={
          canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Armazém
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Armazém</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={novoArmazem.nome}
                        onChange={(e) => setNovoArmazem({ ...novoArmazem, nome: e.target.value })}
                        placeholder="Nome do armazém"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cidade">Cidade *</Label>
                      <Input
                        id="cidade"
                        value={novoArmazem.cidade}
                        onChange={(e) => setNovoArmazem({ ...novoArmazem, cidade: e.target.value })}
                        placeholder="Cidade"
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
                        onChange={(e) =>
                          setNovoArmazem({
                            ...novoArmazem,
                            telefone: maskPhoneInput(e.target.value),
                          })
                        }
                        placeholder="(00) 00000-0000"
                        maxLength={15}
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
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={novoArmazem.cep}
                        onChange={(e) =>
                          setNovoArmazem({
                            ...novoArmazem,
                            cep: maskCEPInput(e.target.value),
                          })
                        }
                        placeholder="00000-000"
                        maxLength={9}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="capacidade_total">Capacidade Total (toneladas)</Label>
                      <Input
                        id="capacidade_total"
                        type="number"
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
            placeholder="Buscar por nome, cidade, estado ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
      </div>

      {/* Modal de credenciais temporárias do Armazém */}
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
            <DialogTitle>✅ Armazém cadastrado com sucesso!</DialogTitle>
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
              📋 Copiar credenciais
            </Button>
            <Button onClick={() => setCredenciaisModal({ show: false, email: "", senha: "", nome: "" })}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de detalhes do armazém */}
      <Dialog open={!!detalhesArmazem} onOpenChange={open => !open && setDetalhesArmazem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detalhesArmazem?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p><b>Email:</b> {detalhesArmazem?.email ?? "—"}</p>
            <p><b>Telefone:</b> {detalhesArmazem?.telefone ? formatPhone(detalhesArmazem.telefone) : "—"}</p>
            <p><b>CEP:</b> {detalhesArmazem?.cep ? formatCEP(detalhesArmazem.cep) : "—"}</p>
            <p><b>Endereço:</b> {detalhesArmazem?.endereco || "—"}</p>
            <p><b>Cidade:</b> {detalhesArmazem?.cidade || "—"}</p>
            <p><b>Estado:</b> {detalhesArmazem?.estado || "—"}</p>
            <p><b>Capacidade Total:</b> {detalhesArmazem?.capacidade_total ?? "—"} t</p>
            <p><b>Disponível:</b> {detalhesArmazem?.capacidade_disponivel ?? "—"} t</p>
            <p><b>Status:</b> {detalhesArmazem?.ativo ? "Ativo" : "Inativo"}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setDetalhesArmazem(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grid de armazéns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {filteredArmazens.map((armazem) => (
          <Card
            key={armazem.id}
            className="cursor-pointer transition-all"
            onClick={() => setDetalhesArmazem(armazem)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{armazem.nome}</h3>
                  <p className="text-sm text-muted-foreground">{armazem.cidade}/{armazem.estado}</p>
                </div>
                <Badge variant={armazem.ativo ? "default" : "secondary"}>
                  {armazem.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Email:</span> {armazem.email ?? "—"}
                </p>
                {armazem.telefone && (
                  <p>
                    <span className="text-muted-foreground">Telefone:</span> {formatPhone(armazem.telefone)}
                  </p>
                )}
                {armazem.cep && (
                  <p>
                    <span className="text-muted-foreground">CEP:</span> {formatCEP(armazem.cep)}
                  </p>
                )}
              </div>
              {canCreate && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <Label htmlFor={`switch-${armazem.id}`} className="text-sm">
                    {armazem.ativo ? "Ativo" : "Inativo"}
                  </Label>
                  <Switch
                    id={`switch-${armazem.id}`}
                    checked={armazem.ativo}
                    onCheckedChange={() => handleToggleAtivo(armazem.id, armazem.ativo)}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {filteredArmazens.length === 0 && (
        <div className="text-center py-12">
          <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {searchTerm || filterStatus !== "all"
              ? "Nenhum armazém encontrado com os filtros aplicados"
              : "Nenhum armazém cadastrado ainda"}
          </p>
        </div>
      )}
    </div>
  );
};

export default Armazens;
