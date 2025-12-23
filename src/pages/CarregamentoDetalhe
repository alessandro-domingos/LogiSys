import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const ETAPAS = [
  { id: 0, nome: "Aguardando início" },
  { id: 1, nome: "Chegada" },
  { id: 2, nome: "Início Carregamento" },
  { id: 3, nome: "Carregando" },
  { id: 4, nome: "Finalização Processual" },
  { id: 5, nome: "Finalização Fiscal" }
];

const getEtapaLabel = (etapa_atual: number) => {
  const found = ETAPAS.find(e => e.id === etapa_atual);
  return found ? found.nome : `Etapa ${etapa_atual}`;
};

const getStatusLabel = (status: string | null) => {
  switch (status) {
    case "aguardando": return "Aguardando início";
    case "em_andamento": return "Em andamento";
    case "finalizado": return "Finalizado";
    case "cancelado": return "Cancelado";
    default: return status || "";
  }
};

const getStatusBadgeVariant = (status: string | null) => {
  switch (status) {
    case "aguardando": return "secondary";
    case "em_andamento": return "default";
    case "finalizado": return "default";
    case "cancelado": return "outline";
    default: return "outline";
  }
};

const CarregamentoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [armazemId, setArmazemId] = useState<string | null>(null);

  // Descobre usuário logado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const fetchRoles = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (data) setRoles(data.map((r) => r.role));
    };
    fetchRoles();
  }, [userId]);

  useEffect(() => {
    const fetchVinculos = async () => {
      if (!userId || roles.length === 0) return;
      if (roles.includes("cliente")) {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", userId)
          .single();
        setClienteId(cliente?.id ?? null);
      } else {
        setClienteId(null);
      }
      if (roles.includes("armazem")) {
        const { data: armazem } = await supabase
          .from("armazens")
          .select("id")
          .eq("user_id", userId)
          .single();
        setArmazemId(armazem?.id ?? null);
      } else {
        setArmazemId(null);
      }
    };
    fetchVinculos();
    // eslint-disable-next-line
  }, [userId, roles]);

  // Query para buscar o carregamento
  const { data: carregamento, isLoading, error } = useQuery({
    queryKey: ["carregamento-detalhe", id, clienteId, armazemId, roles],
    queryFn: async () => {
      let query = supabase
        .from("carregamentos")
        .select(
          `
          id,
          status,
          etapa_atual,
          numero_nf,
          data_chegada,
          created_at,
          cliente_id,
          armazem_id,
          agendamento:agendamentos!carregamentos_agendamento_id_fkey (
            id,
            data_retirada,
            horario,
            quantidade,
            cliente:clientes!agendamentos_cliente_id_fkey (
              nome
            ),
            placa_caminhao,
            motorista_nome,
            motorista_documento
          )
        `
        )
        .eq("id", id)
        .single();

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled:
      !!id &&
      userId != null &&
      roles.length > 0 &&
      (
        (!roles.includes("cliente") && !roles.includes("armazem"))
        || (roles.includes("cliente") && clienteId !== null)
        || (roles.includes("armazem") && armazemId !== null)
      )
  });

  // Redireciona p/ lista se não pode ver
  useEffect(() => {
    if (
      !isLoading &&
      carregamento &&
      userId &&
      roles.length > 0
    ) {
      if (
        !(
          roles.includes("admin") ||
          roles.includes("logistica") ||
          (roles.includes("cliente") && clienteId && carregamento.cliente_id === clienteId) ||
          (roles.includes("armazem") && armazemId && carregamento.armazem_id === armazemId)
        )
      ) {
        navigate("/carregamentos");
      }
    }
    // eslint-disable-next-line
  }, [isLoading, carregamento, userId, roles, clienteId, armazemId, navigate]);

  if (
    isLoading ||
    userId == null ||
    roles.length === 0 ||
    (roles.includes("cliente") && clienteId === null) ||
    (roles.includes("armazem") && armazemId === null)
  ) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detalhes do Carregamento" />
        <div className="flex justify-center items-center h-40">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }

  if (error || !carregamento) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detalhes do Carregamento" />
        <div className="container mx-auto py-12">
          <Card className="border-destructive">
            <CardContent className="p-6">
              <div className="text-center text-destructive">
                <p className="font-semibold">Erro ao carregar carregamento</p>
                <p className="text-sm mt-2">{error instanceof Error ? error.message : "Erro desconhecido ou sem permissão"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Exibe detalhes básicos
  const agendamento = carregamento.agendamento;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Detalhes do Carregamento" />
      <div className="container mx-auto px-6 py-6">
        <Card>
          <CardContent className="p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-xl">
                Cliente: {agendamento?.cliente?.nome || "N/A"}
              </h2>
              <Badge variant={getStatusBadgeVariant(carregamento.status)}>{getStatusLabel(carregamento.status)}</Badge>
            </div>
            <div>
              <p><b>Etapa atual:</b> {getEtapaLabel(carregamento.etapa_atual ?? 0)}</p>
              <p><b>Número NF:</b> {carregamento.numero_nf || "N/A"}</p>
              <p><b>Data chegada:</b> {carregamento.data_chegada ? new Date(carregamento.data_chegada).toLocaleString("pt-BR") : "N/A"}</p>
              <p><b>Data criação:</b> {carregamento.created_at ? new Date(carregamento.created_at).toLocaleString("pt-BR") : "N/A"}</p>
            </div>
            {agendamento && (
              <div className="pt-3">
                <h3 className="font-semibold">Dados do agendamento</h3>
                <p><b>Data retirada:</b> {agendamento.data_retirada || "N/A"}</p>
                <p><b>Horário:</b> {agendamento.horario || "N/A"}</p>
                <p><b>Quantidade:</b> {agendamento.quantidade ?? "N/A"} toneladas</p>
                <p><b>Placa caminhão:</b> {agendamento.placa_caminhao || "N/A"}</p>
                <p><b>Motorista:</b> {agendamento.motorista_nome || "N/A"}</p>
                <p><b>Documento motorista:</b> {agendamento.motorista_documento || "N/A"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CarregamentoDetalhe;
