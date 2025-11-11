import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, X, Filter as FilterIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StockStatus = "normal" | "baixo";
type Unidade = "t" | "kg";

interface StockItem {
  id: string; // UUID agora
  produto: string;
  armazem: string;
  quantidade: number;
  unidade: string;
  status: StockStatus;
  data: string; // formato ISO ou timestamp
  produto_id?: string;
  armazem_id?: string;
}

interface SupabaseEstoqueItem {
  id: string;
  quantidade: number;
  updated_at: string;
  produto: {
    id: string;
    nome: string;
    unidade: string;
  } | null;
  armazem: {
    id: string;
    nome: string;
    cidade: string;
  } | null;
}

const computeStatus = (qtd: number): StockStatus => (qtd < 10 ? "baixo" : "normal");
const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Estoque = () => {
  const { toast } = useToast();

  const { data: estoqueData, isLoading, error } = useQuery({
    queryKey: ["estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select(`
          id,
          quantidade,
          updated_at,
          produto:produtos(id, nome, unidade),
          armazem:armazens(id, nome, cidade)
        `)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  const estoque = useMemo(() => {
    if (!estoqueData) return [];
    return estoqueData.map((item: SupabaseEstoqueItem) => ({
      id: item.id,
      produto: item.produto?.nome || "N/A",
      armazem: item.armazem?.cidade || item.armazem?.nome || "N/A",
      quantidade: item.quantidade,
      unidade: item.produto?.unidade || "t",
      status: (item.quantidade < 10 ? "baixo" : "normal") as StockStatus,
      data: new Date(item.updated_at).toLocaleDateString("pt-BR"),
      produto_id: item.produto?.id,
      armazem_id: item.armazem?.id,
    }));
  }, [estoqueData]);

  // Dialog "Novo Produto"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({
    nome: "",
    armazem: "",
    quantidade: "",
    unidade: "t" as Unidade,
  });

  const resetFormNovoProduto = () => {
    setNovoProduto({ nome: "", armazem: "", quantidade: "", unidade: "t" });
  };

  const handleCreateProduto = () => {
    // Functionality disabled - button is disabled in UI
    // TODO: Implement real Supabase INSERT when this feature is enabled
    toast({ variant: "destructive", title: "Funcionalidade desabilitada", description: "Adicionar novos produtos ainda não está implementado." });
  };

  /* ---------------- Filtros (compacto + colapsável) ---------------- */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StockStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);

  const allStatuses: StockStatus[] = ["normal", "baixo"];
  const allWarehouses = useMemo(() => Array.from(new Set(estoque.map((e) => e.armazem))).sort(), [estoque]);

  const toggleStatus = (st: StockStatus) => {
    setSelectedStatuses((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  };
  const toggleWarehouse = (w: string) => {
    setSelectedWarehouses((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  };
  const clearFilters = () => {
    setSearch("");
    setSelectedStatuses([]);
    setDateFrom("");
    setDateTo("");
    setSelectedWarehouses([]);
  };

  const filteredEstoque = useMemo(() => {
    return estoque.filter((item) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${item.produto} ${item.armazem}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.status)) return false;
      if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(item.armazem)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (parseDate(item.data) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (parseDate(item.data) > to) return false;
      }
      return true;
    });
  }, [estoque, search, selectedStatuses, selectedWarehouses, dateFrom, dateTo]);

  const showingCount = filteredEstoque.length;
  const totalCount = estoque.length;

  const activeAdvancedCount =
    (selectedStatuses.length ? 1 : 0) +
    (selectedWarehouses.length ? 1 : 0) +
    ((dateFrom || dateTo) ? 1 : 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Controle de Estoque" description="Carregando..." actions={<></>} />
        <div className="container mx-auto px-6 py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando estoque...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Controle de Estoque" description="Erro ao carregar dados" actions={<></>} />
        <div className="container mx-auto px-6 py-8 text-center">
          <p className="text-destructive">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Controle de Estoque"
        description="Gerencie o estoque de produtos por armazém"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary" disabled={true}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Produto</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do produto</Label>
                  <Input id="nome" value={novoProduto.nome} onChange={(e) => setNovoProduto((s) => ({ ...s, nome: e.target.value }))} placeholder="Ex.: Ureia, MAP, NPK 20-05-20" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="armazem">Armazém</Label>
                  <Input id="armazem" value={novoProduto.armazem} onChange={(e) => setNovoProduto((s) => ({ ...s, armazem: e.target.value }))} placeholder="Ex.: São Paulo, Curitiba" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input id="quantidade" type="number" step="0.01" min="0" value={novoProduto.quantidade} onChange={(e) => setNovoProduto((s) => ({ ...s, quantidade: e.target.value }))} placeholder="Ex.: 10.5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unidade">Unidade</Label>
                    <Select value={novoProduto.unidade} onValueChange={(v) => setNovoProduto((s) => ({ ...s, unidade: v as Unidade }))}>
                      <SelectTrigger id="unidade"><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="t">Toneladas (t)</SelectItem>
                        <SelectItem value="kg">Quilos (kg)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-gradient-primary" onClick={handleCreateProduto}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Barra compacta: busca + contador + toggle */}
      <div className="container mx-auto px-6 pt-3">
        <div className="flex items-center gap-3">
          <Input
            className="h-9 flex-1"
            placeholder="Buscar por produto ou armazém..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Mostrando <span className="font-medium">{showingCount}</span> de <span className="font-medium">{totalCount}</span>
          </span>
          <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => setFiltersOpen((v) => !v)}>
            <FilterIcon className="h-4 w-4 mr-1" />
            Filtros {activeAdvancedCount ? `(${activeAdvancedCount})` : ""}
            {filtersOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </div>

      {/* Área avançada colapsável */}
      {filtersOpen && (
        <div className="container mx-auto px-6 pt-2">
          <div className="rounded-md border p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {allStatuses.map((st) => {
                    const active = selectedStatuses.includes(st);
                    return (
                      <Badge
                        key={st}
                        onClick={() => toggleStatus(st)}
                        className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900"}`}
                      >
                        {st === "normal" ? "Normal" : "Baixo"}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Armazéns</Label>
                <div className="flex flex-wrap gap-2">
                  {allWarehouses.map((w) => {
                    const active = selectedWarehouses.includes(w);
                    return (
                      <Badge
                        key={w}
                        onClick={() => toggleWarehouse(w)}
                        className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900"}`}
                      >
                        {w}
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
          {filteredEstoque.map((item) => (
            <Card key={item.id} className="transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{item.produto}</h3>
                      <p className="text-xs text-muted-foreground">{item.armazem} • {item.data}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <p className="text-xl font-bold text-foreground">{item.quantidade} {item.unidade}</p>
                      <p className="text-xs text-muted-foreground">Disponível</p>
                    </div>
                    <Badge variant={item.status === "baixo" ? "destructive" : "secondary"}>
                      {item.status === "baixo" ? "Estoque Baixo" : "Normal"}
                    </Badge>
                    <Button variant="outline" size="sm">Atualizar</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredEstoque.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhum resultado encontrado com os filtros atuais.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Estoque;
