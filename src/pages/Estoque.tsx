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

  // Definir o texto do header conforme perfil
  let descricao = "Veja o estoque de produtos por armazém.";
  if (hasRole("logistica") || hasRole("admin")) {
    descricao = "Gerencie o estoque dos produtos em cada armazém do sistema";
  } else if (hasRole("armazem")) {
    descricao = "Consulte o estoque disponível de cada produto no seu armazém";
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Controle de Estoque"
        description={descricao}
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
      {/* O resto do componente continua igual à sua implementação atual */}
      {/* ...filtros avançados, renderização dos cards, etc... */}
    </div>
  );
};

export default Estoque;
