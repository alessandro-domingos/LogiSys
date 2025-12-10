import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, Truck, Plus, X, Filter as FilterIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

function validateAgendamento(ag) {
  const errors = [];
  if (!ag.liberacao) errors.push("Liberação");
  if (!ag.quantidade || Number(ag.quantidade) <= 0) errors.push("Quantidade");
  if (!ag.data || isNaN(Date.parse(ag.data))) errors.push("Data");
  if (!ag.horario || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(ag.horario)) errors.push("Horário");
  if (!ag.placa || ag.placa.replace(/[^A-Z0-9]/gi, "").length < 7) errors.push("Placa do veículo");
  if (!ag.motorista || ag.motorista.trim().length < 3) errors.push("Nome do motorista");
  if (!ag.documento || !/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(ag.documento)) errors.push("Documento (CPF) do motorista");
  return errors;
}
function formatPlaca(placa) {
  return placa
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^([A-Z]{3})([0-9]{4})$/, "$1-$2")
    .slice(0, 8);
}
function formatCPF(cpf) {
  let num = cpf.replace(/\D/g, "").padStart(11, "0").slice(0, 11);
  return num.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}
const parseDate = (d) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

type AgendamentoStatus = "confirmado" | "pendente" | "concluido" | "cancelado";

const Agendamentos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole, userRole, user } = useAuth();
  const canCreate = hasRole("admin") || hasRole("logistica") || hasRole("cliente");

  // Buscar cliente atual vinculado ao usuário logado
  const { data: currentCliente } = useQuery({
    queryKey: ["current-cliente", user?.id],
    queryFn: async () => {
      if (!user || userRole !== "cliente") return null;
      const { data, error } = await supabase
        .from("clientes")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && userRole === "cliente",
  });

  // Buscar agendamentos do banco
  const { data: agendamentosData, isLoading, error } = useQuery({
    queryKey: ["agendamentos", currentCliente?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          id,
          data_retirada,
          horario,
          quantidade,
          motorista_nome,
          motorista_documento,
          placa_caminhao,
          tipo_caminhao,
          status,
          observacoes,
          created_at,
          liberacao:liberacoes(
            id,
            pedido_interno,
            quantidade_liberada,
            cliente_id,
            clientes(nome, cnpj_cpf),
            produto:produtos(id, nome),
            armazem:armazens(id, nome, cidade, estado)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      let filteredData = data || [];
      if (userRole === "cliente" && currentCliente?.id) {
        filteredData = filteredData.filter((ag: any) =>
          ag.liberacao?.cliente_id === currentCliente.id
        );
      }
      return filteredData;
    },
    refetchInterval: 30000,
    enabled: userRole !== "cliente" || !!currentCliente?.id,
  });

  // CORRIGIDO: query de agendamentos hoje usando data_retirada
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);
  const agQueryHoje = useQuery({
    queryKey: ["agendamentos-hoje", hoje.toISOString().split('T')[0]],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id")
        .gte("data_retirada", hoje.toISOString())
        .lt("data_retirada", amanha.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const agendamentos = useMemo(() => {
    if (!agendamentosData) return [];
    return agendamentosData.map((item: any) => ({
      id: item.id,
      cliente: item.liberacao?.clientes?.nome || "N/A",
      produto: item.liberacao?.produto?.nome || "N/A",
      quantidade: item.quantidade,
      data: item.data_retirada
        ? new Date(item.data_retirada).toLocaleDateString("pt-BR")
        : "",
      horario: item.horario || "00:00",
      placa: item.placa_caminhao || "N/A",
      motorista: item.motorista_nome || "N/A",
      documento: item.motorista_documento || "N/A",
      pedido: item.liberacao?.pedido_interno || "N/A",
      status: item.status as AgendamentoStatus,
      armazem:
        item.liberacao?.armazem?.cidade ||
        item.liberacao?.armazem?.estado ||
        "",
      produto_id: item.liberacao?.produto?.id,
      armazem_id: item.liberacao?.armazem?.id,
      liberacao_id: item.liberacao?.id,
    }));
  }, [agendamentosData]);

  // Estado do form/modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoAgendamento, setNovoAgendamento] = useState({
    liberacao: "",
    quantidade: "",
    data: "",
    horario: "",
    placa: "",
    motorista: "",
    documento: "",
    tipoCaminhao: "",
    observacoes: "",
  });
  const [formError, setFormError] = useState("");

  // Buscar liberações pendentes para o formulário
  const { data: liberacoesPendentes } = useQuery({
    queryKey: ["liberacoes-pendentes", currentCliente?.id],
    queryFn: async () => {
      let query = supabase
        .from("liberacoes")
        .select(`
          id,
          pedido_interno,
          quantidade_liberada,
          quantidade_retirada,
          cliente_id,
          clientes(nome),
          produto:produtos(nome),
          armazem:armazens(cidade, estado)
        `)
        .in("status", ["pendente", "parcial"])
        .order("created_at", { ascending: false });

      if (userRole === "cliente" && currentCliente?.id) {
        query = query.eq("cliente_id", currentCliente.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: userRole !== "cliente" || !!currentCliente?.id,
  });

  const resetFormNovoAgendamento = () => {
    setNovoAgendamento({
      liberacao: "",
      quantidade: "",
      data: "",
      horario: "",
      placa: "",
      motorista: "",
      documento: "",
      tipoCaminhao: "",
      observacoes: "",
    });
    setFormError("");
  };

  const handleCreateAgendamento = async () => {
    setFormError("");
    const erros = validateAgendamento(novoAgendamento);
    if (erros.length > 0) {
      setFormError("Preencha: " + erros.join(", "));
      toast({
        variant: "destructive",
        title: "Campos obrigatórios ausentes ou inválidos",
        description: "Preencha: " + erros.join(", "),
      });
      return;
    }
    const qtdNum = Number(novoAgendamento.quantidade);
    if (Number.isNaN(qtdNum) || qtdNum <= 0) {
      setFormError("Quantidade inválida.");
      toast({ variant: "destructive", title: "Quantidade inválida" });
      return;
    }
    try {
      const formattedPlaca = formatPlaca(novoAgendamento.placa);
      const formattedCPF = formatCPF(novoAgendamento.documento);
      const { data: userData } = await supabase.auth.getUser();

      const { data: agendData, error: errAgend } = await supabase
        .from("agendamentos")
        .insert({
          liberacao_id: novoAgendamento.liberacao,
          quantidade: qtdNum,
          data_retirada: novoAgendamento.data,
          horario: novoAgendamento.horario,
          placa_caminhao: formattedPlaca,
          motorista_nome: novoAgendamento.motorista.trim(),
          motorista_documento: formattedCPF,
          tipo_caminhao: novoAgendamento.tipoCaminhao || null,
          observacoes: novoAgendamento.observacoes || null,
          status: "confirmado",
          created_by: userData.user?.id,
        })
        .select(`
          id,
          data_retirada,
          liberacao:liberacoes(
            pedido_interno,
            clientes(nome),
            produto:produtos(nome)
          )
        `)
        .single();

      if (errAgend) {
        if (
          errAgend.message?.includes("violates not-null constraint") ||
          errAgend.code === "23502"
        ) {
          setFormError("Erro do banco: campo obrigatório não enviado (verifique todos os campos).");
          toast({
            variant: "destructive",
            title: "Erro ao criar agendamento",
            description: "Erro do banco: campo obrigatório não enviado (verifique todos os campos).",
          });
        } else {
          setFormError(errAgend.message || "Erro desconhecido");
          toast({ variant: "destructive", title: "Erro ao criar agendamento", description: errAgend.message });
        }
        return;
      }

      toast({
        title: "Agendamento criado com sucesso!",
        description: `${(agendData.liberacao as any)?.clientes?.nome ?? ""} - ${new Date(agendData.data_retirada).toLocaleDateString("pt-BR")} - ${qtdNum}t`
      });
      resetFormNovoAgendamento();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["liberacoes-pendentes"] });

    } catch (err: any) {
      setFormError(err.message || "Erro desconhecido.");
      if (err.message?.includes("violates not-null constraint")) {
        toast({
          variant: "destructive",
          title: "Erro ao criar agendamento",
          description: "Erro do banco: campo obrigatório não enviado (verifique todos os campos).",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao criar agendamento",
          description: err instanceof Error ? err.message : "Erro desconhecido"
        });
      }
    }
  };

  // Filtros e busca
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<AgendamentoStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const allStatuses: AgendamentoStatus[] = ["pendente", "confirmado", "concluido", "cancelado"];
  const toggleStatus = (st: AgendamentoStatus) => setSelectedStatuses((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  const clearFilters = () => { setSearch(""); setSelectedStatuses([]); setDateFrom(""); setDateTo(""); };

  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter((a) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${a.cliente} ${a.produto} ${a.pedido} ${a.motorista}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(a.status)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (parseDate(a.data) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (parseDate(a.data) > to) return false;
      }
      return true;
    });
  }, [agendamentos, search, selectedStatuses, dateFrom, dateTo]);

  const showingCount = filteredAgendamentos.length;
  const totalCount = agendamentos.length;
  const activeAdvancedCount = (selectedStatuses.length ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Agendamentos de Retirada" description="Carregando..." actions={<></>} />
        <div className="container mx-auto px-6 py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando agendamentos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Agendamentos de Retirada" description="Erro ao carregar dados" actions={<></>} />
        <div className="container mx-auto px-6 py-8 text-center">
          <p className="text-destructive">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Agendamentos de Retirada"
        description="Gerencie os agendamentos de retirada de produtos"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary" disabled={!canCreate} title={!canCreate ? "Sem permissão" : "Novo Agendamento"}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="liberacao">Liberação *</Label>
                  <Select
                    value={novoAgendamento.liberacao}
                    onValueChange={(v) => {
                      setNovoAgendamento((s) => ({ ...s, liberacao: v }));
                      const lib = liberacoesPendentes?.find((l) => l.id === v);
                      if (lib) {
                        const disponivel = lib.quantidade_liberada - lib.quantidade_retirada;
                        setNovoAgendamento((s) => ({ ...s, quantidade: disponivel.toString() }));
                      }
                    }}
                  >
                    <SelectTrigger id="liberacao">
                      <SelectValue placeholder="Selecione a liberação" />
                    </SelectTrigger>
                    <SelectContent>
                      {liberacoesPendentes?.map((lib: any) => {
                        const disponivel = lib.quantidade_liberada - lib.quantidade_retirada;
                        return (
                          <SelectItem key={lib.id} value={lib.id}>
                            {lib.pedido_interno} - {lib.clientes?.nome} - {lib.produto?.nome} ({disponivel}t disponível) - {lib.armazem?.cidade}/{lib.armazem?.estado}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade (t) *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    step="0.01"
                    min="0"
                    value={novoAgendamento.quantidade}
                    onChange={(e) => setNovoAgendamento((s) => ({ ...s, quantidade: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data">Data *</Label>
                    <Input
                      id="data"
                      type="date"
                      value={novoAgendamento.data}
                      onChange={(e) => setNovoAgendamento((s) => ({ ...s, data: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="horario">Horário *</Label>
                    <Input
                      id="horario"
                      type="time"
                      value={novoAgendamento.horario}
                      onChange={(e) => setNovoAgendamento((s) => ({ ...s, horario: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="placa">Placa do Veículo *</Label>
                  <Input
                    id="placa"
                    value={novoAgendamento.placa}
                    onChange={(e) => setNovoAgendamento((s) => ({ ...s, placa: formatPlaca(e.target.value) }))}
                    placeholder="Ex: ABC-1234"
                    maxLength={8}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="motorista">Nome do Motorista *</Label>
                    <Input
                      id="motorista"
                      value={novoAgendamento.motorista}
                      onChange={(e) => setNovoAgendamento((s) => ({ ...s, motorista: e.target.value }))}
                      placeholder="Ex: João Silva"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="documento">Documento (CPF) *</Label>
                    <Input
                      id="documento"
                      value={novoAgendamento.documento}
                      onChange={(e) => setNovoAgendamento((s) => ({ ...s, documento: formatCPF(e.target.value) }))}
                      placeholder="Ex: 123.456.789-00"
                      maxLength={14}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipoCaminhao">Tipo de Caminhão</Label>
                  <Input
                    id="tipoCaminhao"
                    value={novoAgendamento.tipoCaminhao}
                    onChange={(e) => setNovoAgendamento((s) => ({ ...s, tipoCaminhao: e.target.value }))}
                    placeholder="Ex: Bitrem, Carreta, Truck"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Input
                    id="observacoes"
                    value={novoAgendamento.observacoes}
                    onChange={(e) => setNovoAgendamento((s) => ({ ...s, observacoes: e.target.value }))}
                    placeholder="Informações adicionais sobre o agendamento"
                  />
                </div>
                {formError && (
                  <div className="pt-3 text-destructive text-sm font-semibold border-t">
                    {formError}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-gradient-primary" onClick={handleCreateAgendamento}>Criar Agendamento</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Barra compacta */}
      <div className="container mx-auto px-6 pt-3">
        <div className="flex items-center gap-3">
          <Input className="h-9 flex-1" placeholder="Buscar por cliente, produto, pedido ou motorista..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Mostrando <span className="font-medium">{showingCount}</span> de <span className="font-medium">{totalCount}</span></span>
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen((v) => !v)}>
            <FilterIcon className="h-4 w-4 mr-1" />
            Filtros {activeAdvancedCount ? `(${activeAdvancedCount})` : ""}
            {filtersOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="container mx-auto px-6 pt-2">
          <div className="rounded-md border p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {allStatuses.map((st) => {
                    const active = selectedStatuses.includes(st);
                    const label = st === "pendente" ? "Pendente" : st === "confirmado" ? "Confirmado" : st === "concluido" ? "Concluído" : "Cancelado";
                    return (
                      <Badge key={st} onClick={() => toggleStatus(st)} className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900"}`}>
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Período</Label>
                <div className="flex gap-2">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1"><X className="h-4 w-4" /> Limpar Filtros</Button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 py-6">
        <div className="grid gap-4">
          {filteredAgendamentos.map((ag) => (
            <Card key={ag.id} className="transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                        <Calendar className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{ag.cliente}</h3>
                        <p className="text-sm text-muted-foreground">{ag.produto} - {ag.quantidade}t • {ag.armazem}</p>
                        <p className="text-xs text-muted-foreground">Pedido: <span className="font-medium text-foreground">{ag.pedido}</span></p>
                        <p className="text-xs text-muted-foreground">Data: {ag.data} • {ag.horario}</p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        ag.status === "confirmado" ? "default" :
                        ag.status === "pendente"  ? "secondary" :
                        ag.status === "concluido" ? "default" : "destructive"
                      }
                    >
                      {ag.status === "confirmado" ? "Confirmado" : ag.status === "pendente" ? "Pendente" : ag.status === "concluido" ? "Concluído" : "Cancelado"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2">
                    <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>{ag.data} às {ag.horario}</span></div>
                    <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" /><span>{ag.placa}</span></div>
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span>{ag.motorista}</span></div>
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span>{ag.documento}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredAgendamentos.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento encontrado.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agendamentos;
