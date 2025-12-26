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

interface CarregamentoItem {
  id: string;
  cliente: string;
  quantidade: number;
  placa: string;
  motorista: string;
  data_retirada: string; // yyyy-mm-dd
  horario: string;
  etapa_atual: number;
  fotosTotal: number;
  numero_nf: string | null;
  cliente_id: string | null;
  armazem_id: string | null;
}

interface SupabaseCarregamentoItem {
  id: string;
  etapa_atual: number | null;
  numero_nf: string | null;
  data_chegada: string | null;
  created_at: string | null;
  cliente_id: string | null;
  armazem_id: string | null;
  // URLs das fotos por etapa
  url_foto_chegada: string | null;
  url_foto_inicio: string | null;
  url_foto_carregando: string | null;
  url_foto_finalizacao: string | null;
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
}

// Array de etapas com cores visuais bem contrastadas
const ETAPAS = [
  { id: 1, nome: "Chegada", cor: "bg-orange-500 text-white", corFiltro: "bg-orange-100 text-orange-800 hover:bg-orange-200" },
  { id: 2, nome: "Início Carregamento", cor: "bg-blue-500 text-white", corFiltro: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  { id: 3, nome: "Carregando", cor: "bg-purple-500 text-white", corFiltro: "bg-purple-100 text-purple-800 hover:bg-purple-200" },
  { id: 4, nome: "Carreg. Finalizado", cor: "bg-indigo-500 text-white", corFiltro: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200" },
  { id: 5, nome: "Documentação", cor: "bg-yellow-600 text-white", corFiltro: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  { id: 6, nome: "Finalizado", cor: "bg-green-600 text-white", corFiltro: "bg-green-100 text-green-800 hover:bg-green-200" },
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

  const { data: carregamentosData, isLoading, error } = useQuery({
    queryKey: ["carregamentos", clienteId, armazemId, roles],
    queryFn: async () => {
      let query = supabase
        .from("carregamentos")
        .select(`
          id,
          etapa_atual,
          numero_nf,
          data_chegada,
          created_at,
          cliente_id,
          armazem_id,
          url_foto_chegada,
          url_foto_inicio,
          url_foto_carregando,
          url_foto_finalizacao,
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
          )
        `)
        .order("data_chegada", { ascending: false });

      if (roles.includes("cliente") && clienteId) {
        query = query.eq("cliente_id", clienteId);
      } else if (roles.includes("armazem") && armazemId) {
        query = query.eq("armazem_id", armazemId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[ERROR] Erro ao buscar carregamentos:", error);
        throw error;
      }
      return data;
    },
    enabled:
      userId != null &&
      roles.length > 0 &&
      (
        (!roles.includes("cliente") && !roles.includes("armazem"))
        || (roles.includes("cliente") && clienteId !== null)
        || (roles.includes("armazem") && armazemId !== null)
      ),
    refetchInterval: 30000,
  });

  const carregamentos = useMemo<CarregamentoItem[]>(() => {
    if (!carregamentosData) return [];
    return carregamentosData.map((item: SupabaseCarregamentoItem) => {
      const agendamento = item.agendamento;
      
      // Conta quantas fotos existem baseado nas URLs preenchidas
      const fotosCount = [
        item.url_foto_chegada,
        item.url_foto_inicio,
        item.url_foto_carregando,
        item.url_foto_finalizacao
      ].filter(url => url && url.trim() !== '').length;

      const etapaAtual = item.etapa_atual ?? 1;

      return {
        id: item.id,
        cliente: agendamento?.cliente?.nome || "N/A",
        quantidade: agendamento?.quantidade || 0,
        placa: agendamento?.placa_caminhao || "N/A",
        motorista: agendamento?.motorista_nome || "N/A",
        data_retirada: agendamento?.data_retirada || "N/A",
        horario: agendamento?.horario || "00:00",
        etapa_atual: etapaAtual,
        fotosTotal: fotosCount,
        numero_nf: item.numero_nf || null,
        cliente_id: item.cliente_id ?? null,
        armazem_id: item.armazem_id ?? null,
      };
    });
  }, [carregamentosData]);

  // Filtros simplificados - apenas etapas e período
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedEtapas, setSelectedEtapas] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const toggleEtapa = (etapa: number) =>
    setSelectedEtapas((prev) => (prev.includes(etapa) ? prev.filter((e) => e !== etapa) : [...prev, etapa]));
  
  const clearFilters = () => {
    setSearch("");
    setSelectedEtapas([]);
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
      if (selectedEtapas.length > 0 && !selectedEtapas.includes(c.etapa_atual)) return false;
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
  }, [carregamentos, search, selectedEtapas, dateFrom, dateTo]);

  const showingCount = filteredCarregamentos.length;
  const totalCount = carregamentos.length;
  const activeAdvancedCount =
    (selectedEtapas.length ? 1 : 0) + 
    ((dateFrom || dateTo) ? 1 : 0);

  const getEtapaInfo = (etapa_atual: number) => {
    const found = ETAPAS.find(e => e.id === etapa_atual);
    return found || { id: etapa_atual, nome: `Etapa ${etapa_atual}`, cor: "bg-gray-500 text-white", corFiltro: "bg-gray-100 text-gray-800 hover:bg-gray-200" };
  };

  if (isLoading || userId == null || roles.length === 0 ||
    (roles.includes("cliente") && clienteId === null) ||
    (roles.includes("armazem") && armazemId === null)
  ) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Carregamentos"
          description="Acompanhe o progresso dos carregamentos"
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
          description="Acompanhe o progresso dos carregamentos"
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
        description="Acompanhe o progresso dos carregamentos"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Etapas</Label>
                <div className="flex flex-wrap gap-2">
                  {ETAPAS.map((etapa) => {
                    const active = selectedEtapas.includes(etapa.id);
                    return (
                      <Badge
                        key={etapa.id}
                        onClick={() => toggleEtapa(etapa.id)}
                        className={`cursor-pointer text-xs px-2 py-1 border-0 ${
                          active 
                            ? etapa.cor 
                            : etapa.corFiltro
                        }`}>
                        {etapa.nome}
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
          {filteredCarregamentos.map((carr) => {
            const etapaInfo = getEtapaInfo(carr.etapa_atual);
            
            return (
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
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {/* Badge da etapa (onde estava o status) */}
                          <Badge className={`${etapaInfo.cor} border-0 font-medium`}>
                            {etapaInfo.nome}
                          </Badge>
                          <div className="text-xs text-muted-foreground">Fotos: <span className="font-semibold">{carr.fotosTotal}</span></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
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
