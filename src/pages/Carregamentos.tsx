import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, X, Filter as FilterIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type StatusCarregamento = "aguardando" | "liberado" | "carregando" | "carregado" | "nf_entregue";

interface CarregamentoItem {
  id: string;
  cliente: string;
  produto: string;
  quantidade: number;
  placa: string;
  motorista: string;
  horario: string;
  data: string; // dd/mm/yyyy
  status: StatusCarregamento;
  fotosTotal: number;
  warehouseId?: number | string;
}

interface SupabaseCarregamentoItem {
  id: string;
  status: StatusCarregamento | null;
  created_at: string | null;
  agendamento: {
    id: string;
    horario: string;
    data_retirada: string;
    placa_caminhao: string;
    motorista_nome: string;
    quantidade: number;
    liberacao: {
      id: string;
      pedido_interno: string;
      cliente_id: string;
      produtos: {
        nome: string;
      } | null;
      clientes: {
        nome: string;
      } | null;
    } | null;
  } | null;
}

const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Carregamentos = () => {
  // Fetch carregamentos from Supabase
  const { data: carregamentosData, isLoading, error } = useQuery({
    queryKey: ["carregamentos"],
    queryFn: async () => {
      console.log("🔍 [DEBUG] Buscando carregamentos...");
      const { data, error } = await supabase
        .from("carregamentos")
        .select(`
          id,
          status,
          created_at,
          agendamento:agendamentos!inner (
            id,
            horario,
            data_retirada,
            placa_caminhao,
            motorista_nome,
            quantidade,
            liberacao:liberacoes!inner (
              id,
              pedido_interno,
              cliente_id,
              produtos:produto_id (
                nome
              ),
              clientes:cliente_id (
                nome
              )
            )
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("❌ [ERROR] Erro ao buscar carregamentos:", error);
        throw error;
      }
      console.log("✅ [DEBUG] Carregamentos carregados:", data?.length);
      return data;
    },
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  // Transform data from Supabase to UI format
  const carregamentos = useMemo(() => {
    if (!carregamentosData) return [];
    return carregamentosData.map((item: SupabaseCarregamentoItem) => {
      const agendamento = item.agendamento;
      const liberacao = agendamento?.liberacao;
      
      return {
        id: item.id,
        cliente: liberacao?.clientes?.nome || "N/A",
        produto: liberacao?.produtos?.nome || "N/A",
        quantidade: agendamento?.quantidade || 0,
        placa: agendamento?.placa_caminhao || "N/A",
        motorista: agendamento?.motorista_nome || "N/A",
        horario: agendamento?.horario || "00:00",
        data: agendamento?.data_retirada 
          ? new Date(agendamento.data_retirada).toLocaleDateString("pt-BR")
          : "N/A",
        status: item.status || "aguardando",
        fotosTotal: 0, // Placeholder - will be implemented in future stages
        warehouseId: undefined,
      } as CarregamentoItem;
    });
  }, [carregamentosData]);

  /* Filtros compactos + colapsáveis */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusCarregamento[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedWarehouses, setSelectedWarehouses] = useState<(string | number)[]>([]);

  const allStatuses: StatusCarregamento[] = ["aguardando", "liberado", "carregando", "carregado", "nf_entregue"];
  const allWarehouses = useMemo(() => Array.from(new Set(carregamentos.map((c) => c.warehouseId).filter(Boolean))) as (string | number)[], [carregamentos]);

  const toggleStatus = (st: StatusCarregamento) => setSelectedStatuses((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  const toggleWarehouse = (w: string | number) => setSelectedWarehouses((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  const clearFilters = () => { setSearch(""); setSelectedStatuses([]); setDateFrom(""); setDateTo(""); setSelectedWarehouses([]); };

  const filteredCarregamentos = useMemo(() => {
    return carregamentos.filter((c) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${c.cliente} ${c.produto} ${c.placa} ${c.motorista}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(c.status)) return false;
      if (selectedWarehouses.length > 0 && c.warehouseId && !selectedWarehouses.includes(c.warehouseId)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (parseDate(c.data) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (parseDate(c.data) > to) return false;
      }
      return true;
    });
  }, [carregamentos, search, selectedStatuses, selectedWarehouses, dateFrom, dateTo]);

  const showingCount = filteredCarregamentos.length;
  const totalCount = carregamentos.length;
  const activeAdvancedCount = (selectedStatuses.length ? 1 : 0) + (selectedWarehouses.length ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);

  const getStatusBadgeVariant = (status: StatusCarregamento) => {
    switch (status) {
      case "aguardando": return "secondary";
      case "liberado": return "default";
      case "carregando": return "default";
      case "carregado": return "default";
      case "nf_entregue": return "default";
      default: return "outline";
    }
  };

  const getStatusLabel = (status: StatusCarregamento) => {
    switch (status) {
      case "aguardando": return "Aguardando";
      case "liberado": return "Liberado";
      case "carregando": return "Carregando";
      case "carregado": return "Carregado";
      case "nf_entregue": return "NF Entregue";
      default: return status;
    }
  };

  // Show loading state
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

  // Show error state
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

      {/* Barra compacta */}
      <div className="container mx-auto px-6 pt-3">
        <div className="flex items-center gap-3">
          <Input className="h-9 flex-1" placeholder="Buscar por cliente, produto, placa ou motorista..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {allStatuses.map((st) => {
                    const active = selectedStatuses.includes(st);
                    const label = getStatusLabel(st);
                    return (
                      <Badge key={st} onClick={() => toggleStatus(st)} className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900"}`}>
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              {allWarehouses.length > 0 && (
                <div className="space-y-1">
                  <Label>Armazéns</Label>
                  <div className="flex flex-wrap gap-2">
                    {allWarehouses.map((w) => {
                      const active = selectedWarehouses.includes(w);
                      return (
                        <Badge key={String(w)} onClick={() => toggleWarehouse(w)} className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900"}`}>
                          Armazém {String(w)}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
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
          {filteredCarregamentos.map((carr) => (
            <Card key={carr.id} className="transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-warning">
                        <Truck className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{carr.cliente}</h3>
                        <p className="text-sm text-muted-foreground">{carr.produto} - {carr.quantidade}t</p>
                        <p className="text-xs text-muted-foreground">{carr.data} • {carr.horario}</p>
                        <p className="text-xs text-muted-foreground">Placa: <span className="font-medium">{carr.placa}</span></p>
                        <p className="text-xs text-muted-foreground">Motorista: <span className="font-medium">{carr.motorista}</span></p>
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
          ))}
          {filteredCarregamentos.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhum carregamento encontrado.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Carregamentos;
