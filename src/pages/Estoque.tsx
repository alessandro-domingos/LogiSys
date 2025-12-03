import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  id: string;
  produto: string;
  armazem: string;
  quantidade: number;
  unidade: string;
  status: StockStatus;
  data: string;
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
    estado?: string;
  } | null;
}

const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Estoque = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  // Consulta do estoque
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
          armazem:armazens(id, nome, cidade, estado)
        `)
        .order("updated_at", { ascending: false });

      console.log("[DEBUG] Dados do estoque lidos:", data);

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao buscar estoque",
          description: error.message,
        });
        throw error;
      }
      return data;
    },
    refetchInterval: 30000,
  });

  // Consulta dos produtos cadastrados para o combobox do modal
  const { data: produtosCadastrados } = useQuery({
    queryKey: ["produtos-cadastrados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, unidade")
        .order("nome");
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao buscar produtos",
          description: error.message,
        });
        return [];
      }
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Consulta dos armazéns ativos
  const { data: armazensAtivos } = useQuery({
    queryKey: ["armazens-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado")
        .eq("ativo", true)
        .order("cidade");
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao buscar armazéns",
          description: error.message,
        });
        return [];
      }
      return data || [];
    },
  });

  // Filtro avançado/facil para busca e grid
  const { data: armazensParaFiltro } = useQuery({
    queryKey: ["armazens-filtro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("armazens")
        .select("id, cidade, estado, ativo")
        .eq("ativo", true)
        .order("cidade");
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao buscar armazéns para filtro",
          description: error.message,
        });
        return [];
      }
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Transformação dos dados para renderização
  const estoque = useMemo(() => {
    if (!estoqueData) return [];
    return estoqueData.map((item: SupabaseEstoqueItem) => ({
      id: item.id,
      produto: item.produto?.nome || "N/A",
      armazem: item.armazem ? ((item.armazem.cidade ? item.armazem.cidade : "") + (item.armazem.estado ? `/${item.armazem.estado}` : "")) : "N/A",
      quantidade: item.quantidade,
      unidade: item.produto?.unidade || "t",
      status: item.quantidade < 10 ? "baixo" : "normal",
      data: new Date(item.updated_at).toLocaleDateString("pt-BR"),
      produto_id: item.produto?.id,
      armazem_id: item.armazem?.id,
    }));
  }, [estoqueData]);

  // Dialog "Entrada de Estoque"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({
    produtoId: "",
    armazem: "",
    quantidade: "",
    unidade: "t" as Unidade,
  });

  // Estado para edição inline de quantidade dos cards
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");

  const resetFormNovoProduto = () => {
    setNovoProduto({ produtoId: "", armazem: "", quantidade: "", unidade: "t" });
  };

  const handleCreateProduto = async () => {
    const { produtoId, armazem, quantidade, unidade } = novoProduto;

    if (!produtoId || !armazem.trim() || !quantidade) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }

    const qtdNum = Number(quantidade);
    if (Number.isNaN(qtdNum) || qtdNum <= 0) {
      toast({ variant: "destructive", title: "Quantidade inválida", description: "Informe um valor maior que zero." });
      return;
    }

    // Produto Selecionado
    const produtoSelecionado = produtosCadastrados?.find(p => p.id === produtoId);
    if (!produtoSelecionado) {
      toast({ variant: "destructive", title: "Produto não encontrado", description: "Selecione um produto existente." });
      return;
    }

    // Buscar armazém ativo
    const { data: armazemData, error: errArmazem } = await supabase
      .from("armazens")
      .select("id, nome, cidade, estado")
      .eq("id", armazem)
      .eq("ativo", true)
      .maybeSingle();

    if (errArmazem) {
      toast({ variant: "destructive", title: "Erro ao buscar armazém", description: errArmazem.message });
      return;
    }
    if (!armazemData?.id) {
      toast({ variant: "destructive", title: "Armazém não encontrado ou inativo", description: "Selecione um armazém válido." });
      return;
    }

    // Buscar estoque atual
    const { data: estoqueAtual, error: errBuscaEstoque } = await supabase
      .from("estoque")
      .select("quantidade")
      .eq("produto_id", produtoId)
      .eq("armazem_id", armazemData.id)
      .maybeSingle();

    if (errBuscaEstoque) {
      toast({ variant: "destructive", title: "Erro ao buscar estoque", description: errBuscaEstoque.message });
      return;
    }

    const estoqueAnterior = estoqueAtual?.quantidade || 0;
    const novaQuantidade = estoqueAnterior + qtdNum;

    if (!produtoId || !armazemData.id) {
      toast({ variant: "destructive", title: "Produto ou armazém inválido", description: "Impossível registrar estoque. Confira os campos." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    // Upsert no estoque (cria ou atualiza)
    const { data: estoqueDataResp, error: errEstoque } = await supabase
      .from("estoque")
      .upsert({
        produto_id: produtoId,
        armazem_id: armazemData.id,
        quantidade: novaQuantidade,
        updated_by: userData.user?.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "produto_id,armazem_id"
      })
      .select();

    if (errEstoque) {
      let msg = errEstoque.message || "";
      if (msg.includes("stack depth limit")) {
        msg = "Erro interno no banco de dados. Produto ou armazém inexistente, ou existe trigger/FK inconsistente.";
      }
      toast({ variant: "destructive", title: "Erro ao atualizar estoque", description: msg });
      return;
    }

    toast({ 
      title: "Entrada registrada!", 
      description: `+${qtdNum}${unidade} de ${produtoSelecionado.nome} em ${armazemData.cidade}/${armazemData.estado}. Estoque atual: ${novaQuantidade}${unidade}` 
    });

    resetFormNovoProduto();
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["estoque"] });
  };

  // Filtros barra compacta/avançada
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StockStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);

  const allStatuses: StockStatus[] = ["normal", "baixo"];
  const allWarehouses = useMemo(() => {
    if (!armazensParaFiltro) return [];
    return armazensParaFiltro
      .filter(a => a.ativo === true)
      .map(a => a.cidade)
      .sort();
  }, [armazensParaFiltro]);

  // Filtros para renderizar o grid
  const filteredEstoque = useMemo(() => {
    const filtro = estoque.filter((item) => {
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
    console.log("[DEBUG] Estoque para renderizar:", filtro);
    return filtro;
  }, [estoque, search, selectedStatuses, selectedWarehouses, dateFrom, dateTo]);

  const showingCount = filteredEstoque.length;
  const totalCount = estoque.length;

  const activeAdvancedCount =
    (selectedStatuses.length ? 1 : 0) +
    (selectedWarehouses.length ? 1 : 0) +
    ((dateFrom || dateTo) ? 1 : 0);

  // Inline de edição
  const handleUpdateQuantity = async (id: string) => {
    const newQty = Number(editQuantity);
    if (Number.isNaN(newQty) || newQty < 0) {
      toast({ variant: "destructive", title: "Quantidade inválida", description: "Digite um valor maior ou igual a zero." });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("estoque")
        .update({ 
          quantidade: newQty,
          updated_at: new Date().toISOString(),
          updated_by: userData.user?.id,
        })
        .eq("id", id)
        .select();

      if (error) {
        toast({ variant: "destructive", title: "Erro ao atualizar estoque", description: error.message });
        return;
      }

      toast({ title: "Quantidade atualizada com sucesso!" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["estoque"] });

    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Erro inesperado ao atualizar",
        description: err instanceof Error ? err.message : String(err)
      });
      console.error("❌ [ERROR]", err);
    }
  };

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
              <Button 
                className="bg-gradient-primary" 
                disabled={!hasRole("logistica") && !hasRole("admin")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Entrada de Estoque
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Entrada de Estoque</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="space-y-2">
                  <Label htmlFor="produto">Produto *</Label>
                  <Select
                    value={novoProduto.produtoId}
                    onValueChange={id => setNovoProduto(s => ({ ...s, produtoId: id }))}
                  >
                    <SelectTrigger id="produto">
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtosCadastrados?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} ({p.unidade})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="armazem">Armazém *</Label>
                  <Select value={novoProduto.armazem} onValueChange={(v) => setNovoProduto((s) => ({ ...s, armazem: v }))}>
                    <SelectTrigger id="armazem">
                      <SelectValue placeholder="Selecione o armazém" />
                    </SelectTrigger>
                    <SelectContent>
                      {armazensAtivos?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.cidade}/{a.estado} - {a.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade a adicionar *</Label>
                    <Input 
                      id="quantidade" 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      placeholder="Ex: 20.5 (será somado ao estoque atual)"
                      value={novoProduto.quantidade} 
                      onChange={(e) => setNovoProduto((s) => ({ ...s, quantidade: e.target.value }))} 
                    />
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
                  {["normal", "baixo"].map((st) => {
                    const active = selectedStatuses.includes(st as StockStatus);
                    return (
                      <Badge
                        key={st}
                        onClick={() => setSelectedStatuses((prev) => (prev.includes(st as StockStatus) ? prev.filter((s) => s !== st) : [...prev, st as StockStatus]))}
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
                        onClick={() => setSelectedWarehouses((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]))}
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
              <Button variant="ghost" size="sm" onClick={() => {
                setSearch("");
                setSelectedStatuses([]);
                setDateFrom("");
                setDateTo("");
                setSelectedWarehouses([]);
              }} className="gap-1">
                <X className="h-4 w-4" /> Limpar Filtros
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grid de cards de estoque */}
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
                      {editingId === item.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          className="w-24 h-8"
                        />
                      ) : (
                        <>
                          <p className="text-xl font-bold text-foreground">{item.quantidade} {item.unidade}</p>
                          <p className="text-xs text-muted-foreground">Disponível</p>
                        </>
                      )}
                    </div>
                    <Badge variant={item.status === "baixo" ? "destructive" : "secondary"}>
                      {item.status === "baixo" ? "Estoque Baixo" : "Normal"}
                    </Badge>
                    {editingId === item.id ? (
                      <>
                        <Button variant="default" size="sm" onClick={() => handleUpdateQuantity(item.id)}>
                          Salvar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setEditingId(item.id);
                          setEditQuantity(item.quantidade.toString());
                        }}
                        disabled={!hasRole("logistica") && !hasRole("admin")}
                      >
                        Atualizar
                      </Button>
                    )}
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
