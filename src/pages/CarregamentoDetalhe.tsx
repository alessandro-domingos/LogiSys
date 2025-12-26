import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, ArrowRight, Download, FileText, Image } from "lucide-react";

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

const ARROW_HEIGHT = 26;

const CarregamentoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [armazemId, setArmazemId] = useState<string | null>(null);
  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageFileXml, setStageFileXml] = useState<File | null>(null);
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
        .select(`
          id,
          status,
          etapa_atual,
          numero_nf,
          data_chegada,
          created_at,
          cliente_id,
          armazem_id,
          observacao_chegada,
          observacao_inicio,
          observacao_carregando,
          observacao_finalizacao,
          observacao_documentacao,
          data_inicio,
          data_carregando,
          data_finalizacao,
          data_documentacao,
          url_nota_fiscal,
          url_xml,
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
        `)
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
      // Sempre iniciar na etapa atual
      setSelectedEtapa(carregamento.etapa_atual);
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

  // Componente de fluxo (setas acima dos círculos)
  const renderEtapasFluxo = () => (
    <div
      className="w-full flex flex-col"
      style={{ marginTop: `${ARROW_HEIGHT + 8}px`, marginBottom: "28px" }}
    >
      <div className="relative">
        <div className="flex items-end justify-between w-full max-w-4xl mx-auto relative">
          {ETAPAS.map((etapa, idx) => {
            const etapaIndex = etapa.id;
            const etapaAtual = carregamento?.etapa_atual ?? 1;
            const isFinalizada = etapaIndex < etapaAtual;
            const isAtual = etapaIndex === etapaAtual;
            const isSelected = selectedEtapa === etapaIndex;
            const podeClicar = true; // Todas as etapas são clicáveis para visualização
            
            return (
              <div
                key={etapa.id}
                className="flex flex-col items-center flex-1 min-w-[90px] relative"
              >
                {/* seta entre círculos, exceto o último */}
                {idx < ETAPAS.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      top: `-${ARROW_HEIGHT}px`,
                      left: "50%",
                      transform: "translateX(0)",
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
                    rounded-full flex items-center justify-center transition-all
                    ${isSelected ? "bg-primary text-white border-2 border-primary shadow-lg" :
                      isFinalizada ? "bg-green-500 text-white" :
                      isAtual ? "bg-blue-500 text-white" :
                        "bg-gray-200 text-gray-600"}
                    ${podeClicar ? "cursor-pointer hover:scale-105" : "cursor-default"}
                  `}
                  style={{
                    width: 36,
                    height: 36,
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    marginBottom: 3,
                    boxShadow: isSelected ? "0 2px 6px 0 rgba(80,80,80,.15)" : "none",
                  }}
                  onClick={() => {
                    if (podeClicar) {
                      setSelectedEtapa(etapaIndex);
                    }
                  }}
                >
                  {isFinalizada ? <CheckCircle className="w-6 h-6" /> : etapaIndex}
                </div>
                <div
                  className={
                    "text-xs text-center leading-tight " +
                    (isSelected ? "text-primary font-medium" : "text-foreground") +
                    (podeClicar ? " cursor-pointer" : "")
                  }
                  style={{
                    minHeight: 32,
                    fontWeight: isSelected ? 500 : 400,
                    marginTop: 2,
                  }}
                  onClick={() => {
                    if (podeClicar) {
                      setSelectedEtapa(etapaIndex);
                    }
                  }}
                >
                  {etapa.nome}
                </div>
                <div className="text-[11px] text-center text-muted-foreground" style={{ marginTop: 1 }}>
                  {etapaIndex === 1 && carregamento?.data_chegada
                    ? formatarDataHora(carregamento.data_chegada)
                    : etapaIndex === 2 && carregamento?.data_inicio
                    ? formatarDataHora(carregamento.data_inicio)
                    : etapaIndex === 3 && carregamento?.data_carregando
                    ? formatarDataHora(carregamento.data_carregando)
                    : etapaIndex === 4 && carregamento?.data_finalizacao
                    ? formatarDataHora(carregamento.data_finalizacao)
                    : etapaIndex === 5 && carregamento?.data_documentacao
                    ? formatarDataHora(carregamento.data_documentacao)
                    : "-"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Área de etapas - interativa baseada na etapa selecionada
  const renderAreaEtapas = () => {
    if (!selectedEtapa) return null;

    const etapaNome = ETAPAS.find(e => e.id === selectedEtapa)?.nome || "Etapa";
    const isEtapaDoc = selectedEtapa === 5;
    const etapaAtual = carregamento?.etapa_atual ?? 1;
    const isEtapaConcluida = selectedEtapa < etapaAtual;
    const isEtapaAtual = selectedEtapa === etapaAtual;
    const isEtapaFutura = selectedEtapa > etapaAtual;
    const isEtapaFinalizada = selectedEtapa === 6 && etapaAtual === 6;
    
    // Só usuário armazém pode editar a etapa atual
    const podeEditar = roles.includes("armazem") && 
                      carregamento?.armazem_id === armazemId && 
                      isEtapaAtual && 
                      !isEtapaFinalizada;

    // Obter dados da etapa
    const getEtapaData = () => {
      switch (selectedEtapa) {
        case 1:
          return {
            data: carregamento?.data_chegada,
            observacao: carregamento?.observacao_chegada
          };
        case 2:
          return {
            data: carregamento?.data_inicio,
            observacao: carregamento?.observacao_inicio
          };
        case 3:
          return {
            data: carregamento?.data_carregando,
            observacao: carregamento?.observacao_carregando
          };
        case 4:
          return {
            data: carregamento?.data_finalizacao,
            observacao: carregamento?.observacao_finalizacao
          };
        case 5:
          return {
            data: carregamento?.data_documentacao,
            observacao: carregamento?.observacao_documentacao
          };
        default:
          return { data: null, observacao: null };
      }
    };

    const etapaData = getEtapaData();

    return (
      <Card className="mb-8 shadow-sm">
        <CardContent className="p-6 space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-xl font-semibold text-foreground">{etapaNome}</h2>
            {etapaData.data && (
              <p className="text-sm text-muted-foreground mt-1">
                Concluída em: {formatarDataHora(etapaData.data)}
              </p>
            )}
          </div>

          {isEtapaFinalizada ? (
            // Etapa 6 finalizada - processo concluído
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Processo Finalizado</h3>
              <p className="text-muted-foreground">
                O carregamento foi concluído com sucesso.
              </p>
            </div>
          ) : isEtapaConcluida ? (
            // Etapa concluída - mostrar arquivos e observações (somente leitura)
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">Etapa Concluída</span>
                </div>
                
                {etapaData.observacao && (
                  <div className="mb-4">
                    <span className="text-sm font-medium text-green-700">Observações:</span>
                    <p className="text-sm text-green-600 mt-1 bg-white p-2 rounded border">{etapaData.observacao}</p>
                  </div>
                )}

                {/* Mostrar links para arquivos */}
                <div className="space-y-3">
                  {isEtapaDoc ? (
                    // Etapa de documentação - mostrar PDF e XML
                    <>
                      {carregamento?.url_nota_fiscal && (
                        <div className="flex items-center gap-2 p-2 bg-white rounded border">
                          <FileText className="w-4 h-4 text-green-600" />
                          <a 
                            href={carregamento.url_nota_fiscal} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-green-700 hover:text-green-800 underline text-sm flex-1"
                          >
                            Baixar Nota Fiscal (PDF)
                          </a>
                          <Download className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                      {carregamento?.url_xml && (
                        <div className="flex items-center gap-2 p-2 bg-white rounded border">
                          <FileText className="w-4 h-4 text-green-600" />
                          <a 
                            href={carregamento.url_xml} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-green-700 hover:text-green-800 underline text-sm flex-1"
                          >
                            Baixar Arquivo XML
                          </a>
                          <Download className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                    </>
                  ) : (
                    // Outras etapas - mostrar foto (simulado por enquanto - será implementado depois)
                    <div className="flex items-center gap-2 p-2 bg-white rounded border">
                      <Image className="w-4 h-4 text-green-600" />
                      <span className="text-green-700 text-sm flex-1">
                        Foto anexada - {etapaNome}
                      </span>
                      <Download className="w-4 h-4 text-green-600" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : podeEditar ? (
            // Etapa atual - usuário armazém pode editar
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-base font-semibold block mb-2">
                    {isEtapaDoc ? "Anexar Nota Fiscal (PDF) *" : "Anexar foto obrigatória *"}
                  </label>
                  <Input
                    type="file"
                    accept={isEtapaDoc ? ".pdf" : "image/*"}
                    onChange={e => setStageFile(e.target.files?.[0] ?? null)}
                    className="w-full"
                  />
                </div>

                {isEtapaDoc && (
                  <div>
                    <label className="text-base font-semibold block mb-2">
                      Anexar Arquivo XML
                    </label>
                    <Input
                      type="file"
                      accept=".xml"
                      onChange={e => setStageFileXml(e.target.files?.[0] ?? null)}
                      className="w-full"
                    />
                  </div>
                )}

                <div>
                  <label className="text-base font-semibold block mb-2">
                    Observações (opcional)
                  </label>
                  <Textarea
                    placeholder={`Digite observações sobre ${etapaNome.toLowerCase()}...`}
                    value={stageObs}
                    onChange={e => setStageObs(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  disabled={!stageFile}
                  size="lg"
                  className="px-8"
                >
                  {selectedEtapa === 5 ? "Finalizar Carregamento" : "Próxima Etapa"}
                </Button>
              </div>
            </>
          ) : isEtapaFutura ? (
            // Etapa futura - aguardando etapa anterior
            <div className="text-center py-8 text-muted-foreground">
              <p>Aguardando a etapa anterior ser finalizada.</p>
            </div>
          ) : (
            // Etapa atual mas usuário não pode editar (admin, logística, cliente)
            <div className="text-center py-8 text-muted-foreground">
              <p>Aguardando execução desta etapa pelo armazém.</p>
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
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-6">Informações do Carregamento</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <div className="space-y-4">
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
            <div className="space-y-4">
              <div>
                <span className={LABEL_STYLE}>Status</span>
                <span className={`${VALUE_STYLE} capitalize`}>
                  {carregamento.status}
                </span>
              </div>
              <div>
                <span className={LABEL_STYLE}>Etapa atual</span>
                <span className={VALUE_STYLE}>
                  {ETAPAS.find(e => e.id === carregamento.etapa_atual)?.nome || "N/A"}
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
        {renderAreaEtapas()}
        {renderInformacoesProcesso()}
      </div>
    </div>
  );
};

export default CarregamentoDetalhe;
