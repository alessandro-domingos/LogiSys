import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { usePermissions } from "@/hooks/usePermissions";

type Unidade = "t" | "kg" | "";

const unidadeLabels: Record<string, string> = {
  t: "Toneladas (t)",
  kg: "Quilos (kg)",
};

type Produto = Database['public']['Tables']['produtos']['Row'];

const Produtos = () => {
  const { toast } = useToast();
  const { canAccess, loading: permissionsLoading, userRole } = usePermissions();

  // Permissões de CRUD
  const canCreate = canAccess("produtos", "create");
  const canUpdate = canAccess("produtos", "update");
  const canDelete = canAccess("produtos", "delete");

  // Dados
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Novo Produto Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoProduto, setNovoProduto] = useState({
    nome: "",
    unidade: "" as Unidade,
  });

  const [detalhesProduto, setDetalhesProduto] = useState<Produto | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch produtos
  async function fetchProdutos() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from("produtos").select("*").order("nome", { ascending: true });
    if (error) {
      setError("Erro ao carregar produtos");
      setProdutos([]);
    } else {
      setProdutos(data || []);
    }
    setLoading(false);
  }
  useEffect(() => {
    if (canAccess("produtos", "read")) fetchProdutos();
    // eslint-disable-next-line
  }, [canAccess]);

  // Criar produto
  async function handleCriarProduto() {
    if (!novoProduto.nome || !novoProduto.unidade) {
      toast({ variant: "destructive", title: "Preencha os campos obrigatórios!" });
      return;
    }
    const { error } = await supabase.from("produtos").insert([{ nome: novoProduto.nome, unidade: novoProduto.unidade }]);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao criar produto", description: error.message });
    } else {
      toast({ title: "Produto criado com sucesso!" });
      setDialogOpen(false);
      setNovoProduto({ nome: "", unidade: "" });
      fetchProdutos();
    }
  }

  // Filtro de busca
  const filteredProdutos = useMemo(() => {
    return produtos.filter((p) =>
      p.nome.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );
  }, [produtos, searchTerm]);

  // Permissão: loading
  if (permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando permissões...</p>
        </div>
      </div>
    );
  }

  // Permissão: acesso negado
  if (!canAccess("produtos", "read")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-semibold text-lg">
            Acesso negado
          </p>
          <p className="text-muted-foreground mt-2">
            Você não tem permissão para acessar esta página.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            <b>Debug:</b> userRole: {userRole ? userRole.toString() : "indefinido"}, canAccess: {canAccess("produtos", "read").toString()}, permissionsLoading: {String(permissionsLoading)}
          </p>
        </div>
      </div>
    );
  }

  // Loading produtos
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando produtos...</p>
      </div>
    );
  }
  // Erro ao carregar
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }
  // Nenhum produto cadastrado
  if (produtos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <PageHeader title="Produtos" icon={Tag} />
        <p className="text-muted-foreground mt-4">Nenhum produto cadastrado.</p>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Produto</DialogTitle>
                <DialogDescription>Preencha os dados abaixo:</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={novoProduto.nome} onChange={e => setNovoProduto(p => ({ ...p, nome: e.target.value }))} autoFocus />
                <Label htmlFor="unidade">Unidade</Label>
                <Select value={novoProduto.unidade} onValueChange={unidade => setNovoProduto(p => ({ ...p, unidade: unidade as Unidade }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="t">{unidadeLabels.t}</SelectItem>
                    <SelectItem value="kg">{unidadeLabels.kg}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button onClick={handleCriarProduto}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Produtos" icon={Tag} />

      <div className="flex items-center mb-6 gap-2">
        <Input
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Produto</DialogTitle>
                <DialogDescription>Preencha os dados abaixo:</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={novoProduto.nome} onChange={e => setNovoProduto(p => ({ ...p, nome: e.target.value }))} autoFocus />
                <Label htmlFor="unidade">Unidade</Label>
                <Select value={novoProduto.unidade} onValueChange={unidade => setNovoProduto(p => ({ ...p, unidade: unidade as Unidade }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="t">{unidadeLabels.t}</SelectItem>
                    <SelectItem value="kg">{unidadeLabels.kg}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button onClick={handleCriarProduto}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProdutos.map(produto => (
          <Card key={produto.id}>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag size={18} />
                <span className="font-semibold text-lg">{produto.nome}</span>
                {produto.ativo && <Badge>Ativo</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">Unidade: {unidadeLabels[produto.unidade] || produto.unidade}</div>
              <div className="text-xs text-zinc-500 mt-2">
                Criado em: {produto.created_at ? new Date(produto.created_at).toLocaleString() : "-"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Produtos;
