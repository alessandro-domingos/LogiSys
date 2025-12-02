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
  const { canAccess, loading: permissionsLoading } = usePermissions();

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

  // -- Permissão: espera para carregar antes de qualquer coisa
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

  // -- Permissão: acesso negado
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
        </div>
      </div>
    );
  }

  const fetchProdutos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .order("nome", { ascending: true });
      if (error) {
        setError(error.message);
        toast({
          variant: "destructive",
          title: "Erro ao carregar produtos",
          description: "Não foi possível carregar a lista de produtos.",
        });
        setLoading(false);
        return;
      }
      setProdutos(data || []);
      setLoading(false);
    } catch (err) {
      setError("Erro desconhecido");
      toast({
        variant: "destructive",
        title: "Erro ao carregar produtos",
        description: "Não foi possível carregar os produtos.",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------ Criação de produto ------------
  const handleCreateProduto = async () => {
    const { nome, unidade } = novoProduto;
    if (!nome.trim() || !unidade) {
      toast({ variant: "destructive", title: "Preencha os campos obrigatórios" });
      return;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        toast({
          variant: "destructive",
          title: "Erro de configuração",
          description: "Variáveis de ambiente do Supabase não configuradas.",
        });
        return;
      }

      // Verifica se já existe pelo nome (case-insensitive)
      const { data: produtoExistente, error: buscaErr } = await supabase
        .from("produtos")
        .select("id")
        .ilike("nome", nome.trim())
        .maybeSingle();

      if (buscaErr) {
        toast({ variant: "destructive", title: "Erro ao buscar produto", description: buscaErr.message });
        return;
      }

      if (produtoExistente) {
        toast({
          variant: "destructive",
          title: "Produto já existe",
          description: "Já existe um produto com este nome.",
        });
        return;
      }

      // Cria produto
      const { error: insertErr } = await supabase
        .from("produtos")
        .insert({
          nome: nome.trim(),
          unidade,
        });
      if (insertErr) {
        toast({ variant: "destructive", title: "Erro ao criar produto", description: insertErr.message });
        return;
      }
      toast({ title: "Produto criado com sucesso!" });
      setDialogOpen(false);
      setNovoProduto({ nome: "", unidade: "" });
      fetchProdutos();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao criar produto",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // ----------- Filtro de Busca -----------
  const filteredProdutos = useMemo(() => {
    if (!produtos) return [];
    if (!searchTerm.trim()) return produtos;
    const term = searchTerm.trim().toLowerCase();
    return produtos.filter((prod) =>
      prod.nome.toLowerCase().includes(term)
    );
  }, [produtos, searchTerm]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar produtos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* HEADER */}
      <PageHeader
        title="Produtos"
        subtitle="Gerencie os produtos cadastrados no sistema"
        icon={Tag}
        actions={
          canAccess("produtos", "create") && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Produto</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do produto para cadastrar no sistema.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={novoProduto.nome}
                      onChange={(e) => setNovoProduto({ ...novoProduto, nome: e.target.value })}
                      placeholder="Nome do produto"
                    />
                  </div>
                  <div>
                    <Label htmlFor="unidade">Unidade *</Label>
                    <Select
                      value={novoProduto.unidade}
                      onValueChange={(value) => setNovoProduto({ ...novoProduto, unidade: value as Unidade })}
                    >
                      <SelectTrigger id="unidade">
                        <SelectValue placeholder="Selecione a unidade do produto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="t">{unidadeLabels.t}</SelectItem>
                        <SelectItem value="kg">{unidadeLabels.kg}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    * Campos obrigatórios.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button className="bg-gradient-primary" onClick={handleCreateProduto}>
                    Criar Produto
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {/* FILTRO BUSCA */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <Input
            placeholder="Buscar por nome do produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
      </div>

      {/* Modal de detalhes do produto */}
      <Dialog open={!!detalhesProduto} onOpenChange={open => !open && setDetalhesProduto(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detalhesProduto?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p><b>Nome:</b> {detalhesProduto?.nome}</p>
            <p><b>Unidade:</b> {unidadeLabels[detalhesProduto?.unidade ?? ""] || detalhesProduto?.unidade || <span>—</span>}</p>
            <p><b>ID:</b> {detalhesProduto?.id}</p>
            <p><b>Criado em:</b> {detalhesProduto?.created_at ? new Date(detalhesProduto.created_at).toLocaleString("pt-BR") : "—"}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setDetalhesProduto(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LISTA DE PRODUTOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProdutos.map((produto) => (
          <Card
            key={produto.id}
            className="cursor-pointer transition-all"
            onClick={() => setDetalhesProduto(produto)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{produto.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    {unidadeLabels[produto.unidade] || produto.unidade}
                  </p>
                </div>
                <Badge variant="secondary">
                  Produto
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredProdutos.length === 0 && (
          <div className="text-center py-12 w-full col-span-full">
            <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchTerm
                ? "Nenhum produto encontrado na busca."
                : "Nenhum produto cadastrado ainda."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Produtos;
