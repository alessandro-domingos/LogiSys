import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
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

const formatarDataHora = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
};

const LABEL_STYLE = "block text-[0.75rem] text-gray-400 mb-1 tracking-wide font-normal select-none capitalize";
const VALUE_STYLE = "block text-[0.98rem] font-semibold text-foreground break-all";

// Circulo base: 36px, diminui 10% fica ~32.4px, vamos usar 33px.
const CIRCLE_SIZE = 33;
const ARROW_HEIGHT = 26;

const CarregamentoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [armazemId, setArmazemId] = useState<string | null>(null);
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
      ((!roles.includes("cliente") && !roles.includes("armazem")) ||
        (roles.includes("cliente") && clienteId !== null) ||
        (roles.includes("armazem") && armazemId !== null)),
  });

  useEffect(() => {
    if (carregamento?.etapa_atual != null) {
      setSelectedEtapa(carregamento.etapa_atual + 1);
    }
  }, [carregamento]);

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

  // Stats para info geral
  const processoInicio = carregamento?.data_chegada
    ? new Date(carregamento.data_chegada)
    : null;
  const processoCriacao = carregamento?.created_at
    ? new Date(carregamento.created_at)
    : null;

  // ----------- COMPONENTES DE LAYOUT -----------

  // Componente de fluxo (setas acima dos círculos), todo o grupo deslocado para baixo em 30% da seta.
  const renderEtapasFluxo = () => (
    <div
      className="w-full flex flex-col"
      style={{ marginTop: `${Math.round(ARROW_HEIGHT * 1.3)}px`, marginBottom: "28px" }}
    >
      <div className="relative">
        <div className="flex items-end justify-between w-full max-w-4xl mx-auto relative">
          {ETAPAS.map((etapa, idx) => {
            const etapaIndex = etapa.id;
            const isFinalizada = (carregamento.etapa_atual ?? 0) + 1 > etapaIndex;
            const isAtual = selectedEtapa === etapaIndex;
            return (
              <div
                key={etapa.id}
                className="flex flex-col items-center flex-1 min-w-[90px] relative"
                style={{}}
              >
                {/* Setas acima dos círculos, exceto último */}
                {idx < ETAPAS.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      top: `-${ARROW_HEIGHT}px`,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "100%",
                      display: "flex",
                      justifyContent: "center"
                    }}
                  >
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div
                  className={`
                    rounded-full flex items-center justify-center
                    ${isFinalizada ? "bg-green-200 text-green-800" :
                      isAtual ? "bg-primary text-white border-2 border-primary shadow-lg" :
                        "bg-gray-200 text-gray-500"}
                  `}
                  style={{
                    width: CIRCLE_SIZE,
                    height: CIRCLE_SIZE,
                    fontWeight: 700,
                    fontSize: "1.04rem",
                    marginBottom: 3,
                    boxShadow: isAtual ? "0 2px 6px 0 rgba(80,80,80,.15)" : "none",
                  }}
                >
                  {isFinalizada ? <CheckCircle className="w-5 h-5" /> : etapaIndex}
                </div>
                <div
                  className={
                    "text-xs text-center leading-tight font-bold text-foreground"
                    + (isAtual ? " text-primary" : "")
                  }
                  style={{
                    minHeight: 32,
                    marginTop: 2,
                    fontWeight: "bold",
                  }}
                >
                  {etapa.nome}
                </div>
                <div className="text-[11px] text-center text-muted-foreground" style={{ marginTop: 1 }}>
                  {etapaIndex === 1 && carregamento.data_chegada
                    ? formatarDataHora(carregamento.data_chegada)
                    : "-"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderCentralAtuacao = () => {
    const isEtapaDoc = selectedEtapa === 5;
    const isFinalizada =
      carregamento.etapa_atual != null
        ? selectedEtapa && selectedEtapa <= carregamento.etapa_atual + 1
        : false;

    return (
      <Card className="mb-8 shadow-sm">
        <CardContent className="p-4 space-y-6">
          {!isFinalizada ? (
            <>
              <div className="space-y-2">
                <label className="text-base font-semibold block mb-0.5">
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
                    <label className="text-base font-semibold mt-2 block">
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
              <div>
                <label className="text-base font-semibold block mb-0.5">
                  Observações (opcional)
                </label>
                <Textarea
                  disabled={isFinalizada}
                  placeholder="Digite observações sobre esta etapa..."
                  value={stageObs}
                  onChange={e => setStageObs(e.target.value)}
                />
              </div>
              <div className="flex justify-end pt-0">
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
            <div className="text-center text-muted-foreground py-6 text-base">
              <span className="inline-flex items-center gap-2">
                <FilePlus className="w-6 h-6 mr-2" />
                Etapa finalizada. Você pode apenas visualizar os anexos e dados desta etapa.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderInformacoesProcesso = () => {
    const agendamento = carregamento?.agendamento;
    const tempoTotalDecorrido = processoInicio
      ? `${Math.round(
          (Date.now() - processoInicio.getTime()) / 1000 / 60
        )} min`
      : "N/A";
    const tempoTotalFinalizacao = processoInicio
      ? carregamento.status === "finalizado"
        ? `${Math.round(
            ((processoCriacao
              ? processoCriacao.getTime()
              : Date.now()) -
              processoInicio.getTime()) /
              1000 /
              60
          )} min`
        : "-"
      : "N/A";

    return (
      <Card className="shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <div className="space-y-3">
            <div>
              <span className={LABEL_STYLE}>Nome do cliente</span>
              <span className={VALUE_STYLE}>
                {agendamento?.cliente?.nome || "N/A"}
              </span>
            </div>
            <div>
              <span className={LABEL_STYLE}>Quantidade</span>
              <span className={VALUE_STYLE}>
                {agendamento?.quantidade ?? "N/A"} toneladas
              </span>
            </div>
            <div>
              <span className={LABEL_STYLE}>Placa caminhão</span>
              <span className={VALUE_STYLE}>
                {agendamento?.placa_caminhao || "N/A"}
              </span>
            </div>
            <div>
              <span className={LABEL_STYLE}>Motorista</span>
              <span className={VALUE_STYLE}>
                {agendamento?.motorista_nome || "N/A"}
              </span>
            </div>
            <div>
              <span className={LABEL_STYLE}>Doc. Motorista</span>
              <span className={VALUE_STYLE}>
                {agendamento?.motorista_documento || "N/A"}
              </span>
            </div>
            <div>
              <span className={LABEL_STYLE}>Número nf</span>
              <span className={VALUE_STYLE}>
                {carregamento.numero_nf || "N/A"}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <span className={LABEL_STYLE}>Tempo em cada etapa</span>
              <span className="block text-[.88rem] font-medium text-muted-foreground">
                -- min (implementação futura)
              </span>
            </div>
            <div>
              <span className={LABEL_STYLE}>Tempo total decorrido</span>
              <span className={`${VALUE_STYLE} text-[0.97rem]`}>
                {tempoTotalDecorrido}
              </span>
            </div>
            <div>
              <span className={LABEL_STYLE}>Tempo até finalização</span>
              <span className={`${VALUE_STYLE} text-[0.97rem]`}>
                {tempoTotalFinalizacao}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

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
                <p className="text-sm mt-2">
                  {error instanceof Error
                    ? error.message
                    : "Erro desconhecido ou sem permissão"}
                </p>
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
      <div className="container mx-auto px-1 md:px-4 pt-1 pb-8 gap-4 flex flex-col max-w-[1050px]">
        {renderEtapasFluxo()}
        {renderCentralAtuacao()}
        {renderInformacoesProcesso()}
      </div>
    </div>
  );
};

export default CarregamentoDetalhe;
