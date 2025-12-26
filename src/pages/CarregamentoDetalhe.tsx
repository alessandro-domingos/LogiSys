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

  // Buscar fotos da etapa selecionada
  const { data: fotosEtapa } = useQuery({
    queryKey: ["fotos-etapa", id, selectedEtapa],
    queryFn: async () => {
      if (!selectedEtapa || selectedEtapa === 6) return [];
      
      const { data, error } = await supabase
        .from("fotos_carregamento")
        .select("*")
        .eq("carregamento_id", id)
        .eq("etapa", selectedEtapa);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!selectedEtapa && selectedEtapa !== 6,
  });

  // Buscar documentos da etapa 5
  const { data: documentosEtapa } = useQuery({
    queryKey: ["documentos-etapa", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos_carregamento")
        .select("*")
        .eq("carregamento_id", id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && selectedEtapa === 5,
  });

  useEffect(() => {
    if (carregamento?.etapa_atual != null) {
      // Iniciar sempre na próxima etapa a ser executada (para armazém) ou etapa atual (para outros)
      if (roles.includes("armazem")) {
        const proximaEtapa = carregamento.etapa_atual < 6 ? carregamento.etapa_atual + 1 : 6;
        setSelectedEtapa(proximaEtapa);
      } else {
        setSelectedEtapa(carregamento.etapa_atual > 0 ? carregamento.etapa_atual : 1);
      }
    }
  }, [carregamento, roles]);

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
            const isFinalizada = (carregamento?.etapa_atual ?? 0) >= etapaIndex;
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
                  {isFinalizada && !isSelected ? <CheckCircle className="w-6 h-6" /> : etapaIndex}
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
    const isEtapaFinalizada = selectedEtapa === 6;
    const etapaAtual = carregamento?.etapa_atual ?? 0;
    const isEtapaConcluida = etapaAtual >= selectedEtapa;
    const isProximaEtapa = etapaAtual + 1 === selectedEtapa;
    const isEtapaFutura = selectedEtapa > etapaAtual + 1;
    
    // Só usuário armazém pode editar e apenas a próxima etapa na sequência
    const podeEditar = roles.includes("armazem") && 
                      carregamento?.armazem_id === armazemId && 
                      isProximaEtapa && 
                      !isEtapaFinalizada;

    // Obter dados da etapa atual
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
            observacao: carregamento
