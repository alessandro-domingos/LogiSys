import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, X, Filter as FilterIcon, ChevronDown, ChevronUp } from "lucide-react";

type StatusCarregamento = "aguardando" | "em_andamento" | "concluido" | "cancelado";

interface CarregamentoItem {
  id: number;
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

const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Carregamentos = () => {
  const [carregamentos] = useState<CarregamentoItem[]>([
    { id: 1, cliente: "Cliente ABC", produto: "Ureia", quantidade: 4.0, placa: "ABC-1234", motorista: "João Silva", horario: "14:00", data: "18/01/2024", status: "em_andamento", fotosTotal: 2, warehouseId: 11 },
    { id: 2, cliente: "Transportadora XYZ", produto: "NPK 20-05-20", quantidade: 8.0, placa: "DEF-5678", motorista: "Maria Santos", horario: "15:30", data: "18/01/2024", status: "aguardando", fotosTotal: 0, warehouseId: 11 },
    { id: 3, cliente: "Fazenda Boa Vista", produto: "Super Simples", quantidade: 12.0, placa: "GHI-9012", motorista: "Pedro Costa", horario: "16:00", data: "19/01/2024", status: "aguardando", fotosTotal: 1, warehouseId: 12 },
  ]);

  /* Filtros compactos + colapsáveis */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusCarregamento[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedWarehouses, setSelectedWarehouses] = useState<(string | number)[]>([]);

  const allStatuses: StatusCarregamento[] = ["aguardando", "em_andamento", "concluido", "cancelado"];
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
      case "em_andamento": return "default";
      case "concluido": return "default";
      case "cancelado": return "destructive";
      default: return "outline";
    }
  };

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
                    const label = st === "aguardando" ? "Aguardando" : st === "em_andamento" ? "Em Andamento" : st === "concluido" ? "Concluído" : "Cancelado";
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
                        {carr.status === "em_andamento" ? "Em Andamento" : carr.status.charAt(0).toUpperCase() + carr.status.slice(1)}
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
