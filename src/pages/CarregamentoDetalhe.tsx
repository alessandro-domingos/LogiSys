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
import { Loader2, CheckCircle, ArrowRight } from "lucide-react";

// Etapas com nomes ajustados e IDs a partir de 1
const ETAPAS = [
  { id: 1, nome: "Chegada", key: "data_chegada" },
  { id: 2, nome: "Início Carregamento", key: "data_inicio_carregamento" },
  { id: 3, nome: "Carregando", key: "data_carregando" },
  { id: 4, nome: "Carreg. Finalizado", key: "data_finalizacao" },
  { id: 5, nome: "Documentação", key: "data_nf" },
  { id: 6, nome: "Finalizado", key: "data_finalizado" },
];

// Helper para formatar data/hora
const formatarDataHora = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
};

const getStatusLabel = (status: string | null) => {
  switch (status) {
    case "aguardando":
      return "Aguardando início";
    case "em_andamento":
      return "Em andamento";
    case "finalizado":
      return "Finalizado";
    case "cancelado":
      return "Cancelado";
    default:
      return status || "";
  }
};

const getStatusBadgeVariant = (status: string | null) => {
  switch (status) {
    case "aguardando":
      return "secondary";
    case "em_andamento":
      return "default";
    case "finalizado":
      return "default";
    case "cancelado":
      return "outline";
    default:
      return "outline";
  }
};

const CarregamentoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [armazemId, setArmazemId] = useState<string | null>(null);
  // Para o layout
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

  // Query para buscar o carregamento (ajustado p/ trazer campos de datas de cada etapa, para exibir nos círculos)
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
            data_inicio_carregamento,
            data_carregando,
            data_finalizacao,
            data_nf,
            data_finalizado,
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
      ((!roles.includes("cliente") && !roles.includes("armazem")) ||
        (roles.includes("cliente") && clienteId !== null) ||
        (roles.includes("armazem") && armazemId !== null)),
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

  // Inferior: área de informações gerais + estatísticas
  const renderInformacoesProcesso = () => {
    // Exemplo de tempos e estatísticas para layout
    const processoInicio = carregamento?.data_chegada
      ? new Date(carregamento.data_chegada)
      : null;
    const processoCriacao = carregamento?.created_at
      ? new Date(carregamento.created_at)
      : null;

    const tempoTotalDecorrido = processoInicio
      ? `${Math.round((Date.now() - processoInicio.getTime()) / 1000 / 60)} min`
      : "N/A";
    const tempoTotalFinalizacao = processoInicio
      ? carregamento.status === "finalizado"
        ? `${Math.round(
            ((processoCriacao ? processoCriacao.getTime() : Date.now()) -
              processoInicio.getTime()) /
              1000 /
              60
          )} min`
        : "-"
      : "N/A";

    const agendamento = carregamento?.agendamento;

    return (
      <Card>
        <CardContent className="p-6 grid gap-3 md:grid-cols-2">
          <div>
            <h3 className="font-semibold mb-2 text-lg">Informações Gerais</h3>
            <dl className="space-y-1 text-base">
              <div>
                <dt className="inline text-muted-foreground font-medium">Nome do cliente: </dt>
                <dd className="inline">{agendamento?.cliente?.nome || "N/A"}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground font-medium">Quantidade: </dt>
                <dd className="inline">{agendamento?.quantidade ?? "N/A"} toneladas</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground font-medium">Placa caminhão: </dt>
                <dd className="inline">{agendamento?.placa_caminhao || "N/A"}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground font-medium">Motorista: </dt>
                <dd className="inline">{agendamento?.motorista_nome || "N/A"}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground font-medium">Doc. Motorista: </dt>
                <dd className="inline">{agendamento?.motorista_documento || "N/A"}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground font-medium">Número NF: </dt>
                <dd className="inline">{carregamento.numero_nf || "N/A"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-lg">Estatísticas do Carregamento</h3>
            <dl className="space-y-1 text-base">
              <div>
                <dt className="inline text-muted-foreground font-medium">Tempo em cada etapa: </dt>
                <dd className="inline text-muted-foreground">-- min (implementação futura)</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground font-medium">Tempo total decorrido: </dt>
                <dd className="inline">{tempoTotalDecorrido}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground font-medium">Tempo até finalização: </dt>
                <dd className="inline">{tempoTotalFinalizacao}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Componente fluxo ajustado
  const renderEtapasFluxo = () => {
    // Busca datas de etapa pelo nome do campo
    const etapaAtual = carregamento?.etapa_atual ?? 0;

    return (
      <div className="w-full overflow-x-auto py-6 flex flex-col items-stretch">
        <div className="flex flex-row items-center justify-center gap-0 w-full px-2 md:px-8">
          {ETAPAS.map((etapa, idx) => {
            const etapaIndex = etapa.id;
            const isFinalizada = etapaAtual + 1 > etapaIndex;
            const isAtual = selectedEtapa === etapaIndex;
            const etapaData = carregamento?.[etapa.key as keyof typeof carregamento];

            return (
              <>
                <div
                  key={etapa.id}
                  className="flex flex-col items-center flex-none min-w-[108px] max-w-[108px]"
                  style={{ zIndex: 2 }}
                  onClick={() => setSelectedEtapa(etapaIndex)}
                >
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all
                        ${isFinalizada
                        ? "bg-green-200 border-green-600 text-green-700"
                        : isAtual
                          ? "bg-primary border-primary text-white scale-105 shadow-lg"
                          : "bg-background border-muted-foreground text-muted-foreground hover:text-primary/80"}`}
                  >
                    {isFinalizada
                      ? <CheckCircle className="w-6 h-6" />
                      : etapaIndex}
                  </div>
                  <div className="text-xs mt-2 text-center font-semibold max-w-[90px] break-words">{etapa.nome}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 mb-1 font-normal" style={{ minHeight: 16 }}>
                    {formatarDataHora(etapaData as string | null)}
                  </div>
                </div>
                {idx < ETAPAS.length - 1 && (
                  <div className="flex-1 min-w-[20px] max-w-[50px] mx-[-6px] flex items-center justify-center">
                    <ArrowRight className="w-7 h-7 text-gray-300 dark:text-gray-700" />
                  </div>
                )}
              </>
            );
          })}
        </div>
      </div>
    );
  };

  // Central: área de atuação (layout apenas)
  const renderCentralAtuacao = () => {
    const isEtapaDoc = selectedEtapa === 5;
    const etapaAtual = carregamento?.etapa_atual ?? 0;
    const isFinalizada = selectedEtapa && selectedEtapa <= (etapaAtual + 1)
      ? selectedEtapa <= etapaAtual
      : false;

    return (
      <Card className="mb-6">
        <CardContent className="p-6 space-y-5">
          {!isFinalizada ? (
            <>
              <div className="space-y-2">
                <label className="text-base font-semibold">
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
                    <label className="text-base font-semibold mt-3">
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
                <label className="text-base font-semibold">Observações (opcional)</label>
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
            <div className="text-center text-muted-foreground py-7 text-base">
              <span className="inline-flex items-center gap-2">
                <CheckCircle className="w-6 h-6 mr-2" />
                Etapa finalizada. Você pode apenas visualizar os anexos e dados desta etapa.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // loading/erro
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

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Detalhes do Carregamento" />
      <div className="container mx-auto px-2 md:px-8 py-6 gap-8 flex flex-col">
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
