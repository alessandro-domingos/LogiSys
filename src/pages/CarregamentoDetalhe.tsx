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
import { Loader2, CheckCircle, FilePlus } from "lucide-react";

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
  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageObs, setStageObs] = useState("");
  const [selectedEtapa, setSelectedEtapa] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const fetchRoles = async () => {
      if (!userId) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (data) setRoles(data.map((r) => r.role));
    };
    fetchRoles();
  }, [userId]);

  useEffect(() => {
    const fetchVinculos = async () => {
      if (!userId || roles.length === 0) return;
      if (roles.includes("cliente")) {
        const { data: cliente } = await supabase.from("clientes").select("id").eq("user_id", userId).single();
        setClienteId(cliente?.id ?? null);
      } else {
        setClienteId(null);
      }
      if (roles.includes("armazem")) {
        const { data: armazem } = await supabase.from("armazens").select("id").eq("user_id", userId).single();
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
      let query = supabase.from("carregamentos").select(`
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
      `).eq("id", id).single();

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled:
      !!id &&
      userId != null &&
      roles.length > 0 &&
      ((!roles.includes("cliente") && !roles.includes("armazem"))
        || (roles.includes("cliente") && clienteId !== null)
        || (roles.includes("armazem") && armazemId !== null)),
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

  // Stats
  const processoInicio = carregamento?.data_chegada ? new Date(carregamento.data_chegada) : null;
  const processoCriacao = carregamento?.created_at ? new Date(carregamento.created_at) : null;

  // ----------- COMPONENTES DE LAYOUT -----------

  // Fluxo de etapas centralizado, sem linhas/setas, perfeitamente alinhados
  const renderEtapasFluxo = () => (
    <div className="w-full py-7 flex flex-col">
      <div className="flex flex-row items-end justify-center gap-0 md:gap-0 px-2 overflow-x-auto">
        {ETAPAS.map((etapa, idx) => {
          const etapaIndex = etapa.id;
          const isFinalizada = (carregamento.etapa_atual ?? 0) + 1 > etapaIndex;
          const isAtual = selectedEtapa === etapaIndex;
          return (
            <div
              key={etapa.id}
              className="flex flex-col items-center min-w-[100px] mx-2 cursor-pointer group transition"
              onClick={() => setSelectedEtapa(etapaIndex)}
              style={{ zIndex: 10 }}
            >
              <div
                className={`
                  w-11 h-11 flex items-center justify-center rounded-full border-2
                  font-bold text-lg shadow
                  transition
                  ${isFinalizada
                    ? "bg-green-200 border-green-600 text-green-800"
                    : isAtual
                      ? "bg-primary border-primary text-white scale-110 shadow-lg"
                      : "bg-background border-muted-foreground text-muted-foreground group-hover:text-primary/80"
                  }
                `}
              >
                {isFinalizada
                  ? <CheckCircle className="w-7 h-7" />
                  : etapaIndex}
              </div>
              <div className="mt-2 text-xs font-semibold text-center max-w-[97px] text-foreground">
                {etapa.nome}
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground font-medium min-h-[19px]">
                {/* Exemplo: só real para chegada por enquanto */}
                {etapaIndex === 1 && carregamento.data_chegada
                  ? formatarDataHora(carregamento.data_chegada)
                  : "-"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCentralAtuacao = () => {
    const isEtapaDoc = selectedEtapa === 5;
    const isFinalizada = carregamento.etapa_atual != null
      ? selectedEtapa && selectedEtapa <= (carregamento.etapa_atual + 1)
      : false;

    return (
      <Card className="mb-8 shadow-sm">
        <CardContent className="p-7 space-y-7">
          {!isFinalizada ? (
            <>
              <div className="space-y-3">
                <label className="text-base font-semibold block mb-1">
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
                    <label className="text-base font-semibold mt-2 block">Anexar Arquivo XML</label>
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
                <label className="text-base font-semibold block mb-1">Observações (opcional)</label>
                <Textarea
                  disabled={isFinalizada}
                  placeholder="Digite observações sobre esta etapa..."
                  value={stageObs}
                  onChange={e => setStageObs(e.target.value)}
                />
              </div>
              <div className="flex justify-end pt-2">
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
            <div className="text-center text-muted-foreground py-8 text-base">
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
    const tempoTotalDecorrido =
      processoInicio
        ? `${Math.round((Date.now() - processoInicio.getTime()) / 1000 / 60)} min`
        : "N/A";
    const tempoTotalFinalizacao =
      processoInicio
        ? carregamento.status === "finalizado"
          ? `${Math.round(((processoCriacao ? processoCriacao.getTime() : Date.now()) - processoInicio.getTime()) / 1000 / 60)} min`
          : "-"
        : "N/A";

    return (
      <Card>
        <CardContent className="p-7 grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="font-semibold mb-2 text-lg text-foreground">Informações Gerais</h3>
            <dl className="space-y-1 text-base">
              <div><dt className="inline text-muted-foreground font-medium">Nome do cliente: </dt><dd className="inline">{agendamento?.cliente?.nome || "N/A"}</dd></div>
              <div><dt className="inline text-muted-foreground font-medium">Quantidade: </dt><dd className="inline">{agendamento?.quantidade ?? "N/A"} toneladas</dd></div>
              <div><dt className="inline text-muted-foreground font-medium">Placa caminhão: </dt><dd className="inline">{agendamento?.placa_caminhao || "N/A"}</dd></div>
              <div><dt className="inline text-muted-foreground font-medium">Motorista: </dt><dd className="inline">{agendamento?.motorista_nome || "N/A"}</dd></div>
              <div><dt className="inline text-muted-foreground font-medium">Doc. Motorista: </dt><dd className="inline">{agendamento?.motorista_documento || "N/A"}</dd></div>
              <div><dt className="inline text-muted-foreground font-medium">Número NF: </dt><dd className="inline">{carregamento.numero_nf || "N/A"}</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-lg text-foreground">Estatísticas do Carregamento</h3>
            <dl className="space-y-1 text-base">
              <div><dt className="inline text-muted-foreground font-medium">Tempo em cada etapa: </dt><dd className="inline text-muted-foreground">-- min (implementação futura)</dd></div>
              <div><dt className="inline text-muted-foreground font-medium">Tempo total decorrido: </dt><dd className="inline">{tempoTotalDecorrido}</dd></div>
              <div><dt className="inline text-muted-foreground font-medium">Tempo até finalização: </dt><dd className="inline">{tempoTotalFinalizacao}</dd></div>
            </dl>
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
      <div className="container mx-auto px-3 md:px-8 py-8 gap-10 flex flex-col">
        {renderEtapasFluxo()}
        {renderCentralAtuacao()}
        {renderInformacoesProcesso()}
      </div>
    </div>
  );
};

export default CarregamentoDetalhe;
