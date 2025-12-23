// ...imports (iguais aos seus)

const ETAPAS = [
  { id: 1, nome: "Chegada", campoObs: "observacao_chegada", campoData: "data_chegada", campoUrl: "url_chegada" },
  { id: 2, nome: "Início Carregamento", campoObs: "observacao_inicio", campoData: "data_inicio_carregamento", campoUrl: "url_inicio" },
  { id: 3, nome: "Carregando", campoObs: "observacao_carregando", campoData: "data_carregando", campoUrl: "url_carregando" },
  { id: 4, nome: "Carreg. Finalizado", campoObs: "observacao_finalizacao", campoData: "data_finalizacao", campoUrl: "url_finalizacao" },
  { id: 5, nome: "Documentação", campoObs: "observacao_nf", campoData: "data_nf", campoUrl: "url_nota_fiscal", campoXml: "url_xml" },
  { id: 6, nome: "Finalizado" }
];

// ...formatarDataHora, LABEL_STYLE, VALUE_STYLE, ARROW_HEIGHT (igual)

const CarregamentoDetalhe = () => {
  // ...hooks de user/roles/clienteId/armazemId/selectedEtapa, iguais ao seu código

  // ...fetch carregamento com observacao_chegada...url_xml (igual ao sugerido antes)
  
  // ...permissão & redirecionamento (igual)

  // Funções auxiliares de permissão
  const isArmazem = roles.includes("armazem");
  const isCliente = roles.includes("cliente");

  // Controle de clique nas etapas do fluxo
  const handleClickEtapa = (etapaId: number) => {
    // Pode visualizar etapas <= etapa_atual+1 (armazem), ou <= etapa_atual (cliente)
    if (isArmazem && etapaId <= (carregamento.etapa_atual ?? 0) + 1) setSelectedEtapa(etapaId);
    else if (isCliente && etapaId <= (carregamento.etapa_atual ?? 0)) setSelectedEtapa(etapaId);
    else if (!isArmazem && !isCliente) setSelectedEtapa(etapaId); // admin/logistica, livre
  };

  // ----------- FLUXO DE ETAPAS (com clique) -----------
  const renderEtapasFluxo = () => (
    <div className="w-full flex flex-col" style={{ marginTop: `${ARROW_HEIGHT + 8}px`, marginBottom: "28px" }}>
      <div className="relative">
        <div className="flex items-end justify-between w-full max-w-4xl mx-auto relative">
          {ETAPAS.map((etapa, idx) => {
            const etapaIndex = etapa.id;
            const isFinalizada = (carregamento.etapa_atual ?? 0) >= etapaIndex;
            const isAtual = selectedEtapa === etapaIndex;
            const isClicavel = 
              (isArmazem && etapaIndex <= (carregamento.etapa_atual ?? 0) + 1) ||
              (isCliente && etapaIndex <= (carregamento.etapa_atual ?? 0)) ||
              (!isArmazem && !isCliente) // admin/logistica
            ;
            return (
              <div
                key={etapa.id}
                className={`flex flex-col items-center flex-1 min-w-[90px] relative transition cursor-pointer ${isClicavel ? "hover:brightness-110" : "opacity-60 cursor-not-allowed"}`}
                onClick={() => isClicavel && setSelectedEtapa(etapaIndex)}
              >
                {idx < ETAPAS.length - 1 && (
                  <div style={{ position: "absolute", top: `-${ARROW_HEIGHT}px`, left: "50%", transform: "translateX(0)", width: "100%", display: "flex", justifyContent: "center" }}>
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className={
                  `rounded-full flex items-center justify-center
                  ${(isFinalizada ? "bg-green-200 text-green-800" :
                  isAtual ? "bg-primary text-white border-2 border-primary shadow-lg" :
                  "bg-gray-200 text-gray-500")}`
                }
                  style={{
                    width: 36, height: 36, fontWeight: 700, fontSize: "1.1rem",
                    boxShadow: isAtual ? "0 2px 6px 0 rgba(80,80,80,.15)" : "none",marginBottom:3,
                  }}
                >
                  {isFinalizada ? <CheckCircle className="w-6 h-6" /> : etapaIndex}
                </div>
                <div className={"text-xs text-center leading-tight " + (isAtual ? "text-primary" : "text-foreground")} style={{ minHeight: 32, fontWeight: 400, marginTop: 2 }}>
                  {etapa.nome}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ----------- ÁREA DE REGISTROS/INFO DA ETAPA -----------
  const renderAreaRegistro = () => {
    const etapaIdx = selectedEtapa ?? (carregamento.etapa_atual ?? 1);
    const etapa = ETAPAS.find(e => e.id === etapaIdx);
    if (!etapa || etapa.id === 6)
      return (
        <Card className="mb-8 shadow-sm">
          <CardContent className="p-6 font-medium text-center text-green-900">
            Processo finalizado!
          </CardContent>
        </Card>
      );

    // Pega campos nos dados
    const campoObs = (etapa as any).campoObs; // ex: observacao_chegada
    const campoData = (etapa as any).campoData
    const campoUrl = (etapa as any).campoUrl;
    const campoXml = (etapa as any).campoXml;

    const obsVal = carregamento?.[campoObs] ?? "";
    const dataVal = carregamento?.[campoData] ?? "";
    const urlVal = carregamento?.[campoUrl] ?? "";
    const urlXml = campoXml ? carregamento?.[campoXml] ?? "" : "";

    // Etapa já finalizada (<= etapa_atual)
    const isFinalizada = etapa.id <= (carregamento.etapa_atual ?? 0);
    // Etapa atual liberada para armazém (edição)
    const isAtivaArmazem = isArmazem && etapa.id === (carregamento.etapa_atual ?? 0) + 1;

    if (isFinalizada) {
      // Exibe anexo e observação, permite baixar se existir
      return (
        <Card className="mb-8 shadow-sm">
          <CardContent className="p-4 space-y-5">
            <div className="font-medium">{etapa.nome} (finalizada em {formatarDataHora(dataVal)})</div>
            <div>
              <span className="font-semibold">Observação:</span>{" "}
              {obsVal ? <span>{obsVal}</span> : <span className="text-gray-400">-</span>}
            </div>
            {(etapa.id < 5) && urlVal && (
              <div>
                <span className="font-semibold">Foto: </span>
                <a
                  href={urlVal}
                  target="_blank"
                  className="text-primary underline"
                  download
                >Baixar/Visualizar</a>
              </div>
            )}
            {etapa.id === 5 && (
              <>
                <div>
                  <span className="font-semibold">Nota Fiscal PDF: </span>
                  {urlVal ? <a href={urlVal} target="_blank" className="text-primary underline" download>Baixar</a> : <span className="text-gray-400">Não enviado</span>}
                </div>
                <div>
                  <span className="font-semibold">Arquivo XML: </span>
                  {urlXml ? <a href={urlXml} target="_blank" className="text-primary underline" download>Baixar</a> : <span className="text-gray-400">Não enviado</span>}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      );
    }

    if (isAtivaArmazem) {
      // Exibição modo edição para armazém
      return (
        <Card className="mb-8 shadow-sm">
          <CardContent className="p-4 space-y-6">
            <div className="font-medium">{etapa.nome}</div>
            <div className="space-y-2">
              <label className="block font-semibold">
                {etapa.id === 5 ? "Anexar Nota Fiscal (PDF) *" : "Anexar foto obrigatória *"}
              </label>
              <Input
                type="file"
                accept={etapa.id === 5 ? ".pdf" : "image/*"}
                onChange={e => setStageFile(e.target.files?.[0] ?? null)}
                className="w-full"
              />
              {etapa.id === 5 && (
                <>
                  <label className="block font-semibold mt-2">Anexar arquivo XML *</label>
                  <Input
                    type="file"
                    accept=".xml"
                    className="w-full"
                  />
                </>
              )}
            </div>
            <div>
              <label className="block font-semibold">Observações (opcional)</label>
              <Textarea
                placeholder="Digite observações sobre esta etapa..."
                value={stageObs}
                onChange={e => setStageObs(e.target.value)}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button disabled={!stageFile} variant="primary" size="lg">{etapa.id === 5 ? "Finalizar" : "Próxima Etapa"}</Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Etapa futura (não pode editar) ou cliente vendo etapa pendente
    return (
      <Card className="mb-8 shadow-sm">
        <CardContent className="p-6 text-center text-gray-400">
          {isCliente
            ? "Aguardando conclusão desta etapa pelo Armazém."
            : "Aguardando etapa."}
        </CardContent>
      </Card>
    );
  };

  // ... renderInformacoesProcesso igual

  // ...loader/erro igual

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Detalhes do Carregamento" />
      <div className="container mx-auto px-1 md:px-4 pt-1 pb-8 gap-4 flex flex-col max-w-[1050px]">
        {renderEtapasFluxo()}
        {renderAreaRegistro()}
        {renderInformacoesProcesso()}
      </div>
    </div>
  );
};

export default CarregamentoDetalhe;
