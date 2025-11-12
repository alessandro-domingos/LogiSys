import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Warehouse, Plus, Filter as FilterIcon } from "lucide-react";

const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

interface Armazem {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  ativo: boolean;
  created_at: string;
}

const Armazens = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  const { data: armazensData, isLoading, error } = useQuery({
    queryKey: ["armazens"],
    queryFn: async () => {
      console.log("🔍 [DEBUG] Buscando armazéns...");
      const { data, error } = await supabase
        .from("armazens")
        .select("id, nome, cidade, estado, ativo, created_at")
        .order("cidade", { ascending: true });
      
      if (error) {
        console.error("❌ [ERROR] Erro ao buscar armazéns:", error);
        throw error;
      }
      console.log("✅ [DEBUG] Armazéns carregados:", data?.length);
      return data as Armazem[];
    },
    refetchInterval: 30000,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoArmazem, setNovoArmazem] = useState({
    nome: "",
    cidade: "",
    estado: "",
  });

  const [filterStatus, setFilterStatus] = useState<"all" | "ativo" | "inativo">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const resetForm = () => {
    setNovoArmazem({ nome: "", cidade: "", estado: "" });
  };

  const handleCreateArmazem = async () => {
    const { nome, cidade, estado } = novoArmazem;

    if (!nome.trim() || !cidade.trim() || !estado) {
      toast({ variant: "destructive", title: "Preencha todos os campos" });
      return;
    }

    try {
      console.log("🔍 [DEBUG] Criando armazém:", { nome, cidade, estado });

      const { data, error } = await supabase
        .from("armazens")
        .insert({ nome: nome.trim(), cidade: cidade.trim(), estado, ativo: true })
        .select()
        .single();

      if (error) {
        console.error("❌ [ERROR] Erro ao criar armazém:", error);
        throw new Error(`${error.message} (${error.code || 'N/A'})`);
      }

      console.log("✅ [SUCCESS] Armazém criado:", data);

      toast({ title: "Armazém criado com sucesso!" });
      resetForm();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["armazens-filtro"] });
      queryClient.invalidateQueries({ queryKey: ["armazens-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["armazens"] });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Erro ao criar armazém",
        description: err instanceof Error ? err.message : "Erro desconhecido"
      });
    }
  };

  const handleToggleAtivo = async (id: string, currentStatus: boolean) => {
    try {
      console.log("🔍 [DEBUG] Alterando status do armazém:", id, "para:", !currentStatus);

      const { error } = await supabase
        .from("armazens")
        .update({ ativo: !currentStatus })
        .eq("id", id);

      if (error) {
        console.error("❌ [ERROR] Erro ao atualizar armazém:", error);
        throw error;
      }

      console.log("✅ [SUCCESS] Status do armazém atualizado");
      toast({ title: "Status atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["armazens-filtro"] });
      queryClient.invalidateQueries({ queryKey: ["armazens-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["armazens"] });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar status",
        description: err instanceof Error ? err.message : "Erro desconhecido"
      });
    }
  };

  const filteredArmazens = useMemo(() => {
    if (!armazensData) return [];
    
    return armazensData.filter((armazem) => {
      // Filter by status
      if (filterStatus === "ativo" && !armazem.ativo) return false;
      if (filterStatus === "inativo" && armazem.ativo) return false;
      
      // Filter by search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches = 
          armazem.nome.toLowerCase().includes(term) ||
          armazem.cidade.toLowerCase().includes(term) ||
          armazem.estado.toLowerCase().includes(term);
        if (!matches) return false;
      }
      
      return true;
    });
  }, [armazensData, filterStatus, searchTerm]);

  const canCreate = hasRole("admin") || hasRole("logistica");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Armazéns" description="Carregando..." actions={<></>} />
        <div className="container mx-auto px-6 py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando armazéns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Armazéns" description="Erro ao carregar dados" actions={<></>} />
        <div className="container mx-auto px-6 py-8 text-center">
          <p className="text-destructive">Erro: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Armazéns"
        description="Gerencie os armazéns do sistema"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary" disabled={!canCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Armazém
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Armazém</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={novoArmazem.nome}
                    onChange={(e) => setNovoArmazem((s) => ({ ...s, nome: e.target.value }))}
                    placeholder="Ex: Armazém Central"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={novoArmazem.cidade}
                    onChange={(e) => setNovoArmazem((s) => ({ ...s, cidade: e.target.value }))}
                    placeholder="Ex: São Paulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado (UF) *</Label>
                  <Select
                    value={novoArmazem.estado}
                    onValueChange={(v) => setNovoArmazem((s) => ({ ...s, estado: v }))}
                  >
                    <SelectTrigger id="estado">
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosBrasil.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button className="bg-gradient-primary" onClick={handleCreateArmazem}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filters */}
      <div className="container mx-auto px-6 pt-3">
        <div className="flex items-center gap-3 mb-4">
          <Input
            className="h-9 flex-1"
            placeholder="Buscar por nome ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
            >
              Todos
            </Button>
            <Button
              variant={filterStatus === "ativo" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("ativo")}
            >
              Ativos
            </Button>
            <Button
              variant={filterStatus === "inativo" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("inativo")}
            >
              Inativos
            </Button>
          </div>
        </div>
      </div>

      {/* Grid of warehouse cards */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredArmazens.map((armazem) => (
            <Card key={armazem.id} className="transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary">
                      <Warehouse className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{armazem.nome}</h3>
                      <p className="text-sm text-muted-foreground">
                        {armazem.cidade}/{armazem.estado}
                      </p>
                    </div>
                  </div>
                  <Badge variant={armazem.ativo ? "default" : "secondary"}>
                    {armazem.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="mt-3 flex justify-end">
                  <Switch
                    checked={armazem.ativo}
                    onCheckedChange={() => handleToggleAtivo(armazem.id, armazem.ativo)}
                    disabled={!canCreate}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {filteredArmazens.length === 0 && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhum armazém encontrado com os filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
};

export default Armazens;
