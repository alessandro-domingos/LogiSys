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

type AgendamentoStatus = "confirmado" | "pendente" | "concluido" | "cancelado";

interface AgendamentoItem {
  id: string; // UUID
  cliente: string;
  produto: string;
  armazem: string;
  quantidade: number;
  data: string; // dd/mm/yyyy
  horario: string;
  placa: string;
  motorista: string;
  documento: string;
  pedido: string;
  status: AgendamentoStatus;
  produto_id?: string;
  armazem_id?: string;
  liberacao_id?: string;
}

interface SupabaseAgendamentoItem {
  id: string;
  data_retirada: string;
  horario: string;
  quantidade: number;
  motorista_nome: string;
  motorista_documento: string;
  placa_caminhao: string;
  tipo_caminhao?: string;
  status: string;
  observacoes?: string;
  created_at: string;
  liberacao?: {
    id: string;
    cliente_nome: string;
    pedido_interno: string;
    quantidade_liberada: number;
    produto: {
      id: string;
      nome: string;
    } | null;
    armazem: {
      id: string;
      nome: string;
      cidade: string;
      estado: string;
    } | null;
  } | null;
}

const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Agendamentos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canCreate = hasRole("admin") || hasRole("logistica") || hasRole("cliente");

  // Fetch agendamentos from Supabase
  const { data: agendamentosData, isLoading, error } = useQuery({
    queryKey: ["agendamentos"],
    queryFn: async () => {
      console.log("🔍 [DEBUG] Buscando agendamentos...");
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
            cliente_nome,
            pedido_interno,
            quantidade_liberada,
            produto:produtos(id, nome),
            armazem:armazens(id, nome, cidade, estado)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("❌ [ERROR] Erro ao buscar agendamentos:", error);
        throw error;
      }
      console.log("✅ [DEBUG] Agendamentos carregados:", data?.length);
      return data;
    },
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  const agendamentos = useMemo(() => {
    if (!agendamentosData) return [];
    return agendamentosData.map((item: SupabaseAgendamentoItem) => ({
      id: item.id,
      cliente: item.liberacao?.cliente_nome || "N/A",
      produto: item.liberacao?.produto?.nome || "N/A",
      quantidade: item.quantidade,
      data: new Date(item.data_retirada).toLocaleDateString("pt-BR"),
      horario: item.horario || "00:00",
      placa: item.placa_caminhao || "N/A",
      motorista: item.motorista_nome || "N/A",
      documento: item.motorista_documento || "N/A",
      pedido: item.liberacao?.pedido_interno || "N/A",
      status: item.status as AgendamentoStatus,
      armazem: item.liberacao?.armazem?.cidade || item.liberacao?.armazem?.estado,
      produto_id: item.liberacao?.produto?.id,
      armazem_id: item.liberacao?.armazem?.id,
      liberacao_id: item.liberacao?.id,
    }));
  }, [agendamentosData]);

  // Dialog "Novo Agendamento"
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

  // Buscar liberações pendentes para o formulário
  const { data: liberacoesPendentes } = useQuery({
    queryKey: ["liberacoes-pendentes"],
    queryFn: async () => {
      console.log("🔍 [DEBUG] Buscando liberações pendentes...");
      const { data, error } = await supabase
        .from("liberacoes")
        .select(`
          id,
          cliente_nome,
          pedido_interno,
          quantidade_liberada,
          quantidade_retirada,
          produto:produtos(nome),
          armazem:armazens(cidade, estado)
        `)
        .in("status", ["pendente", "parcial"])
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      console.log("✅ [DEBUG] Liberações pendentes:", data?.length);
      return data || [];
    },
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
  };

  const handleCreateAgendamento = async () => {
    const { liberacao, quantidade, data, horario, placa, motorista, documento } = novoAgendamento;

    if (!liberacao || !quantidade || !data || !horario || !placa.trim() || !motorista.trim() || !documento.trim()) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }

    const qtdNum = Number(quantidade);
    if (Number.isNaN(qtdNum) || qtdNum <= 0) {
      toast({ variant: "destructive", title: "Quantidade inválida" });
      return;
    }

    try {
      console.log("🔍 [DEBUG] Criando agendamento:", { liberacao, quantidade: qtdNum, data, horario });

      const { data: userData } = await supabase.auth.getUser();
      
      const { data: agendData, error: errAgend } = await supabase
        .from("agendamentos")
        .insert({
          liberacao_id: liberacao,
          quantidade: qtdNum,
          data_retirada: data,
          horario: horario,
          placa_caminhao: placa.trim().toUpperCase(),
          motorista_nome: motorista.trim(),
          motorista_documento: documento.trim(),
          tipo_caminhao: novoAgendamento.tipoCaminhao || null,
          observacoes: novoAgendamento.observacoes || null,
          status: "confirmado",
          created_by: userData.user?.id,
        })
        .select(`
          id,
          data_retirada,
          liberacao:liberacoes(
            cliente_nome,
            pedido_interno,
            produto:produtos(nome)
          )
        `)
        .single();

      if (errAgend) {
        console.error("❌ [ERROR] Erro ao criar agendamento:", errAgend);
        throw new Error(`Erro ao criar agendamento: ${errAgend.message} (${errAgend.code || 'N/A'})`);
      }

      console.log("✅ [SUCCESS] Agendamento criado:", agendData);

      toast({ 
        title: "Agendamento criado com sucesso!", 
        description: `${agendData.liberacao?.cliente_nome} - ${new Date(agendData.data_retirada).toLocaleDateString("pt-BR")} - ${qtdNum}t` 
      });

      resetFormNovoAgendamento();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["liberacoes-pendentes"] });

    } catch (err: unknown) {
      console.error("❌ [ERROR] Erro geral ao criar agendamento:", err);
      
      toast({
        variant: "destructive",
        title: "Erro ao criar agendamento",
        description: err instanceof Error ? err.message : "Erro desconhecido"
      });
    }
  };

  /* Filtros compactos + colapsáveis */
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
                      // Auto-fill quantidade disponível
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
                      {liberacoesPendentes?.map((lib) => {
                        const disponivel = lib.quantidade_liberada - lib.quantidade_retirada;
                        return (
                          <SelectItem key={lib.id} value={lib.id}>
                            {lib.pedido_interno} - {lib.cliente_nome} - {lib.produto?.nome} ({disponivel}t disponível) - {lib.armazem?.cidade}/{lib.armazem?.estado}
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
                    onChange={(e) => setNovoAgendamento((s) => ({ ...s, placa: e.target.value.toUpperCase() }))} 
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
                      onChange={(e) => setNovoAgendamento((s) => ({ ...s, documento: e.target.value }))} 
                      placeholder="Ex: 123.456.789-00"
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
