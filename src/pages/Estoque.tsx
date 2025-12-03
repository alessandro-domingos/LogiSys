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
          produto:produtos(id, nome, unidade),
          armazem:armazens(id, nome, cidade)
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

  // 👇 Produtos para o combobox do modal entrada
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

  const estoque = useMemo(() => {
    if (!estoqueData) return [];
    return estoqueData.map((item: SupabaseEstoqueItem) => ({
      id: item.id,
      produto: item.produto?.nome || "N/A",
      armazem: item.armazem?.cidade || item.armazem?.nome || "N/A",
      quantidade: item.quantidade,
      unidade: item.produto?.unidade || "t",
      status: item.quantidade < 10 ? "baixo" : "normal",
      data: new Date(item.updated_at).toLocaleDateString("pt-BR"),
      produto_id: item.produto?.id,
      armazem_id: item.armazem?.id,
    }));
  }, [estoqueData]);

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

  // Dialog "Entrada de Estoque"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({
    produtoId: "",
    armazem: "",
    quantidade: "",
    unidade: "t" as Unidade,
  });

  // Estado para edição inline
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

    // 1. Buscar produto
    const produtoSelecionado = produtosCadastrados?.find(p => p.id === produtoId);
    if (!produtoSelecionado) {
      toast({ variant: "destructive", title: "Produto não encontrado", description: "Selecione um produto existente." });
      return;
    }

    // 2. Buscar armazém ativo
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

    // 3. Buscar estoque atual
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

    // Verificação final antes do upsert
    if (!produtoId || !armazemData.id) {
      toast({ variant: "destructive", title: "Produto ou armazém inválido", description: "Impossível registrar estoque. Confira os campos." });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    // 4. Upsert no estoque (cria ou atualiza)
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

  // ... resto do código permanece igual ...

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
      {/* ... resto do componente permanece igual ... */}
    </div>
  );
};

export default Estoque;
