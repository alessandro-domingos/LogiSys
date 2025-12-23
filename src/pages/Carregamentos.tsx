import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, X, Filter as FilterIcon, ChevronDown, ChevronUp } from "lucide-react";

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
  cliente_id: string | null;
  armazem_id: string | null;
}

interface SupabaseCarregamentoItem {
  id: string;
  status: StatusCarregamento | null;
  etapa_atual: number | null;
  numero_nf: string | null;
  data_chegada: string | null;
  created_at: string | null;
  cliente_id: string | null;
  armazem_id: string | null;
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

// Array de etapas
const ETAPAS = [
  { id: 0, nome: "Aguardando início" },
  { id: 1, nome: "Chegada" },
  { id: 2, nome: "Início Carregamento" },
  { id: 3, nome: "Carregando" },
  { id: 4, nome: "Finalização Processual" },
  { id: 5, nome: "Finalização Fiscal" }
];

const Carregamentos = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [armazemId, setArmazemId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const fetchRoles = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (data) setRoles(data.map((r) => r.role));
    };

    fetchRoles();
  }, [userId]);

  // Atualizado: só busca os vínculos de cliente/armazem SE necessário!
  useEffect(() => {
    const fetchVinculos = async () => {
      if (!userId || roles.length === 0) return;
      if (roles.includes("cliente")) {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", userId)
          .single();
        setClienteId(cliente?.id ?? null);
      } else {
        setClienteId(null);
      }
      if (roles.includes("armazem")) {
        const { data: armazem } = await supabase
          .from("armazens")
          .select("id")
          .eq("user_id", userId)
          .single();
        setArmazemId(armazem?.id ?? null);
      } else {
        setArmazemId(null);
      }
    };

    fetchVinculos();
    // eslint-disable-next-line
  }, [userId, roles]);

  // Query principal - filtro diretamente na supabase
  const { data: carregamentosData, isLoading, error } = useQuery({
    queryKey: ["carregamentos", clienteId, armazemId, roles],
    queryFn: async () => {
      let query = supabase
        .from("carregamentos")
        .select(`
          id,
          status,
          etapa_atual,
          numero_nf,
          data_chegada,
          created_at,
          cliente_id,
          armazem_id,
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
        .order("data_chegada", { ascending: false });

      // Aplica filtro pelo perfil (para performance extra, embora a policy já garanta segurança)
      if (roles.includes("cliente") && clienteId) {
        query = query.eq("cliente_id", clienteId);
      } else if (roles.includes("armazem") && armazemId) {
        query = query.eq("armazem_id", armazemId);
      }
      // admin/logistica: vê tudo

      const { data, error } = await query;
      if (error) {
        console.error("[ERROR] Erro ao buscar carregamentos:", error);
        throw error;
      }
      return data;
    },
    // A query só deve ser habilitada após:
    //  - userId e roles definidos
    //  - se for cliente/armazem, o respectivo id já buscado (ou null para outros)
    enabled:
      userId != null &&
      roles.length > 0 &&
      (
        (!roles.includes("cliente") && !roles.includes("armazem")) // admin/logistica pode carregar sem esperar mais nada
        || (roles.includes("cliente") && clienteId !== null)
        || (roles.includes("armazem") && armazemId !== null)
      ),
    refetchInterval: 30000,
  });

  const carregamentos = useMemo<CarregamentoItem[]>(() => {
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
        status: (item.status as StatusCarregamento) || "aguardando",
        etapa_atual: item.etapa_atual ?? 0,
        fotosTotal: item.fotos ? item.fotos.length : 0,
        numero_nf: item.numero_nf || null,
        cliente_id: item.cliente_id ?? null,
        armazem_id: item.armazem_id ?? null,
      };
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

  const getEtapaLabel = (etapa_atual: number) => {
    const found = ETAPAS.find(e => e.id === etapa_atual);
    return found ? found.nome : `Etapa ${etapa_atual}`;
  };

  if (isLoading || userId == null || roles.length === 0 ||
    (roles.includes("cliente") && clienteId === null) ||
    (roles.includes("armazem") && armazemId === null)
  ) {
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
            <Link key={carr.id} to={`/carregamentos/${carr.id}`} style={{ textDecoration: "none", color: "inherit" }}>
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
                          <p className="text-xs text-muted-foreground mt-1">Etapa: <span className="font-medium">{getEtapaLabel(carr.etapa_atual)}</span></p>
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
