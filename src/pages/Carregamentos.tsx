import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, X, Filter as FilterIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type StatusCarregamento = "aguardando" | "em_andamento" | "finalizado" | "cancelado";

interface CarregamentoItem {
  id: string;
  cliente: string;
  quantidade: number;
  placa: string;
  motorista: string;
  data_retirada: string; // yyyy-mm-dd
  horario: string;
  status: StatusCarregamento;
  etapa_atual: number;
  fotosTotal: number;
  numero_nf: string | null;
}

interface SupabaseCarregamentoItem {
  id: string;
  status: StatusCarregamento | null;
  etapa_atual: number | null;
  numero_nf: string | null;
  data_chegada: string | null;
  created_at: string | null;
  agendamento: {
    id: string;
    data_retirada: string;
    horario: string | null;
    quantidade: number | null;
    cliente: {
      nome: string | null;
    } | null;
    placa_caminhao: string | null;
    motorista_nome: string | null;
    motorista_documento: string | null;
  } | null;
  fotos: { id: string }[];
}

const Carregamentos = () => {
  // Substitua pelo ID dinâmico do usuário logado/cliente/armazém conforme seu contexto
  // para armazém, troque o filtro pelo código ideal do seu RBAC

  const { data: carregamentosData, isLoading, error } = useQuery({
    queryKey: ["carregamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carregamentos")
        .select(`
          id,
          status,
          etapa_atual,
          numero_nf,
          data_chegada,
          created_at,
          agendamento:agendamentos!carregamentos_agendamento_id_fkey (
            id,
            data_retirada,
            horario,
            quantidade,
            cliente:clientes!agendamentos_cliente_id_fkey (
              nome
            ),
            placa_caminhao,
            motorista_nome,
            motorista_documento
          ),
          fotos:fotos_carregamento (
            id
          )
        `)
        // Adapte: filtro por armazém (precisa saber como o armazém está relacionado ao agendamento)
        // .eq('agendamento.armazem_id', <ID_ARMAZEM>)
        // Exemplo para cliente:
        // .eq('agendamento.cliente_id', <ID_CLIENTE>)
        .order("data_chegada", { ascending: false });
      if (error) {
        console.error("[ERROR] Erro ao buscar carregamentos:", error);
        throw error;
      }
      return data;
    },
    refetchInterval: 30000,
  });

  // Transform dados da Supabase para UI
  const carregamentos = useMemo(() => {
    if (!carregamentosData) return [];
    return carregamentosData.map((item: SupabaseCarregamentoItem) => {
      const agendamento = item.agendamento;
      return {
        id: item.id,
        cliente: agendamento?.cliente?.nome || "N/A",
        quantidade: agendamento?.quantidade || 0,
        placa: agendamento?.placa_caminhao || "N/A",
        motorista: agendamento?.motorista_nome || "N/A",
        data_retirada: agendamento?.data_retirada || "N/A",
        horario: agendamento?.horario || "00:00",
        status: item.status || "aguardando",
        etapa_atual: item.etapa_atual || 1,
        fotosTotal: item.fotos?.length || 0,
        numero_nf: item.numero_nf || null,
      } as CarregamentoItem;
    });
  }, [carregamentosData]);

  // Filtros
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusCarregamento[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const allStatuses: StatusCarregamento[] = ["aguardando", "em_andamento", "finalizado", "cancelado"];

  const toggleStatus = (st: StatusCarregamento) =>
    setSelectedStatuses((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  const clearFilters = () => {
    setSearch("");
    setSelectedStatuses([]);
    setDateFrom("");
    setDateTo("");
  };

  const filteredCarregamentos = useMemo(() => {
    return carregamentos.filter((c) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${c.cliente} ${c.motorista} ${c.placa}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(c.status)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(c.data_retirada) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(c.data_retirada) > to) return false;
      }
      return true;
    });
  }, [carregamentos, search, selectedStatuses, dateFrom, dateTo]);

  const showingCount = filteredCarregamentos.length;
  const totalCount = carregamentos.length;
  const activeAdvancedCount =
    (selectedStatuses.length ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);

  const getStatusBadgeVariant = (status: StatusCarregamento) => {
    switch (status) {
      case "aguardando": return "secondary";
      case "em_andamento": return "default";
      case "finalizado": return "default";
      case "cancelado": return "outline";
      default: return "outline";
    }
  };

  const getStatusLabel = (status: StatusCarregamento) => {
    switch (status) {
      case "aguardando": return "Aguardando início";
      case "em_andamento": return "Em andamento";
      case "finalizado": return "Finalizado";
      case "cancelado": return "Cancelado";
      default: return status;
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Carregamentos"
          description="Acompanhe o status dos carregamentos em andamento"
        />
        <div className="container mx-auto px-6 py-12 text-center">
          <div className="flex justify-center items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="text-muted-foreground">Carregando carregamentos...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Carregamentos"
          description="Acompanhe o status dos carregamentos em andamento"
        />
        <div className="container mx-auto px-6 py-12">
          <Card className="border-destructive">
            <CardContent className="p-6">
              <div className="text-center text-destructive">
                <p className="font-semibold">Erro ao carregar carregamentos</p>
                <p className="text-sm mt-2">{error instanceof Error ? error.message : "Erro desconhecido"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Carregamentos"
        description="Acompanhe o status dos carregamentos em andamento"
      />

      {/* Barra de busca/filtro */}
      <div className="container mx-auto px-6 pt-3">
        <div className="flex items-center gap-3">
          <Input className="h-9 flex-1" placeholder="Buscar por cliente, placa ou motorista..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Mostrando <span className="font-medium">{showingCount}</span> de <span className="font-medium">{totalCount}</span>
          </span>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {allStatuses.map((st) => {
                    const active = selectedStatuses.includes(st);
                    const label = getStatusLabel(st);
                    return (
                      <Badge
                        key={st}
                        onClick={() => toggleStatus(st)}
                        className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900"}`}>
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
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-4 w-4" /> Limpar Filtros
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 py-6">
        <div className="grid gap-4">
          {filteredCarregamentos.map((carr) => (
            <Link key={carr.id} href={`/Carregamentos/${carr.id}`}>
              <Card className="transition-all hover:shadow-md cursor-pointer">
                <CardContent className="p-5">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-warning">
                          <Truck className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{carr.cliente}</h3>
                          <p className="text-sm text-muted-foreground">{carr.quantidade} toneladas</p>
                          <p className="text-xs text-muted-foreground">{carr.data_retirada} • {carr.horario}</p>
                          <p className="text-xs text-muted-foreground">Placa: <span className="font-medium">{carr.placa}</span></p>
                          <p className="text-xs text-muted-foreground">Motorista: <span className="font-medium">{carr.motorista}</span></p>
                          {carr.numero_nf && (
                            <p className="text-xs text-muted-foreground">Nº NF: <span className="font-medium">{carr.numero_nf}</span></p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={getStatusBadgeVariant(carr.status)}>
                          {getStatusLabel(carr.status)}
                        </Badge>
                        <div className="text-xs text-muted-foreground">Fotos: <span className="font-semibold">{carr.fotosTotal}</span></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {filteredCarregamentos.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhum carregamento encontrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Carregamentos;
