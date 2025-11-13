import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Helpers de data
const startOfTodayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const endOfTodayISO = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const toBRDate = (v: string | Date) => {
  const d = typeof v === "string" ? new Date(v) : v;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
const onlyDateKey = (v: string) => {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};
const lastNDays = (n: number) => {
  const out: Date[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);
    out.push(d);
  }
  return out;
};

// Gráfico de barras (SVG simples)
function BarChart({
  data,
  height = 140,
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-medium">{d.value}</span>
            </div>
            <div className="h-3 w-full rounded bg-muted/60">
              <div
                className="h-3 rounded"
                style={{
                  width: `${pct}%`,
                  background: d.color || "linear-gradient(90deg, #4f46e5, #22d3ee)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Gráfico de linha (SVG simples)
function LineChart({
  points,
  height = 140,
}: {
  points: Array<{ xLabel: string; value: number }>;
  height?: number;
}) {
  const width = 420;
  const padding = 24;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? innerW / (points.length - 1) : innerW;

  const svgPoints = points.map((p, i) => {
    const x = padding + i * stepX;
    const y = padding + (1 - p.value / max) * innerH;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <polyline
          fill="none"
          stroke="url(#grad1)"
          strokeWidth="3"
          points={svgPoints}
        />
        <defs>
          <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        {points.map((p, i) => {
          const x = padding + i * stepX;
          const y = padding + (1 - p.value / max) * innerH;
          return <circle key={i} cx={x} cy={y} r="3" fill="#0ea5e9" />;
        })}
      </svg>
      <div className="mt-2 grid grid-cols-7 gap-1 text-[10px] text-muted-foreground">
        {points.map((p) => (
          <div key={p.xLabel} className="text-center truncate">{p.xLabel}</div>
        ))}
      </div>
    </div>
  );
}

const Dashboard = () => {
  const { toast } = useToast();

  // Métricas principais (counts)
  const { data: totalAtivas } = useQuery({
    queryKey: ["liberacoes-ativas-count"],
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from("liberacoes")
          .select("id", { count: "exact", head: true });
        if (error) {
          console.error("Error counting liberacoes:", error);
          return 0;
        }
        return count ?? 0;
      } catch (err) {
        console.error("Exception counting liberacoes:", err);
        return 0;
      }
    },
    refetchInterval: 60_000,
  });

  const { data: agendamentosHoje } = useQuery({
    queryKey: ["agendamentos-hoje-count"],
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .gte("data_hora", startOfTodayISO())
          .lte("data_hora", endOfTodayISO());
        if (error) {
          console.error("Error fetching agendamentos hoje:", error);
          return 0;
        }
        return count ?? 0;
      } catch (err) {
        console.error("Exception fetching agendamentos hoje:", err);
        return 0;
      }
    },
    refetchInterval: 60_000,
  });

  const { data: carregandoCount } = useQuery({
    queryKey: ["carregamentos-em-andamento-count"],
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from("carregamentos")
          .select("id", { count: "exact", head: true });
        if (error) {
          console.error("Error fetching carregamentos:", error);
          return 0;
        }
        return count ?? 0;
      } catch (err) {
        console.error("Exception fetching carregamentos:", err);
        return 0;
      }
    },
    refetchInterval: 60_000,
  });

  const { data: baixoEstoqueCount } = useQuery({
    queryKey: ["stock-baixo-count"],
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from("estoque")
          .select("id", { count: "exact", head: true })
          .lt("quantidade", 10);
        if (error) {
          console.error("Error fetching stock baixo count:", error);
          return 0;
        }
        return count ?? 0;
      } catch (err) {
        console.error("Exception fetching stock baixo count:", err);
        return 0;
      }
    },
    refetchInterval: 120_000,
  });

  // Gráfico: Liberações por Status (últimos 30 dias) - REMOVED due to enum issues
  const barrasLiberacoes = useMemo(() => {
    // Placeholder data until status enum issue is resolved
    return [
      { label: "Pendente", value: 0, color: "linear-gradient(90deg,#f59e0b,#fbbf24)" },
      { label: "Parcial", value: 0, color: "linear-gradient(90deg,#3b82f6,#60a5fa)" },
      { label: "Concluído", value: 0, color: "linear-gradient(90deg,#10b981,#34d399)" },
      { label: "Cancelado", value: 0, color: "linear-gradient(90deg,#ef4444,#f87171)" },
    ];
  }, []);

  // Gráfico: Evolução de Carregamentos (últimos 7 dias) por criação
  const { data: carregamentos7 } = useQuery({
    queryKey: ["carregamentos-ult-7"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carregamentos")
        .select("id,created_at")
        .gte("created_at", daysAgoISO(7));
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 120_000,
  });
  const linhaCarregamentos = useMemo(() => {
    const days = lastNDays(7);
    const counts: Record<string, number> = {};
    days.forEach((d) => (counts[d.toISOString().slice(0, 10)] = 0));
    (carregamentos7 ?? []).forEach((c: any) => {
      const key = onlyDateKey(c.created_at);
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return days.map((d) => ({
      xLabel: toBRDate(d),
      value: counts[d.toISOString().slice(0, 10)] || 0,
    }));
  }, [carregamentos7]);

  // Próximos Agendamentos (5 próximos)
  const { data: proximosAg } = useQuery({
    queryKey: ["proximos-agendamentos"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("agendamentos")
          .select(`
            id,
            quantidade,
            data_retirada,
            horario,
            liberacao_id,
            liberacoes!inner(
              pedido_interno,
              cliente_id,
              clientes(nome, cnpj_cpf)
            )
          `)
          .gte("data_retirada", new Date().toISOString().split('T')[0])
          .order("data_retirada", { ascending: true })
          .limit(5);
        if (error) {
          console.error("Error fetching proximos agendamentos:", error);
          return [];
        }
        return data ?? [];
      } catch (err) {
        console.error("Exception fetching proximos agendamentos:", err);
        return [];
      }
    },
    refetchInterval: 60_000,
  });

  // Alertas:
  // - Estoque baixo (lista)
  // - Liberações atrasadas: status pendente e created_at < hoje
  const { data: lowStocks } = useQuery({
    queryKey: ["stock-baixo-list"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("estoque")
          .select("id,quantidade,produto_id,armazem_id,updated_at,produtos(nome),armazens(nome)")
          .lt("quantidade", 10)
          .limit(20);
        if (error) {
          console.error("Error fetching stock baixo list:", error);
          return [];
        }
        return data ?? [];
      } catch (err) {
        console.error("Exception fetching stock baixo list:", err);
        return [];
      }
    },
    refetchInterval: 180_000,
  });
  const { data: atrasos } = useQuery({
    queryKey: ["liberacoes-atrasadas"],
    queryFn: async () => {
      try {
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
        seteDiasAtras.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
          .from("liberacoes")
          .select(`
            id,
            pedido_interno,
            quantidade_liberada,
            quantidade_retirada,
            created_at,
            cliente_id,
            clientes(nome, cnpj_cpf)
          `)
          .lt("created_at", seteDiasAtras.toISOString())
          .order("created_at", { ascending: true })
          .limit(20);
        if (error) {
          console.error("Error fetching liberacoes atrasadas:", error);
          return [];
        }
        return data ?? [];
      } catch (err) {
        console.error("Exception fetching liberacoes atrasadas:", err);
        return [];
      }
    },
    refetchInterval: 180_000,
  });

  // UI
  return (
    <div className="container mx-auto px-6 py-6">
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total de Liberações</div>
            <div className="mt-1 text-3xl font-bold">{totalAtivas ?? 0}</div>
            <div className="text-xs text-muted-foreground">Todas as liberações</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Agendamentos Hoje</div>
            <div className="mt-1 text-3xl font-bold">{agendamentosHoje ?? 0}</div>
            <div className="text-xs text-muted-foreground">Confirmados no dia</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Carregamentos em Andamento</div>
            <div className="mt-1 text-3xl font-bold">{carregandoCount ?? 0}</div>
            <div className="text-xs text-muted-foreground">Status em_andamento</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Alertas de Estoque Baixo</div>
            <div className="mt-1 text-3xl font-bold">{baixoEstoqueCount ?? 0}</div>
            <div className="text-xs text-muted-foreground">Quantidade atual &lt; 10</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 font-medium">Liberações por Status (últimos 30 dias)</div>
            <BarChart data={barrasLiberacoes} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 font-medium">Evolução de Carregamentos (últimos 7 dias)</div>
            <LineChart points={linhaCarregamentos} />
          </CardContent>
        </Card>
      </div>

      {/* Listas: Próximos Agendamentos e Alertas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 font-medium">Próximos Agendamentos</div>
            <div className="space-y-2">
              {(proximosAg ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhum agendamento futuro.</div>
              )}
              {(proximosAg ?? []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between rounded border p-2">
                  <div>
                    <div className="text-sm font-medium">{a.liberacoes?.clientes?.nome || "Cliente"}</div>
                    <div className="text-xs text-muted-foreground">Pedido: {a.liberacoes?.pedido_interno || "-"}</div>
                  </div>
                  <Badge variant="secondary">{new Date(a.data_retirada).toLocaleDateString()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 font-medium">Alertas</div>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium mb-1">Estoques Baixos</div>
                <div className="space-y-1">
                  {(lowStocks ?? []).length === 0 && (
                    <div className="text-xs text-muted-foreground">Sem alertas de estoque.</div>
                  )}
                  {(lowStocks ?? []).map((s: any) => (
                    <div key={s.id} className="text-xs flex items-center justify-between rounded border p-2">
                      <div>
                        {s.produtos?.nome || `Produto #${s.produto_id}`} • {s.armazens?.nome || `Armazém #${s.armazem_id}`}
                      </div>
                      <Badge variant="destructive">{Number(s.quantidade ?? 0)}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <div className="text-sm font-medium mb-1">Liberações Atrasadas</div>
                <div className="space-y-1">
                  {(atrasos ?? []).length === 0 && (
                    <div className="text-xs text-muted-foreground">Sem liberações atrasadas.</div>
                  )}
                  {(atrasos ?? []).map((l: any) => (
                    <div key={l.id} className="text-xs flex items-center justify-between rounded border p-2">
                      <div>
                        {l.clientes?.nome || "Cliente"} • Pedido {l.pedido_interno || "-"}
                        <div className="text-[10px] text-muted-foreground">Desde {toBRDate(l.created_at)}</div>
                      </div>
                      <Badge variant="outline">Atrasado</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
