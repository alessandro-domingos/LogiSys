import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, CheckCircle, Loader2, FileText } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";

const ETAPAS = [
  { id: 0, nome: "Aguardando início" },
  { id: 1, nome: "Chegada" },
  { id: 2, nome: "Início Carregamento" },
  { id: 3, nome: "Carregando" },
  { id: 4, nome: "Finalização Processual" },
  { id: 5, nome: "Finalização Fiscal" },
];

// Helper para formatar data/hora
const formatarDataHora = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const CarregamentoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Estados
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [uploadingNF, setUploadingNF] = useState(false);
  const [uploadingXML, setUploadingXML] = useState(false);

  // Estado de permissão simplificado
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [armazemId, setArmazemId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);

  // 1. Busca apenas os roles do user autenticado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    const fetchRolesAndVinculos = async () => {
      if (!userId) return;
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (rolesData) setRoles(rolesData.map((r) => r.role));
      // Se for cliente/armazem, busca so o FK
      if (rolesData?.some((r) => r.role === 'armazem')) {
        const { data: armazem } = await supabase
          .from("armazens")
          .select("id")
          .eq("user_id", userId)
          .single();
        setArmazemId(armazem?.id ?? null);
      } else {
        setArmazemId(null);
      }
      if (rolesData?.some((r) => r.role === 'cliente')) {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", userId)
          .single();
        setClienteId(cliente?.id ?? null);
      } else {
        setClienteId(null);
      }
    };
    fetchRolesAndVinculos();
    // eslint-disable-next-line
  }, [userId]);

  // Buscar detalhes do carregamento
  const { data: carregamento, isLoading, error, refetch } = useQuery({
    queryKey: ["carregamento-detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carregamentos")
        .select(`
          *,
          agendamento:agendamentos!carregamentos_agendamento_id_fkey (
            data_retirada,
            horario,
            quantidade,
            placa_caminhao,
            motorista_nome,
            motorista_documento,
            cliente:clientes!agendamentos_cliente_id_fkey (
              nome
            )
          ),
          etapas:etapas_carregamento(id, etapa, nome_etapa, inicio, fim, observacao, created_at),
          fotos:fotos_carregamento(id, etapa, url, legenda, created_at),
          documentos:documentos_carregamento(id, tipo, url, created_at)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
  });

  // Permissão SIMPLIFICADA baseada só em roles e FKs do carregamento
  const podeEditar = useMemo(() => {
    if (!userId || !roles.length || !carregamento) return false;
    if (roles.includes("admin") || roles.includes("logistica")) return true;
    if (roles.includes("armazem") && armazemId && carregamento.armazem_id === armazemId) return true;
    if (roles.includes("cliente") && clienteId && carregamento.cliente_id === clienteId) return true;
    return false;
  }, [userId, roles, carregamento, armazemId, clienteId]);

  useEffect(() => {
    // Só redireciona se carregou e não tem permissão baseada no carregamento/roles
    if (!isLoading && carregamento && !podeEditar) {
      navigate("/carregamentos");
    }
    // eslint-disable-next-line
  }, [isLoading, carregamento, podeEditar]);

  const etapaAtual = carregamento?.etapa_atual ?? 0;
  const etapaFinalizada = etapaAtual > 5;
  const etapaInfo = ETAPAS.find(e => e.id === etapaAtual);

  const fotosPorEtapa = useMemo(() => {
    if (!carregamento?.fotos) return {};
    const map: Record<number, any[]> = {};
    for (const f of carregamento.fotos) {
      if (typeof f.etapa !== "number") continue;
      if (!map[f.etapa]) map[f.etapa] = [];
      map[f.etapa].push(f);
    }
    return map;
  }, [carregamento?.fotos]);
  const documentosPorTipo = useMemo(() => {
    if (!carregamento?.documentos) return {};
    const map: Record<string, any> = {};
    for (const d of carregamento.documentos) {
      map[d.tipo] = d;
    }
    return map;
  }, [carregamento?.documentos]);
  const etapaObservacoes: Record<number, string> = {
    0: "",
    1: carregamento?.observacao_chegada ?? "",
    2: carregamento?.observacao_inicio ?? "",
    3: carregamento?.observacao_carregando ?? "",
    4: carregamento?.observacao_finalizacao ?? "",
    5: carregamento?.observacao_nf ?? "",
  };
  const dataEtapas: Record<number, string | null | undefined> = {
    0: carregamento?.created_at,
    1: carregamento?.data_chegada,
    2: carregamento?.data_inicio_carregamento,
    3: carregamento?.data_carregando,
    4: carregamento?.data_finalizacao,
    5: carregamento?.data_nf,
  };

  // Upload de foto (para etapas 1-4)
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setFoto(e.target.files[0]);
  };

  const uploadFotoMutation = useMutation({
    mutationFn: async () => {
      if (!foto) throw new Error("Selecione uma foto");
      setUploading(true);
      const filePath = `carregamentos/${id}/etapa${etapaAtual}_${Date.now()}_${foto.name}`;
      const { error: uploadError } = await supabase.storage
        .from("carregamento-fotos")
        .upload(filePath, foto);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("fotos_carregamento")
        .insert([{
          carregamento_id: id,
          etapa: etapaAtual,
          url: filePath,
          legenda: "",
        }]);
      if (insertError) throw insertError;
      setFoto(null);
      setUploading(false);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["carregamento-detalhe", id]);
    },
    onError: () => setUploading(false),
  });

  // Upload de NF/PDF/XML
  const handleNfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setNfFile(e.target.files[0]);
  };
  const handleXmlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setXmlFile(e.target.files[0]);
  };

  const uploadNfMutation = useMutation({
    mutationFn: async () => {
      if (!nfFile) throw new Error("Selecione a NF (PDF)");
      setUploadingNF(true);
      const filePath = `carregamentos/${id}/nf_${Date.now()}_${nfFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("carregamento-documentos")
        .upload(filePath, nfFile);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase
        .from("documentos_carregamento")
        .insert([{
          carregamento_id: id,
          tipo: "nf",
          url: filePath,
        }]);
      if (insertError) throw insertError;
      setNfFile(null);
      setUploadingNF(false);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["carregamento-detalhe", id]);
    },
    onError: () => setUploadingNF(false),
  });

  const uploadXmlMutation = useMutation({
    mutationFn: async () => {
      if (!xmlFile) throw new Error("Selecione o arquivo XML");
      setUploadingXML(true);
      const filePath = `carregamentos/${id}/xml_${Date.now()}_${xmlFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("carregamento-documentos")
        .upload(filePath, xmlFile);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase
        .from("documentos_carregamento")
        .insert([{
          carregamento_id: id,
          tipo: "xml",
          url: filePath,
        }]);
      if (insertError) throw insertError;
      setXmlFile(null);
      setUploadingXML(false);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["carregamento-detalhe", id]);
    },
    onError: () => setUploadingXML(false),
  });

  // Observação
  const handleObsSave = async () => {
    let col: string | null = null;
    switch (etapaAtual) {
      case 1: col = "observacao_chegada"; break;
      case 2: col = "observacao_inicio"; break;
      case 3: col = "observacao_carregando"; break;
      case 4: col = "observacao_finalizacao"; break;
      case 5: col = "observacao_nf"; break;
      default: return;
    }
    if (!col) return;
    const { error } = await supabase
      .from("carregamentos")
      .update({ [col]: obs })
      .eq("id", id);
    if (!error) refetch();
  };

  // Avançar etapa
  const avancarEtapa = async () => {
    const { error } = await supabase
      .from("carregamentos")
      .update({ etapa_atual: etapaAtual + 1 })
      .eq("id", id);
    if (!error) refetch();
  };

  const tempoEtapas = useMemo(() => {
    const result: Record<number, string> = {};
    for (let i = 1; i <= 5; i++) {
      const ini = dataEtapas[i];
      const fim = i < 5 ? dataEtapas[i + 1] : carregamento?.updated_at;
      if (!ini) continue;
      const dtIni = new Date(ini).getTime();
      const dtFim = fim ? new Date(fim).getTime() : Date.now();
      const duracao = dtFim - dtIni;
      if (duracao > 0) {
        const min = Math.floor(duracao / 60000) % 60;
        const hrs = Math.floor(duracao / 3600000);
        result[i] = `${hrs ? hrs + "h " : ""}${min}m`;
      }
    }
    return result;
  }, [dataEtapas, carregamento?.updated_at]);

  const bloqueado = uploading || uploadingNF || uploadingXML || etapaFinalizada || carregamento?.status === "finalizado" || !podeEditar;
  const isUltimaEtapa = etapaAtual === 5;
  const nfEnviada = Boolean(documentosPorTipo["nf"]);
  const xmlEnviado = Boolean(documentosPorTipo["xml"]);

  if (isLoading || !carregamento || userId == null || roles.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detalhes do Carregamento" />
        <div className="flex justify-center items-center h-40">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detalhes do Carregamento" />
        <div className="flex justify-center items-center h-40 text-destructive">
          Erro ao carregar detalhes: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Detalhes do Carregamento" />

      {/* Stepper etapas */}
      <div className="container mx-auto px-6 mt-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {ETAPAS.map((etapa, idx) => (
              <div key={etapa.id} className="flex-1 flex flex-col items-center">
                <div className={`rounded-full h-8 w-8 flex items-center justify-center font-bold mb-1
                    ${etapaAtual === etapa.id ? "bg-primary text-white" :
                      (etapaAtual > etapa.id ? "bg-green-400 text-white" : "bg-gray-300 text-muted-foreground")}`}>
                  {etapaAtual > etapa.id ? <CheckCircle className="h-5 w-5" /> : etapa.id}
                </div>
                <span className={`text-xs font-semibold ${etapaAtual === etapa.id ? "text-primary" : ""}`}>{etapa.nome}</span>
                <span className="text-[10px] text-muted-foreground">{formatarDataHora(dataEtapas[etapa.id])}</span>
                {tempoEtapas[etapa.id] && <span className="text-xs">{tempoEtapas[etapa.id]}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Etapa atual */}
      {!etapaFinalizada && (
        <div className="container mx-auto px-6 mt-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Etapa atual:&nbsp; {etapaInfo?.nome || "Desconhecida"}</Badge>
                </div>

                {/* Upload obrigatório apenas se etapaAtual >=1 e <5 */}
                {etapaAtual >= 1 && etapaAtual < 5 && podeEditar && (
                  <>
                    <Label className="font-medium">Subir foto da etapa (obrigatório)</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="file" accept="image/*" disabled={bloqueado} onChange={handleFotoChange} />
                      <Button
                        variant="default"
                        size="sm"
                        disabled={bloqueado || !foto}
                        onClick={() => uploadFotoMutation.mutate()}
                      >
                        {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                        &nbsp; Anexar
                      </Button>
                      {foto && <span className="text-xs text-muted-foreground">{foto.name}</span>}
                    </div>
                    {fotosPorEtapa[etapaAtual] && fotosPorEtapa[etapaAtual].map((f) => (
                      <img key={f.id} src={supabase.storage.from("carregamento-fotos").getPublicUrl(f.url).data.publicUrl} alt="" className="h-20 rounded mt-2 cursor-pointer" />
                    ))}
                  </>
                )}

                {/* Última etapa: NF (PDF) e XML */}
                {isUltimaEtapa && podeEditar && (
                  <>
                    <Label className="font-medium">Upload Nota Fiscal (PDF) *</Label>
                    {!nfEnviada ? (
                      <div className="flex gap-2 items-center mb-2">
                        <Input type="file" accept="application/pdf" disabled={bloqueado} onChange={handleNfChange} />
                        <Button
                          variant="default"
                          size="sm"
                          disabled={bloqueado || !nfFile}
                          onClick={() => uploadNfMutation.mutate()}
                        >
                          {uploadingNF ? <Loader2 className="animate-spin h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                          &nbsp; Anexar NF
                        </Button>
                        {nfFile && <span className="text-xs text-muted-foreground">{nfFile.name}</span>}
                      </div>
                    ) : (
                      <a
                        href={supabase.storage.from("carregamento-documentos").getPublicUrl(documentosPorTipo["nf"].url).data.publicUrl}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary underline"
                      >
                        <FileText className="h-4 w-4" /> Visualizar NF anexada
                      </a>
                    )}
                    <Label className="font-medium">Upload Arquivo XML *</Label>
                    {!xmlEnviado ? (
                      <div className="flex gap-2 items-center mb-2">
                        <Input type="file" accept=".xml,application/xml,text/xml" disabled={bloqueado} onChange={handleXmlChange} />
                        <Button
                          variant="default"
                          size="sm"
                          disabled={bloqueado || !xmlFile}
                          onClick={() => uploadXmlMutation.mutate()}
                        >
                          {uploadingXML ? <Loader2 className="animate-spin h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                          &nbsp; Anexar XML
                        </Button>
                        {xmlFile && <span className="text-xs text-muted-foreground">{xmlFile.name}</span>}
                      </div>
                    ) : (
                      <a
                        href={supabase.storage.from("carregamento-documentos").getPublicUrl(documentosPorTipo["xml"].url).data.publicUrl}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-green-700 underline"
                      >
                        <FileText className="h-4 w-4" /> Visualizar XML anexado
                      </a>
                    )}
                  </>
                )}

                {/* Etapa 0: só info, sem upload nem observação. */}
                {etapaAtual === 0 && (
                  <div className="font-medium text-muted-foreground">
                    Aguardando início: o carregamento está registrado, mas ainda não foi iniciado. Assim que a chegada for informada e foto anexada, o processo prossegue para a próxima etapa!
                  </div>
                )}

                {/* Observação da etapa, se for etapa válida (exceto etapa 0) */}
                {etapaAtual >= 1 && etapaAtual <= 5 && podeEditar && (
                  <div className="space-y-1">
                    <Label>Observação da etapa</Label>
                    <Input
                      value={obs.length ? obs : etapaObservacoes[etapaAtual]}
                      onChange={e => setObs(e.target.value)}
                      disabled={bloqueado}
                    />
                    {!bloqueado && <Button size="sm" className="mt-1" onClick={handleObsSave}>Salvar Observação</Button>}
                  </div>
                )}

                {/* Botão para avançar etapa */}
                {podeEditar && (
                  <Button
                    size="lg"
                    className="mt-2"
                    disabled={
                      bloqueado ||
                      (etapaAtual >= 1 && etapaAtual < 5 && !(fotosPorEtapa[etapaAtual]?.length > 0)) ||
                      (isUltimaEtapa && !(nfEnviada && xmlEnviado))
                    }
                    onClick={avancarEtapa}
                  >
                    Próxima etapa
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Depois de finalizado, mostra todas as fotos, documentos e estatísticas */}
      {etapaFinalizada && (
        <div className="container mx-auto px-6 mt-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-green-600 font-bold flex items-center gap-1 mb-2">
                <CheckCircle className="h-5 w-5" /> Carregamento finalizado!
              </div>
              <div className="flex flex-wrap gap-4 mt-4">
                {ETAPAS.map((etapa) => (
                  <div key={etapa.id} className="flex-1 min-w-[160px]">
                    <div className="font-semibold">{etapa.nome}</div>
                    <div className="text-xs text-muted-foreground">{formatarDataHora(dataEtapas[etapa.id])}</div>
                    {etapaObservacoes[etapa.id] && (
                      <div className="text-xs my-1">Obs: {etapaObservacoes[etapa.id]}</div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {(fotosPorEtapa[etapa.id] || []).map((f) => (
                        <img key={f.id} src={supabase.storage.from("carregamento-fotos").getPublicUrl(f.url).data.publicUrl} alt="" className="h-16 rounded" />
                      ))}
                      {/* Etapa 5: mostra NF/XML anexados */}
                      {etapa.id === 5 && (
                        <>
                          {documentosPorTipo["nf"] && (
                            <a
                              href={supabase.storage.from("carregamento-documentos").getPublicUrl(documentosPorTipo["nf"].url).data.publicUrl}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary underline"
                            >
                              <FileText className="h-4 w-4" /> NF anexada
                            </a>
                          )}
                          {documentosPorTipo["xml"] && (
                            <a
                              href={supabase.storage.from("carregamento-documentos").getPublicUrl(documentosPorTipo["xml"].url).data.publicUrl}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-green-700 underline"
                            >
                              <FileText className="h-4 w-4" /> XML anexado
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="font-medium">Tempo total: {
                  (() => {
                    const ini = dataEtapas[1];
                    const fim = carregamento.updated_at;
                    if (ini && fim) {
                      const dtIni = new Date(ini).getTime();
                      const dtFim = new Date(fim).getTime();
                      const min = Math.floor((dtFim - dtIni) / 60000) % 60;
                      const hrs = Math.floor((dtFim - dtIni) / 3600000);
                      return `${hrs ? hrs + "h " : ""}${min}m`;
                    }
                    return "-";
                  })()
                }</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resumo geral */}
      <div className="container mx-auto px-6 py-8">
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Cliente</div>
                <div className="font-semibold">{carregamento?.agendamento?.cliente?.nome}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Data/Hora Agendamento</div>
                <div className="font-semibold">{carregamento.agendamento?.data_retirada} {carregamento.agendamento?.horario}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Quantidade</div>
                <div className="font-semibold">{carregamento.agendamento?.quantidade} t</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Placa caminhão</div>
                <div className="font-semibold">{carregamento.agendamento?.placa_caminhao}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Motorista</div>
                <div className="font-semibold">{carregamento.agendamento?.motorista_nome}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Doc. motorista</div>
                <div className="font-semibold">{carregamento.agendamento?.motorista_documento}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CarregamentoDetalhe;
