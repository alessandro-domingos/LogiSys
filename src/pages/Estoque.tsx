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

interface ProdutoEstoque {
  id: string;
  produto: string;
  quantidade: number;
  unidade: string;
  status: StockStatus;
  data: string;
  produto_id?: string;
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
          armazem:armazens(id, nome, cidade, estado, capacidade_total, ativo)
        `)
        .order("updated_at", { ascending: false });
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
        .select("id, nome, cidade, estado, capacidade_total, ativo")
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

  // Agrupa o estoque por armazém
  const estoquePorArmazem: ArmazemEstoque[] = useMemo(() => {
    if (!estoqueData) return [];
    const map: { [armazemId: string]: ArmazemEstoque } = {};
    for (const item of estoqueData as SupabaseEstoqueItem[]) {
      if (!item.armazem || !item.armazem.id) continue;
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
      });
    }
    return Object.values(map).sort((a, b) => {
      if (a.cidade === b.cidade) return a.nome.localeCompare(b.nome);
      return a.cidade.localeCompare(b.cidade);
    });
  }, [estoqueData]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({
    produtoId: "",
    armazem: "",
    quantidade: "",
    unidade: "t" as Unidade,
  });

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
    const produtoSelecionado = produtosCadastrados?.find(p => p.id === produtoId);
    if (!produtoSelecionado) {
      toast({ variant: "destructive", title: "Produto não encontrado", description: "Selecione um produto existente." });
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
      toast({ variant: "destructive", title: "Armazém não encontrado ou inativo", description: "Selecione um armazém válido." });
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

  const filteredArmazens = useMemo(() => {
    return estoquePorArmazem.filter((armazem) => {
      if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(armazem.cidade)) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const hay = `${armazem.nome} ${armazem.cidade}/${armazem.estado}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    }).map((armazem) => {
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
          p => p.produto.toLowerCase().includes(term)
        );
      }
      return { ...armazem, produtos };
    });
  }, [estoquePorArmazem, search, selectedStatuses, selectedWarehouses, dateFrom, dateTo]);

  const [openArmazemId, setOpenArmazemId] = useState<string | null>(null);

  const handleUpdateQuantity = async (produtoId: string, newQtyStr: string) => {
    const newQty = Number(newQtyStr);
    if (Number.isNaN(newQty) || newQty < 0) {
      toast({ variant: "destructive", title: "Quantidade inválida", description: "Digite um valor maior ou igual a zero." });
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

  const showingCount = filteredArmazens.reduce((acc, armazem) => acc + armazem.produtos.length, 0);
  const totalCount = estoquePorArmazem.reduce((acc, armazem) => acc + armazem.produtos.length, 0);

  const activeAdvancedCount =
    (selectedStatuses.length ? 1 : 0) +
    (selectedWarehouses.length ? 1 : 0) +
    ((dateFrom || dateTo) ? 1 : 0);

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

      {/* Barra compacta: busca, contador, toggle */}
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

      {/* Área avançada colapsável */}
      {filtersOpen && (
        <div className="container mx-auto px-6 pt-2">
          <div className="rounded-md border p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* ...mesmo bloco de filtros avançados do original */}
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

      {/* Card horizontal para armazéns + expandir + cards horizontais para produtos */}
      <div className="container mx-auto px-6 py-6 flex flex-col gap-4">
        {filteredArmazens.map((armazem) => (
          <div key={armazem.id} className="">
            <Card
              className={`w-full transition-all shadow hover:shadow-md cursor-pointer flex flex-col ${openArmazemId === armazem.id ? "border-primary" : ""}`}
              onClick={() =>
                setOpenArmazemId(openArmazemId === armazem.id ? null : armazem.id)
              }
            >
              <CardContent className="px-5 py-3 flex flex-row items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{armazem.nome}</h3>
                  <p className="text-xs text-muted-foreground">
                    {armazem.cidade}/{armazem.estado}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {armazem.produtos.length} produto{armazem.produtos.length !== 1 && 's'} atualmente
                  </span>
                  {armazem.capacidade_total != null && (
                    <div className="text-xs text-muted-foreground">Capacidade: {armazem.capacidade_total}t</div>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant={armazem.ativo ? "default" : "secondary"}>
                    {armazem.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button variant="ghost" size="icon" tabIndex={-1} className="pointer-events-none">
                    {openArmazemId === armazem.id ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </div>
              </CardContent>
              {/* Produtos horizontal abaixo */}
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
                          {/* Edição inline da quantidade */}
                          {editingId === produto.id ? (
                            <div className="flex gap-1 ml-auto">
                              <Input
                                type="number"
                                step="0.01"
                                size="sm"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                className="h-8 w-20"
                              />
                              <Button variant="default" size="sm" onClick={() => handleUpdateQuantity(produto.id, editQuantity)}>
                                Salvar
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={(e) => {
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
                      Nenhum produto cadastrado neste armazém
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
