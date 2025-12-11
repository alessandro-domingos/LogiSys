import { useState, useMemo } from "react";
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
import { Plus, Package, X, Filter as FilterIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type StockStatus = "normal" | "baixo";
type Unidade = "t" | "kg";

interface ProdutoEstoque {
  id: string;
  produto: string;
  quantidade: number;
  unidade: string;
  status: StockStatus;
  data: string;
  produto_id?: string;
  ativo?: boolean;
}

interface ArmazemEstoque {
  id: string;
  nome: string;
  cidade: string;
  estado?: string;
  produtos: ProdutoEstoque[];
  capacidade_total?: number;
  ativo?: boolean;
}

interface SupabaseEstoqueItem {
  id: string;
  quantidade: number;
  updated_at: string;
  produto: {
    id: string;
    nome: string;
    unidade: string;
    ativo?: boolean;
  } | null;
  armazem: {
    id: string;
    nome: string;
    cidade: string;
    estado?: string;
    capacidade_total?: number;
    ativo?: boolean;
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

  const { data: estoqueData, isLoading, error } = useQuery({
    queryKey: ["estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque")
        .select(`
          id,
          quantidade,
          updated_at,
          produto:produtos(id, nome, unidade, ativo),
          armazem:armazens(id, nome, cidade, estado, capacidade_total, ativo)
        `)
        .order("updated_at", { ascending: false });
      if (error) {
        toast({ variant: "destructive", title: "Erro ao buscar estoque", description: error.message });
        throw error;
      }
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: produtosCadastrados } = useQuery({
    queryKey: ["produtos-cadastrados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, unidade, ativo")
        .order("nome");
      if (error) {
        toast({ variant: "destructive", title: "Erro ao buscar produtos", description: error.message });
        return [];
      }
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: armazensAtivos } = useQuery({
    queryKey: ["armazens-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado, capacidade_total, ativo")
        .eq("ativo", true)
        .order("cidade");
      if (error) {
        toast({ variant: "destructive", title: "Erro ao buscar armazéns", description: error.message });
        return [];
      }
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: armazensParaFiltro } = useQuery({
    queryKey: ["armazens-filtro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado, ativo")
        .eq("ativo", true)
        .order("cidade");
      if (error) {
        toast({ variant: "destructive", title: "Erro ao buscar armazéns para filtro", description: error.message });
        return [];
      }
      return data || [];
    },
    refetchInterval: 10000,
  });

  const estoquePorArmazem: ArmazemEstoque[] = useMemo(() => {
    if (!estoqueData) return [];
    const map: { [armazemId: string]: ArmazemEstoque } = {};
    for (const item of estoqueData as SupabaseEstoqueItem[]) {
      if (!item.armazem || !item.armazem.id || !item.armazem.ativo) continue;
      if (!item.produto || !item.produto.ativo) continue;
      const armazemId = item.armazem.id;
      if (!map[armazemId]) {
        map[armazemId] = {
          id: armazemId,
          nome: item.armazem.nome,
          cidade: item.armazem.cidade,
          estado: item.armazem.estado,
          capacidade_total: item.armazem.capacidade_total,
          ativo: item.armazem.ativo,
          produtos: [],
        };
      }
      map[armazemId].produtos.push({
        id: item.id,
        produto: item.produto?.nome || "N/A",
        quantidade: item.quantidade,
        unidade: item.produto?.unidade || "t",
        status: item.quantidade < 10 ? "baixo" : "normal",
        data: new Date(item.updated_at).toLocaleDateString("pt-BR"),
        produto_id: item.produto?.id,
        ativo: item.produto?.ativo,
      });
    }
    return Object.values(map).sort((a, b) => {
      if (a.nome === b.nome) return a.cidade.localeCompare(b.cidade);
      return a.nome.localeCompare(b.nome);
    });
  }, [estoqueData]);

  const produtosUnicos = useMemo(() => {
    const set = new Set<string>();
    estoquePorArmazem.forEach(armazem =>
      armazem.produtos.forEach(produto => set.add(produto.produto))
    );
    return Array.from(set).sort();
  }, [estoquePorArmazem]);
  const armazensUnicos = useMemo(() => {
    return estoquePorArmazem.map(a => ({
      id: a.id,
      nome: a.nome,
      cidade: a.cidade,
      estado: a.estado
    }));
  }, [estoquePorArmazem]);

  const [openArmazemId, setOpenArmazemId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProdutos, setSelectedProdutos] = useState<string[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");

  const [selectedStatuses, setSelectedStatuses] = useState<StockStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredArmazens = useMemo(() => {
    return estoquePorArmazem
      .filter((armazem) => {
        if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(armazem.id)) return false;
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          if (
            !(
              armazem.nome.toLowerCase().includes(term) ||
              armazem.cidade.toLowerCase().includes(term) ||
              armazem.produtos.some(prod => prod.produto.toLowerCase().includes(term))
            )
          ) {
            return false;
          }
        }
        if (selectedProdutos.length > 0) {
          return armazem.produtos.some((prod) => selectedProdutos.includes(prod.produto));
        }
        return true;
      })
      .map((armazem) => {
        let produtos = armazem.produtos;
        if (selectedStatuses.length > 0) {
          produtos = produtos.filter((p) => selectedStatuses.includes(p.status));
        }
        if (dateFrom) {
          const from = new Date(dateFrom);
          produtos = produtos.filter((p) => parseDate(p.data) >= from);
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          produtos = produtos.filter((p) => parseDate(p.data) <= to);
        }
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          produtos = produtos.filter(
            p => p.produto.toLowerCase().includes(term) ||
              armazem.nome.toLowerCase().includes(term) ||
              armazem.cidade.toLowerCase().includes(term)
          );
        }
        if (selectedProdutos.length > 0) {
          produtos = produtos.filter(prod => selectedProdutos.includes(prod.produto));
        }
        return { ...armazem, produtos };
      });
  }, [estoquePorArmazem, search, selectedProdutos, selectedWarehouses, selectedStatuses, dateFrom, dateTo]);

  const handleUpdateQuantity = async (produtoId: string, newQtyStr: string) => {
    const newQty = Number(newQtyStr);
    if (Number.isNaN(newQty) || newQty < 0 || newQtyStr.trim() === "" || !/^\d+(\.\d+)?$/.test(newQtyStr)) {
      toast({ variant: "destructive", title: "Valor inválido", description: "Digite um valor numérico maior ou igual a zero." });
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("estoque")
        .update({
          quantidade: newQty,
          updated_at: new Date().toISOString(),
          updated_by: userData.user?.id,
        })
        .eq("id", produtoId);

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

  const showingCount = filteredArmazens.reduce((acc, armazem) => acc + armazem.produtos.length, 0);
  const totalCount = estoquePorArmazem.reduce((acc, armazem) => acc + armazem.produtos.length, 0);

  const activeAdvancedCount =
    (selectedProdutos.length ? 1 : 0) +
    (selectedWarehouses.length ? 1 : 0) +
    (selectedStatuses.length ? 1 : 0) +
    ((dateFrom || dateTo) ? 1 : 0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({
    produtoId: "",
    armazem: "",
    quantidade: "",
    unidade: "t" as Unidade,
  });

  const resetFormNovoProduto = () =>
    setNovoProduto({ produtoId: "", armazem: "", quantidade: "", unidade: "t" });

  const handleCreateProduto = async () => {
    const { produtoId, armazem, quantidade, unidade } = novoProduto;
    const qtdNum = Number(quantidade);

    if (!produtoId || !armazem.trim() || !quantidade) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }
    if (
      Number.isNaN(qtdNum) ||
      qtdNum <= 0 ||
      quantidade.trim() === "" ||
      !/^\d+(\.\d+)?$/.test(quantidade)
    ) {
      toast({ variant: "destructive", title: "Valor inválido", description: "Digite um valor numérico maior que zero." });
      return;
    }
    const produtoSelecionado = produtosCadastrados?.find(p => p.id === produtoId && p.ativo);
    if (!produtoSelecionado) {
      toast({ variant: "destructive", title: "Produto não encontrado ou inativo", description: "Selecione um produto ativo." });
      return;
    }
    const { data: armazemData, error: errArmazem } = await supabase
      .from("armazens")
      .select("id, nome, cidade, estado, capacidade_total, ativo")
      .eq("id", armazem)
      .eq("ativo", true)
      .maybeSingle();
    if (errArmazem) {
      toast({ variant: "destructive", title: "Erro ao buscar armazém", description: errArmazem.message });
      return;
    }
    if (!armazemData?.id) {
      toast({ variant: "destructive", title: "Armazém não encontrado ou inativo", description: "Selecione um armazém ativo válido." });
      return;
    }
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
    const { error: errEstoque } = await supabase
      .from("estoque")
      .upsert({
        produto_id: produtoId,
        armazem_id: armazemData.id,
        quantidade: novaQuantidade,
        updated_by: userData.user?.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "produto_id,armazem_id"
      });

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
                      <SelectValue placeholder="Selecione o produto ativo" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtosCadastrados
                        ?.filter((p) => p.ativo)
                        .map((p) => (
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
                      <SelectValue placeholder="Selecione o armazém ativo" />
                    </SelectTrigger>
                    <SelectContent>
                      {armazensAtivos?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nome} — {a.cidade}{a.estado ? `/${a.estado}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade a adicionar *</Label>
                    {/* Aumentado o tamanho do campo para 80+px */}
                    <Input
                      id="quantidade"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 20500.50"
                      value={novoProduto.quantidade}
                      onChange={(e) => setNovoProduto((s) => ({ ...s, quantidade: e.target.value }))}
                      style={{ width: "120px", maxWidth: "100%" }}
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

      <div className="container mx-auto px-6 pt-3">
        <div className="flex items-center gap-3">
          <Input
            className="h-9 flex-1"
            placeholder="Buscar por armazém ou produto..."
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

      {filtersOpen && (
        <div className="container mx-auto px-6 pt-2">
          <div className="rounded-md border p-3 space-y-2 relative">
            <div>
              <Label className="text-sm mb-1">Produtos</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {produtosUnicos.map((p) => (
                  <Badge
                    key={p}
                    onClick={() => setSelectedProdutos((prev) =>
                      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                    )}
                    className={`cursor-pointer text-xs px-2 py-1 ${selectedProdutos.includes(p) ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-sm mb-1">Armazéns</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {armazensUnicos.map((a) => (
                  <Badge
                    key={a.id}
                    onClick={() => setSelectedWarehouses((prev) =>
                      prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                    )}
                    className={`cursor-pointer text-xs px-2 py-1 ${selectedWarehouses.includes(a.id) ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                  >
                    {a.nome} — {a.cidade}{a.estado ? `/${a.estado}` : ""}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-sm mb-1">Status de estoque</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {["normal", "baixo"].map((st) => {
                  const active = selectedStatuses.includes(st as StockStatus);
                  return (
                    <Badge
                      key={st}
                      onClick={() => setSelectedStatuses((prev) => (
                        prev.includes(st as StockStatus)
                          ? prev.filter(s => s !== st)
                          : [...prev, st as StockStatus]
                      ))}
                      className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      {st === "normal" ? "Normal" : "Baixo"}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex gap-4 items-center">
              <Label>Período</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[160px]" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[160px]" />
            </div>
            <div className="flex justify-end mt-4 absolute right-4 bottom-4">
              <Button variant="ghost" size="sm" onClick={() => {
                setSearch("");
                setSelectedProdutos([]);
                setSelectedWarehouses([]);
                setSelectedStatuses([]);
                setDateFrom("");
                setDateTo("");
              }}>
                <X className="h-4 w-4" /> Limpar Filtros
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 py-6 flex flex-col gap-4">
        {filteredArmazens.map((armazem) => (
          <div key={armazem.id}>
            <Card
              className={`w-full transition-all hover:shadow-md cursor-pointer flex flex-col ${openArmazemId === armazem.id ? "border-primary" : ""}`}
            >
              <CardContent
                className="px-5 py-3 flex flex-row items-center"
                onClick={() =>
                  setOpenArmazemId(openArmazemId === armazem.id ? null : armazem.id)
                }
                style={{ cursor: "pointer" }}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary mr-4 shrink-0">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{armazem.nome}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {armazem.cidade}{armazem.estado ? `/${armazem.estado}` : ""}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {armazem.produtos.length} produto{armazem.produtos.length !== 1 && 's'} atualmente
                  </span>
                  {armazem.capacidade_total != null && (
                    <div className="text-xs text-muted-foreground">Capacidade: {armazem.capacidade_total}t</div>
                  )}
                </div>
                <Button variant="ghost" size="icon" tabIndex={-1} className="pointer-events-none ml-4">
                  {openArmazemId === armazem.id ? <ChevronUp /> : <ChevronDown />}
                </Button>
              </CardContent>
              {openArmazemId === armazem.id && (
                <div className="border-t py-3 px-5 bg-muted/50 flex flex-col gap-3">
                  {armazem.produtos.length > 0 ? (
                    armazem.produtos.map((produto) => (
                      <Card key={produto.id} className="w-full flex flex-row items-center bg-muted/30 px-3 py-2" style={{ minHeight: 56 }}>
                        <CardContent className="w-full py-2 flex flex-row items-center justify-between gap-4">
                          <div>
                            <span className="font-medium">{produto.produto}</span>
                            <span className="ml-2 font-mono text-xs">{produto.quantidade} {produto.unidade}</span>
                            <div className="flex gap-2 text-xs text-muted-foreground items-center">
                              <span>{produto.data}</span>
                              <Badge variant={produto.status === "baixo" ? "destructive" : "secondary"}>
                                {produto.status === "baixo" ? "Baixo" : "Normal"}
                              </Badge>
                            </div>
                          </div>
                          {editingId === produto.id ? (
                            <div className="flex gap-1 ml-auto">
                              <Input
                                type="number"
                                step="0.01"
                                size="sm"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                style={{ width: "110px", minWidth: "100px" }}
                                className="h-8"
                                onClick={e => e.stopPropagation()}
                              />
                              <Button
                                variant="default"
                                size="sm"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleUpdateQuantity(produto.id, editQuantity);
                                }}
                              >
                                Salvar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={e => {
                                  e.stopPropagation();
                                  setEditingId(null);
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={e => {
                                e.stopPropagation();
                                setEditingId(produto.id);
                                setEditQuantity(produto.quantidade.toString());
                              }}
                              disabled={!hasRole("logistica") && !hasRole("admin")}
                              className="ml-auto"
                            >
                              Atualizar quantidade
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center text-xs text-muted-foreground py-6">
                      Nenhum produto ativo cadastrado neste armazém
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        ))}
        {filteredArmazens.length === 0 && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhum armazém encontrado com os filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
};

export default Estoque;
