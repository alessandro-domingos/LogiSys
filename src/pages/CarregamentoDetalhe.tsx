import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, FilePlus, ArrowRight } from "lucide-react";

const ETAPAS = [
  { id: 1, nome: "Chegada" },
  { id: 2, nome: "Início Carregamento" },
  { id: 3, nome: "Carregando" },
  { id: 4, nome: "Carreg. Finalizado" },
  { id: 5, nome: "Documentação" },
  { id: 6, nome: "Finalizado" },
];

const getEtapaLabel = (etapa_id: number) => {
  const found = ETAPAS.find(e => e.id === etapa_id);
  return found ? found.nome : `Etapa ${etapa_id}`;
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

  // Dummy local stage (for layout only)
  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageObs, setStageObs] = useState("");
  const [selectedEtapa, setSelectedEtapa] = useState<number | null>(null);

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

  // Redireciona para lista caso não possa ver
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

  // Layout states
  useEffect(() => {
    if (carregamento?.etapa_atual != null) {
      setSelectedEtapa(carregamento.etapa_atual + 1); // +1 pois etapas começam do 1 na nova lista
    }
  }, [carregamento]);

  // Parâmetros do processo para exemplo das estatísticas
  const processoInicio = carregamento?.data_chegada ? new Date(carregamento.data_chegada) : null;
  const processoCriacao = carregamento?.created_at ? new Date(carregamento.created_at) : null;

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

  // Área superior: fluxo de etapas do processo
  const renderEtapasFluxo = () => (
    <div className="flex items-center justify-center gap-6 py-5">
      {ETAPAS.map((etapa, idx) => {
        const etapaIndex = etapa.id;
        const isFinalizada = (carregamento.etapa_atual ?? 0) + 1 > etapaIndex;
        const isAtual = selectedEtapa === etapaIndex;
        return (
          <div
            key={etapa.id}
            className={`flex flex-col items-center cursor-pointer transition-all ${
              isFinalizada
                ? "text-green-600"
                : isAtual
                ? "text-primary scale-105"
                : "text-muted-foreground hover:text-primary/80"
            }`}
            onClick={() => setSelectedEtapa(etapaIndex)}
          >
            <div
              className={`w-8 h-8 flex items-center justify-center rounded-full border-2
                ${isFinalizada ? "bg-green-200 border-green-600" : isAtual ? "bg-primary border-primary text-white" : "bg-background border-muted-foreground"}`}
            >
              {isFinalizada ? <CheckCircle className="w-5 h-5" /> : etapaIndex}
            </div>
            <div className="text-xs mt-1 font-medium text-center" style={{ width: 80 }}>
              {etapa.nome}
            </div>
            {idx < ETAPAS.length - 1 && (
              <ArrowRight className="mt-3 text-muted-foreground w-6 h-6" />
            )}
          </div>
        );
      })}
    </div>
  );

  // Central: área de atuação (layout apenas)
  const renderCentralAtuacao = () => {
    // Se etapa selecionada for 5.Documentação, mostra dois uploads para nota fiscal e xml
    const isEtapaDoc = selectedEtapa === 5;
    const isFinalizada = carregamento.etapa_atual != null
      ? selectedEtapa && selectedEtapa <= (carregamento.etapa_atual + 1)
      : false;
    return (
      <Card className="mb-6">
        <CardContent className="p-6 space-y-5">
          {!isFinalizada ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {isEtapaDoc
                    ? "Anexar Nota Fiscal (PDF) *"
                    : "Anexar foto obrigatória *"}
                </label>
                <Input
                  disabled={isFinalizada}
                  type="file"
                  accept={isEtapaDoc ? ".pdf" : "image/*"}
                  onChange={e => setStageFile(e.target.files?.[0] ?? null)}
                  className="w-full"
                />
                {isEtapaDoc && (
                  <>
                    <label className="text-sm font-medium mt-3">
                      Anexar Arquivo XML
                    </label>
                    <Input
                      disabled={isFinalizada}
                      type="file"
                      accept=".xml"
                      className="w-full"
                    />
                  </>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Observações (opcional)</label>
                <Textarea
                  disabled={isFinalizada}
                  placeholder="Digite observações sobre esta etapa..."
                  value={stageObs}
                  onChange={e => setStageObs(e.target.value)}
                />
              </div>
              <div className="flex justify-end pt-3">
                <Button
                  disabled={!stageFile}
                  variant="primary"
                  size="lg"
                >
                  Próxima Etapa
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-6">
              <FilePlus className="inline-block w-6 h-6 mr-2" />
              <span>Etapa finalizada. Você pode apenas visualizar os anexos e dados desta etapa.</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Inferior: área de informações gerais + estatísticas
  const renderInformacoesProcesso = () => {
    // Exemplo de tempos e estatísticas para layout
    const tempoTotalDecorrido = processoInicio
      ? `${Math.round((Date.now() - processoInicio.getTime()) / 1000 / 60)} min`
      : "N/A";
    const tempoTotalFinalizacao = processoInicio
      ? carregamento.status === "finalizado"
        ? `${Math.round(((processoCriacao ? processoCriacao.getTime() : Date.now()) - processoInicio.getTime()) / 1000 / 60)} min`
        : "-"
      : "N/A";

    return (
      <Card>
        <CardContent className="p-6 grid gap-3 md:grid-cols-2">
          <div>
            <h3 className="font-semibold mb-2">Informações Gerais</h3>
            <p><b>Nome do cliente:</b> {agendamento?.cliente?.nome || "N/A"}</p>
            <p><b>Quantidade:</b> {agendamento?.quantidade ?? "N/A"} toneladas</p>
            <p><b>Placa caminhão:</b> {agendamento?.placa_caminhao || "N/A"}</p>
            <p><b>Motorista:</b> {agendamento?.motorista_nome || "N/A"}</p>
            <p><b>Doc. Motorista:</b> {agendamento?.motorista_documento || "N/A"}</p>
            <p><b>Número NF:</b> {carregamento.numero_nf || "N/A"}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Estatísticas do Carregamento</h3>
            <p><b>Tempo em cada etapa:</b> <span className="text-muted-foreground">-- min (implementação futura)</span></p>
            <p><b>Tempo total decorrido:</b> {tempoTotalDecorrido}</p>
            <p><b>Tempo até finalização:</b> {tempoTotalFinalizacao}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Detalhes do Carregamento" />
      <div className="container mx-auto px-6 py-6 gap-8 flex flex-col">
        {/* Fluxo do processo (topo) */}
        {renderEtapasFluxo()}

        {/* Área central de atuação */}
        {renderCentralAtuacao()}

        {/* Informações gerais e estatísticas */}
        {renderInformacoesProcesso()}
      </div>
    </div>
  );
};

export default CarregamentoDetalhe;
