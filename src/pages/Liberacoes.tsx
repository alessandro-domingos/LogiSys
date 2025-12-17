import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ClipboardList, X, Filter as FilterIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StatusLib = "pendente" | "parcial" | "concluido";

interface LiberacaoItem {
  id: string;
  produto: string;
  cliente: string;
  quantidade: number;
  quantidadeRetirada: number;
  pedido: string;
  data: string;
  status: StatusLib;
  armazem?: string;
  produto_id?: string;
  armazem_id?: string;
}

const parseDate = (d: string) => {
  const [dd, mm, yyyy] = d.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

const Liberacoes = () => {
  const { hasRole, userRole, user } = useAuth();
  const canCreate = hasRole("logistica") || hasRole("admin");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentCliente } = useQuery({
    queryKey: ["current-cliente", user?.id],
    queryFn: async () => {
      if (!user || userRole !== "cliente") return null;
      const { data, error } = await supabase
        .from("clientes")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && userRole === "cliente",
  });

  const { data: currentArmazem } = useQuery({
    queryKey: ["current-armazem", user?.id],
    queryFn: async () => {
      if (!user || userRole !== "armazem") return null;
      const { data, error } = await supabase
        .from("armazens")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && userRole === "armazem",
  });

  // FILTRO AGORA DIRETAMENTE NA QUERY
  const { data: liberacoesData, isLoading, error } = useQuery({
    queryKey: ["liberacoes", currentCliente?.id, currentArmazem?.id],
    queryFn: async () => {
      let query = supabase
        .from("liberacoes")
        .select(`
          id,
          pedido_interno,
          quantidade_liberada,
          quantidade_retirada,
          status,
          data_liberacao,
          created_at,
          cliente_id,
          clientes(nome, cnpj_cpf),
          produto:produtos(id, nome),
          armazem:armazens(id, nome, cidade, estado)
        `)
        .order("created_at", { ascending: false });

      if (userRole === "cliente" && currentCliente?.id) {
        query = query.eq("cliente_id", currentCliente.id);
      }
      if (userRole === "armazem" && currentArmazem?.id) {
        query = query.eq("armazem_id", currentArmazem.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
    enabled: (userRole !== "cliente" || !!currentCliente?.id) && (userRole !== "armazem" || !!currentArmazem?.id),
  });

  const liberacoes = useMemo(() => {
    if (!liberacoesData) return [];
    return liberacoesData.map((item: any) => ({
      id: item.id,
      produto: item.produto?.nome || "N/A",
      cliente: item.clientes?.nome || "N/A",
      quantidade: item.quantidade_liberada,
      quantidadeRetirada: item.quantidade_retirada,
      pedido: item.pedido_interno,
      data: new Date(item.data_liberacao || item.created_at).toLocaleDateString("pt-BR"),
      status: item.status as StatusLib,
      armazem: item.armazem ? `${item.armazem.cidade}/${item.armazem.estado} - ${item.armazem.nome}` : "N/A",
      produto_id: item.produto?.id,
      armazem_id: item.armazem?.id,
    }));
  }, [liberacoesData]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaLiberacao, setNovaLiberacao] = useState({
    produto: "",
    armazem: "",
    cliente_id: "",
    pedido: "",
    quantidade: "",
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
  });
  const { data: armazens } = useQuery({
    queryKey: ["armazens-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado")
        .eq("ativo", true)
        .order("cidade");
      return data || [];
    },
  });
  const { data: clientesData } = useQuery({
    queryKey: ["clientes-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, cnpj_cpf")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Filtros avançados atualizados
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusLib[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedArmazens, setSelectedArmazens] = useState<string[]>([]);

  const allStatuses: StatusLib[] = ["pendente", "parcial", "concluido"];
  const allArmazens = useMemo(
    () => Array.from(new Set(liberacoes.map((l) => l.armazem).filter(Boolean))) as string[],
    [liberacoes]
  );

  const toggleStatus = (st: StatusLib) =>
    setSelectedStatuses((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  const toggleArmazem = (a: string) =>
    setSelectedArmazens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  const clearFilters = () => {
    setSearch("");
    setSelectedStatuses([]);
    setDateFrom("");
    setDateTo("");
    setSelectedArmazens([]);
  };

  const filteredLiberacoes = useMemo(() => {
    return liberacoes.filter((l) => {
      const term = search.trim().toLowerCase();
      if (term) {
        const hay = `${l.produto} ${l.cliente} ${l.pedido}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(l.status)) return false;
      if (selectedArmazens.length > 0 && l.armazem && !selectedArmazens.includes(l.armazem)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (parseDate(l.data) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (parseDate(l.data) > to) return false;
      }
      return true;
    });
  }, [liberacoes, search, selectedStatuses, selectedArmazens, dateFrom, dateTo]);

  const showingCount = filteredLiberacoes.length;
  const totalCount = liberacoes.length;
  const activeAdvancedCount =
    (selectedStatuses.length ? 1 : 0) +
    (selectedArmazens.length ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  const resetFormNovaLiberacao = () => {
    setNovaLiberacao({ produto: "", armazem: "", cliente_id: "", pedido: "", quantidade: "" });
  };

  const handleCreateLiberacao = async () => {
    const { produto, armazem, cliente_id, pedido, quantidade } = novaLiberacao;

    if (!produto || !armazem || !cliente_id || !pedido.trim() || !quantidade) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }
    const qtdNum = Number(quantidade);
    if (Number.isNaN(qtdNum) || qtdNum <= 0) {
      toast({ variant: "destructive", title: "Quantidade inválida" });
      return;
    }

    const clienteSelecionado = clientesData?.find(c => c.id === cliente_id);
    if (!clienteSelecionado) {
      toast({ variant: "destructive", title: "Cliente inválido" });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error: errLib } = await supabase
        .from("liberacoes")
        .insert({
          produto_id: produto,
          armazem_id: armazem,
          cliente_id: cliente_id,
          // Removido cliente_nome: não mais necessário/desnormalizado
          pedido_interno: pedido.trim(),
          quantidade_liberada: qtdNum,
          quantidade_retirada: 0,
          status: "pendente",
          data_liberacao: new Date().toISOString().split('T')[0],
          created_by: userData.user?.id,
        })
        .select("id")
        .single();

      if (errLib) {
        throw new Error(`Erro ao criar liberação: ${errLib.message} (${errLib.code || 'N/A'})`);
      }

      toast({
        title: "Liberação criada com sucesso!",
        description: `Pedido ${pedido} para ${clienteSelecionado.nome} - ${qtdNum}t`
      });

      resetFormNovaLiberacao();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["liberacoes", currentCliente?.id, currentArmazem?.id] });

    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Erro ao criar liberação",
        description: err instanceof Error ? err.message : "Erro desconhecido"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Liberações de Produtos" description="Carregando..." actions={<></>} />
        <div className="container mx-auto px-6 py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando liberações...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Liberações de Produtos" description="Erro ao carregar dados" actions={<></>} />
        <div className="container mx-auto px-6 py-8 text-center">
          <p className="text-destructive">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Liberações de Produtos"
        description="Gerencie as liberações de produtos para clientes"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary" disabled={!canCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Liberação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova Liberação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="produto">Produto *</Label>
                  <Select value={novaLiberacao.produto} onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, produto: v }))}>
                    <SelectTrigger id="produto">
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="armazem">Armazém *</Label>
                  <Select value={novaLiberacao.armazem} onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, armazem: v }))}>
                    <SelectTrigger id="armazem">
                      <SelectValue placeholder="Selecione o armazém" />
                    </SelectTrigger>
                    <SelectContent>
                      {armazens?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.cidade}{a.estado ? "/" + a.estado : ""} - {a.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Select value={novaLiberacao.cliente_id} onValueChange={(v) => setNovaLiberacao((s) => ({ ...s, cliente_id: v }))}>
                    <SelectTrigger id="cliente">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientesData?.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome} - {cliente.cnpj_cpf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pedido">Número do Pedido *</Label>
                  <Input
                    id="pedido"
                    value={novaLiberacao.pedido}
                    onChange={(e) => setNovaLiberacao((s) => ({ ...s, pedido: e.target.value }))}
                    placeholder="Ex: PED-2024-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade (t) *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    step="0.01"
                    min="0"
                    value={novaLiberacao.quantidade}
                    onChange={(e) => setNovaLiberacao((s) => ({ ...s, quantidade: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-gradient-primary" onClick={handleCreateLiberacao}>Criar Liberação</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="container mx-auto px-6 pt-3">
        <div className="flex items-center gap-3">
          <Input className="h-9 flex-1" placeholder="Buscar por produto, cliente ou pedido..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <div className="rounded-md border p-3 space-y-6 relative">
            <div>
              <Label className="text-sm font-semibold mb-1">Status</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {allStatuses.map((st) => {
                  const active = selectedStatuses.includes(st);
                  const label = st === "pendente" ? "Pendente" : st === "parcial" ? "Parcial" : "Concluído";
                  return (
                    <Badge key={st} onClick={() => toggleStatus(st)} className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-muted-foreground"}`}>
                      {label}
                    </Badge>
                  );
                })}
              </div>
            </div>
            {allArmazens.length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-1">Armazém</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {allArmazens.map((a) => {
                    const active = selectedArmazens.includes(a);
                    return (
                      <Badge key={a} onClick={() => toggleArmazem(a)} className={`cursor-pointer text-xs px-2 py-1 ${active ? "bg-gradient-primary text-white" : "bg-muted text-muted-foreground"}`}>
                        {a}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center gap-4">
              <Label className="text-sm font-semibold mb-1">Período</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[160px]" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[160px]" />
              <div className="flex-1"></div>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1"><X className="h-4 w-4" /> Limpar Filtros</Button>
            </div>
          </div>
        </div>
      )}
      <div className="container mx-auto px-6 py-6">
        <div className="grid gap-4">
          {filteredLiberacoes.map((lib) => (
            <Card key={lib.id} className="transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* badge ícone à esquerda com cor do Estoque */}
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                      <ClipboardList className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{lib.produto}</h3>
                      <p className="text-sm text-muted-foreground">{lib.cliente}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Pedido: <span className="font-medium text-foreground">{lib.pedido}</span></p>
                      <p className="text-xs text-muted-foreground">Data: {lib.data} {lib.armazem && <>• {lib.armazem}</>}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Liberada: {lib.quantidade} • Retirada: {lib.quantidadeRetirada}</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      lib.status === "concluido" ? "default" :
                        lib.status === "parcial" ? "secondary" :
                          "outline"
                    }
                  >
                    {lib.status === "concluido" ? "Concluído" : lib.status === "parcial" ? "Parcial" : "Pendente"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredLiberacoes.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma liberação encontrada.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Liberacoes;
