import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle, ArrowRight, Download, FileText, Image, User, Truck, Calendar, Hash, Clock } from "lucide-react";

const ETAPAS = [
  { id: 1, nome: "Chegada", titulo: "Chegada do Caminhão", campo_data: "data_chegada", campo_obs: "observacao_chegada", campo_url: "url_foto_chegada" },
  { id: 2, nome: "Início Carregamento", titulo: "Início do Carregamento", campo_data: "data_inicio", campo_obs: "observacao_inicio", campo_url: "url_foto_inicio" },
  { id: 3, nome: "Carregando", titulo: "Carregando", campo_data: "data_carregando", campo_obs: "observacao_carregando", campo_url: "url_foto_carregando" },
  { id: 4, nome: "Carreg. Finalizado", titulo: "Carregamento Finalizado", campo_data: "data_finalizacao", campo_obs: "observacao_finalizacao", campo_url: "url_foto_finalizacao" },
  { id: 5, nome: "Documentação", titulo: "Anexar Documentação", campo_data: "data_documentacao", campo_obs: "observacao_documentacao", campo_url: "url_nota_fiscal" },
  { id: 6, nome: "Finalizado", titulo: "Finalizado", campo_data: null, campo_obs: null, campo_url: null },
];

// Função para derivar status visual da etapa
const getStatusFromEtapa = (etapa: number) => {
  switch (etapa) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return { label: "Em Andamento", variant: "default", color: "blue" };
    case 6:
      return { label: "Finalizado", variant: "success", color: "green" };
    default:
      return { label: "Aguardando", variant: "secondary", color: "gray" };
  }
};

const formatarDataHora = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
};

const formatarTempo = (minutos: number) => {
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return `${horas}h${mins > 0 ? ` ${mins}min` : ''}`;
};

const ARROW_HEIGHT = 26;

const CarregamentoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      console.log("🔍 [DEBUG] CarregamentoDetalhe - User ID:", data.user?.id);
      setUserId(data.user?.id ?? null);
    });

    const fetchRoles = async () => {
      if (!userId) return;
      console.log("🔍 [DEBUG] CarregamentoDetalhe - Fetching roles for user:", userId);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (data) {
        console.log("🔍 [DEBUG] CarregamentoDetalhe - User roles:", data.map((r) => r.role));
        setRoles(data.map((r) => r.role));
      }
    };
    fetchRoles();
  }, [userId]);

  useEffect(() => {
    const fetchVinculos = async () => {
      if (!userId || roles.length === 0) return;
      console.log("🔍 [DEBUG] CarregamentoDetalhe - Fetching vínculos for roles:", roles);
      
      if (roles.includes("cliente")) {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", userId)
          .single();
        console.log("🔍 [DEBUG] CarregamentoDetalhe - Cliente ID:", cliente?.id);
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
        console.log("🔍 [DEBUG] CarregamentoDetalhe - Armazem ID:", armazem?.id);
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
      console.log("🔍 [DEBUG] CarregamentoDetalhe - Fetching carregamento:", id);
      
      let query = supabase
        .from("carregamentos")
        .select(`
          id,
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
          url_foto_chegada,
          url_foto_inicio,
          url_foto_carregando,
          url_foto_finalizacao,
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
      if (error) {
        console.error("❌ [ERROR] CarregamentoDetalhe - Erro ao buscar carregamento:", error);
        throw error;
      }
      
      console.log("✅ [SUCCESS] CarregamentoDetalhe - Carregamento carregado:", data);
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

  // Mutation para avançar etapa
  const proximaEtapaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEtapa || !carregamento) {
        console.error("❌ [ERROR] CarregamentoDetalhe - Dados inválidos para próxima etapa");
        throw new Error("Dados inválidos");
      }
      
      const etapaAtual = carregamento.etapa_atual;
      const proximaEtapa = etapaAtual + 1;
      const agora = new Date().toISOString();
      
      console.log("🔍 [DEBUG] CarregamentoDetalhe - Avançando da etapa", etapaAtual, "para", proximaEtapa);
      
      // Preparar dados para atualização
      const updateData: any = {
        etapa_atual: proximaEtapa,
        updated_by: userId,
      };

      // Definir campo de data baseado na etapa atual
      const etapaConfig = ETAPAS.find(e => e.id === etapaAtual);
      if (etapaConfig?.campo_data) {
        updateData[etapaConfig.campo_data] = agora;
        console.log("🔍 [DEBUG] CarregamentoDetalhe - Definindo", etapaConfig.campo_data, "=", agora);
      }
      if (etapaConfig?.campo_obs && stageObs.trim()) {
        updateData[etapaConfig.campo_obs] = stageObs.trim();
        console.log("🔍 [DEBUG] CarregamentoDetalhe - Definindo", etapaConfig.campo_obs, "=", stageObs.trim());
      }

      // Upload de arquivos se necessário
      if (stageFile) {
        console.log("🔍 [DEBUG] CarregamentoDetalhe - Fazendo upload do arquivo:", stageFile.name);
        
        const fileExt = stageFile.name.split('.').pop();
        let bucket = '';
        let fileName = '';
        
        if (etapaAtual === 5) {
          // Etapa 5: Documentação (PDF)
          bucket = 'carregamento-documentos';
          fileName = `${carregamento.id}_nota_fiscal_${Date.now()}.${fileExt}`;
          console.log("🔍 [DEBUG] CarregamentoDetalhe - Upload para bucket documentos:", fileName);
        } else {
          // Outras etapas: Fotos
          bucket = 'carregamento-fotos';
          fileName = `${carregamento.id}_etapa_${etapaAtual}_${Date.now()}.${fileExt}`;
          console.log("🔍 [DEBUG] CarregamentoDetalhe - Upload para bucket fotos:", fileName);
        }
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, stageFile);

        if (uploadError) {
          console.error("❌ [ERROR] CarregamentoDetalhe - Erro no upload:", uploadError);
          throw uploadError;
        }

        console.log("✅ [SUCCESS] CarregamentoDetalhe - Upload realizado:", uploadData);

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        console.log("🔍 [DEBUG] CarregamentoDetalhe - URL pública gerada:", urlData.publicUrl);

        // Definir campo URL baseado na etapa
        if (etapaConfig?.campo_url) {
          updateData[etapaConfig.campo_url] = urlData.publicUrl;
          console.log("🔍 [DEBUG] CarregamentoDetalhe - Definindo", etapaConfig.campo_url, "=", urlData.publicUrl);
        }
      }

      // Upload de XML se for etapa 5
      if (stageFileXml && etapaAtual === 5) {
        console.log("🔍 [DEBUG] CarregamentoDetalhe - Fazendo upload do XML:", stageFileXml.name);
        
        const fileName = `${carregamento.id}_xml_${Date.now()}.xml`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('carregamento-documentos')
          .upload(fileName, stageFileXml);

        if (uploadError) {
          console.error("❌ [ERROR] CarregamentoDetalhe - Erro no upload XML:", uploadError);
          throw uploadError;
        }

        console.log("✅ [SUCCESS] CarregamentoDetalhe - Upload XML realizado:", uploadData);

        const { data: urlData } = supabase.storage
          .from('carregamento-documentos')
          .getPublicUrl(fileName);
        updateData.url_xml = urlData.publicUrl;
        console.log("🔍 [DEBUG] CarregamentoDetalhe - URL XML definida:", urlData.publicUrl);
      }

      console.log("🔍 [DEBUG] CarregamentoDetalhe - Dados para atualização:", updateData);

      // Atualizar carregamento
      const { error: updateError } = await supabase
        .from('carregamentos')
        .update(updateData)
        .eq('id', carregamento.id);

      if (updateError) {
        console.error("❌ [ERROR] CarregamentoDetalhe - Erro na atualização:", updateError);
        throw updateError;
      }

      console.log("✅ [SUCCESS] CarregamentoDetalhe - Carregamento atualizado com sucesso");
      return { proximaEtapa };
    },
    onSuccess: ({ proximaEtapa }) => {
      console.log("✅ [SUCCESS] CarregamentoDetalhe - Etapa avançada para:", proximaEtapa);
      
      toast({
        title: "Etapa avançada com sucesso!",
        description: `Carregamento avançou para: ${ETAPAS.find(e => e.id === proximaEtapa)?.nome}`,
      });
      
      // Limpar formulário
      setStageFile(null);
      setStageFileXml(null);
      setStageObs("");
      
      // Atualizar dados
      queryClient.invalidateQueries({ queryKey: ["carregamento-detalhe", id] });
      
      // Selecionar próxima etapa
      setSelectedEtapa(proximaEtapa);
    },
    onError: (error) => {
      console.error("❌ [ERROR] CarregamentoDetalhe - Erro ao avançar etapa:", error);
      
      toast({
        title: "Erro ao avançar etapa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (carregamento?.etapa_atual != null) {
      console.log("🔍 [DEBUG] CarregamentoDetalhe - Selecionando etapa atual:", carregamento.etapa_atual);
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
      const hasPermission = 
        roles.includes("admin") ||
        roles.includes("logistica") ||
        (roles.includes("cliente") && clienteId && carregamento.cliente_id === clienteId) ||
        (roles.includes("armazem") && armazemId && carregamento.armazem_id === armazemId);
      
      console.log("🔍 [DEBUG] CarregamentoDetalhe - Verificação de permissão:", {
        hasPermission,
        roles,
        clienteId,
        armazemId,
        carregamento_cliente_id: carregamento.cliente_id,
        carregamento_armazem_id: carregamento.armazem_id
      });
      
      if (!hasPermission) {
        console.log("❌ [ERROR] CarregamentoDetalhe - Sem permissão, redirecionando");
        navigate("/carregamentos");
      }
    }
    // eslint-disable-next-line
  }, [isLoading, carregamento, userId, roles, clienteId, armazemId, navigate]);

  // Calcular estatísticas de tempo
  const calcularEstatisticas = () => {
    if (!carregamento) return null;

    const agora = new Date();
    const inicio = carregamento.data_chegada ? new Date(carregamento.data_chegada) : null;
    const fim = carregamento.etapa_atual === 6 && carregamento.data_documentacao 
      ? new Date(carregamento.data_documentacao) : null;

    const tempoTotalDecorrido = inicio 
      ? Math.round((agora.getTime() - inicio.getTime()) / 1000 / 60)
      : 0;

    const tempoTotalProcesso = inicio && fim
      ? Math.round((fim.getTime() - inicio.getTime()) / 1000 / 60)
      : null;

    // Calcular tempo por etapa
    const temposPorEtapa = [];
    const datas = [
      carregamento.data_chegada,
      carregamento.data_inicio,
      carregamento.data_carregando,
      carregamento.data_finalizacao,
      carregamento.data_documentacao
    ];

    for (let i = 0; i < datas.length - 1; i++) {
      if (datas[i] && datas[i + 1]) {
        const tempo = Math.round((new Date(datas[i + 1]!).getTime() - new Date(datas[i]!).getTime()) / 1000 / 60);
        temposPorEtapa.push(tempo);
      }
    }

    const tempoMedioPorEtapa = temposPorEtapa.length > 0
      ? Math.round(temposPorEtapa.reduce((a, b) => a + b, 0) / temposPorEtapa.length)
      : 0;

    return {
      tempoTotalDecorrido,
      tempoTotalProcesso,
      tempoMedioPorEtapa,
      temposPorEtapa
    };
  };

  const stats = calcularEstatisticas();

  // Derivar status visual da etapa
  const statusVisual = carregamento ? getStatusFromEtapa(carregamento.etapa_atual) : null;

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
            const podeClicar = true;
            
            // Lógica visual melhorada - prioriza seleção sobre estado atual
            let circleClasses = "rounded-full flex items-center justify-center transition-all";
            let shadowStyle = "none";
            
            if (isSelected) {
              circleClasses += " bg-white text-primary border-4 border-primary font-bold";
              shadowStyle = "0 2px 8px 0 rgba(59, 130, 246, 0.3)";
            } else if (isAtual) {
              circleClasses += " bg-blue-500 text-white";
            } else if (isFinalizada) {
              circleClasses += " bg-green-500 text-white";
            } else {
              circleClasses += " bg-gray-200 text-gray-600";
            }
            
            if (podeClicar) {
              circleClasses += " cursor-pointer hover:scale-105";
            }

            // Obter data da etapa
            const getDataEtapa = () => {
              switch (etapaIndex) {
                case 1: return carregamento?.data_chegada;
                case 2: return carregamento?.data_inicio;
                case 3: return carregamento?.data_carregando;
                case 4: return carregamento?.data_finalizacao;
                case 5: return carregamento?.data_documentacao;
                default: return null;
              }
            };
            
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
                  className={circleClasses}
                  style={{
                    width: 36,
                    height: 36,
                    fontSize: "1.1rem",
                    marginBottom: 3,
                    boxShadow: shadowStyle,
                  }}
                  onClick={() => {
                    if (podeClicar) {
                      console.log("🔍 [DEBUG] CarregamentoDetalhe - Etapa selecionada:", etapaIndex);
                      setSelectedEtapa(etapaIndex);
                    }
                  }}
                >
                  {isFinalizada && !isSelected ? <CheckCircle className="w-6 h-6" /> : etapaIndex}
                </div>
                <div
                  className={
                    "text-xs text-center leading-tight " +
                    (isSelected ? "text-primary font-bold" : "text-foreground") +
                    (podeClicar ? " cursor-pointer" : "")
                  }
                  style={{
                    minHeight: 32,
                    marginTop: 2,
                  }}
                  onClick={() => {
                    if (podeClicar) {
                      console.log("🔍 [DEBUG] CarregamentoDetalhe - Etapa selecionada (texto):", etapaIndex);
                      setSelectedEtapa(etapaIndex);
                    }
                  }}
                >
                  {etapa.nome}
                </div>
                <div className="text-[11px] text-center text-muted-foreground" style={{ marginTop: 1 }}>
                  {formatarDataHora(getDataEtapa())}
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

    const etapa = ETAPAS.find(e => e.id === selectedEtapa);
    const etapaTitulo = etapa?.titulo || "Etapa";
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

    console.log("🔍 [DEBUG] CarregamentoDetalhe - renderAreaEtapas:", {
      selectedEtapa,
      etapaAtual,
      isEtapaConcluida,
      isEtapaAtual,
      isEtapaFutura,
      podeEditar,
      roles,
      armazemId,
      carregamento_armazem_id: carregamento?.armazem_id
    });

    // Obter dados da etapa
    const getEtapaData = () => {
      switch (selectedEtapa) {
        case 1:
          return {
            data: carregamento?.data_chegada,
            observacao: carregamento?.observacao_chegada,
            url_arquivo: carregamento?.url_foto_chegada
          };
        case 2:
          return {
            data: carregamento?.data_inicio,
            observacao: carregamento?.observacao_inicio,
            url_arquivo: carregamento?.url_foto_inicio
          };
        case 3:
          return {
            data: carregamento?.data_carregando,
            observacao: carregamento?.observacao_carregando,
            url_arquivo: carregamento?.url_foto_carregando
          };
        case 4:
          return {
            data: carregamento?.data_finalizacao,
            observacao: carregamento?.observacao_finalizacao,
            url_arquivo: carregamento?.url_foto_finalizacao
          };
        case 5:
          return {
            data: carregamento?.data_documentacao,
            observacao: carregamento?.observacao_documentacao,
            url_arquivo: carregamento?.url_nota_fiscal,
            url_xml: carregamento?.url_xml
          };
        default:
          return { data: null, observacao: null, url_arquivo: null };
      }
    };

    const etapaData = getEtapaData();

    return (
      <Card className="mb-6 shadow-sm">
        <CardContent className="p-4 space-y-4">
          {/* Header com título e botão */}
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{etapaTitulo}</h2>
              {etapaData.data && (
                <p className="text-xs text-muted-foreground mt-1">
                  Concluída em: {formatarDataHora(etapaData.data)}
                </p>
              )}
            </div>
            {podeEditar && (
              <Button
                disabled={!stageFile || proximaEtapaMutation.isPending}
                size="sm"
                className="px-6"
                onClick={() => {
                  console.log("🔍 [DEBUG] CarregamentoDetalhe - Iniciando próxima etapa");
                  proximaEtapaMutation.mutate();
                }}
              >
                {proximaEtapaMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {selectedEtapa === 5 ? "Finalizar" : "Próxima"}
              </Button>
            )}
          </div>

          {isEtapaFinalizada ? (
            // Etapa 6 finalizada - processo concluído
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-base font-medium text-foreground mb-1">Processo Finalizado</h3>
              <p className="text-sm text-muted-foreground">
                O carregamento foi concluído com sucesso.
              </p>
            </div>
          ) : isEtapaConcluida ? (
            // Etapa concluída - mostrar arquivos e observações (somente leitura)
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800 text-sm">Etapa Concluída</span>
                </div>
                
                {etapaData.observacao && (
                  <div className="mb-3">
                    <span className="text-xs font-medium text-green-700">Observações:</span>
                    <p className="text-xs text-green-600 mt-1 bg-white p-2 rounded border">{etapaData.observacao}</p>
                  </div>
                )}

                {/* Mostrar links para arquivos */}
                <div className="space-y-2">
                  {isEtapaDoc ? (
                    // Etapa de documentação - mostrar PDF e XML
                    <>
                      {etapaData.url_arquivo && (
                        <div className="flex items-center gap-2 p-2 bg-white rounded border">
                          <FileText className="w-3 h-3 text-green-600" />
                          <a 
                            href={etapaData.url_arquivo} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-green-700 hover:text-green-800 underline text-xs flex-1"
                          >
                            Baixar Nota Fiscal (PDF)
                          </a>
                          <Download className="w-3 h-3 text-green-600" />
                        </div>
                      )}
                      {etapaData.url_xml && (
                        <div className="flex items-center gap-2 p-2 bg-white rounded border">
                          <FileText className="w-3 h-3 text-green-600" />
                          <a 
                            href={etapaData.url_xml} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-green-700 hover:text-green-800 underline text-xs flex-1"
                          >
                            Baixar Arquivo XML
                          </a>
                          <Download className="w-3 h-3 text-green-600" />
                        </div>
                      )}
                    </>
                  ) : (
                    // Outras etapas - mostrar foto
                    etapaData.url_arquivo && (
                      <div className="flex items-center gap-2 p-2 bg-white rounded border">
                        <Image className="w-3 h-3 text-green-600" />
                        <a 
                          href={etapaData.url_arquivo} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-green-700 hover:text-green-800 underline text-xs flex-1"
                        >
                          Ver foto - {etapa?.nome}
                        </a>
                        <Download className="w-3 h-3 text-green-600" />
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : podeEditar ? (
            // Etapa atual - usuário armazém pode editar
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold block mb-1">
                  {isEtapaDoc ? "Anexar Nota Fiscal (PDF) *" : "Anexar foto obrigatória *"}
                </label>
                <Input
                  type="file"
                  accept={isEtapaDoc ? ".pdf" : "image/*"}
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null;
                    console.log("🔍 [DEBUG] CarregamentoDetalhe - Arquivo selecionado:", file?.name);
                    setStageFile(file);
                  }}
                  className="w-full text-sm"
                  disabled={proximaEtapaMutation.isPending}
                />
              </div>

              {isEtapaDoc && (
                <div>
                  <label className="text-sm font-semibold block mb-1">
                    Anexar Arquivo XML
                  </label>
                  <Input
                    type="file"
                    accept=".xml"
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      console.log("🔍 [DEBUG] CarregamentoDetalhe - Arquivo XML selecionado:", file?.name);
                      setStageFileXml(file);
                    }}
                    className="w-full text-sm"
                    disabled={proximaEtapaMutation.isPending}
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-semibold block mb-1">
                  Observações (opcional)
                </label>
                <Textarea
                  placeholder={`Digite observações sobre ${etapa?.nome.toLowerCase()}...`}
                  value={stageObs}
                  onChange={e => setStageObs(e.target.value)}
                  rows={2}
                  className="text-sm"
                  disabled={proximaEtapaMutation.isPending}
                />
              </div>
            </div>
          ) : isEtapaFutura ? (
            // Etapa futura - aguardando etapa anterior
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">Aguardando a etapa anterior ser finalizada.</p>
            </div>
          ) : (
            // Etapa atual mas usuário não pode editar
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">Aguardando execução desta etapa pelo armazém.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderInformacoesProcesso = () => {
    const agendamento = carregamento?.agendamento;

    return (
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <h2 className="text-base font-semibold mb-4">Informações do Carregamento</h2>
          
          {/* Layout compacto para mobile */}
          <div className="space-y-4">
            {/* Linha 1: Cliente e Quantidade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground block">Cliente</span>
                  <span className="text-sm font-medium truncate block">{agendamento?.cliente?.nome || "N/A"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground block">Quantidade</span>
                  <span className="text-sm font-medium">{agendamento?.quantidade ?? "N/A"} ton</span>
                </div>
              </div>
            </div>

            {/* Linha 2: Placa e Motorista */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground block">Placa</span>
                  <span className="text-sm font-medium">{agendamento?.placa_caminhao || "N/A"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground block">Motorista</span>
                  <span className="text-sm font-medium truncate block">{agendamento?.motorista_nome || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Linha 3: Status (derivado da etapa) e Etapa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground block">Status</span>
                  <span className="text-sm font-medium" style={{ color: statusVisual?.color }}>
                    {statusVisual?.label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground block">Etapa atual</span>
                  <span className="text-sm font-medium">{ETAPAS.find(e => e.id === carregamento.etapa_atual)?.nome || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Estatísticas de Tempo */}
            {stats && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Estatísticas de Tempo</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Tempo decorrido</span>
                    <span className="font-medium">{formatarTempo(stats.tempoTotalDecorrido)}</span>
                  </div>
                  
                  {stats.tempoTotalProcesso && (
                    <div>
                      <span className="text-muted-foreground block">Tempo total do processo</span>
                      <span className="font-medium">{formatarTempo(stats.tempoTotalProcesso)}</span>
                    </div>
                  )}
                  
                  {stats.tempoMedioPorEtapa > 0 && (
                    <div>
                      <span className="text-muted-foreground block">Tempo médio por etapa</span>
                      <span className="font-medium">{formatarTempo(stats.tempoMedioPorEtapa)}</span>
                    </div>
                  )}

                  {carregamento.numero_nf && (
                    <div>
                      <span className="text-muted-foreground block">Nota Fiscal</span>
                      <span className="font-medium">{carregamento.numero_nf}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
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
      <div className="container mx-auto px-2 md:px-4 pt-1 pb-8 gap-4 flex flex-col max-w-[1050px]">
        {renderEtapasFluxo()}
        {renderAreaEtapas()}
        {renderInformacoesProcesso()}
      </div>
    </div>
  );
};

export default CarregamentoDetalhe;
