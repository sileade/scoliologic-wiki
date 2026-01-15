import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { RefreshCw, TrendingUp, AlertTriangle, Activity, Database, Loader2 } from "lucide-react";
import Chart from "chart.js/auto";
import { toast } from "sonner";

export function TraefikTrendsDashboard() {
  const [period, setPeriod] = useState<"hour" | "day" | "week">("day");
  const [serviceName, setServiceName] = useState<string>("");
  
  const requestsChartRef = useRef<HTMLCanvasElement>(null);
  const latencyChartRef = useRef<HTMLCanvasElement>(null);
  const errorsChartRef = useRef<HTMLCanvasElement>(null);
  const requestsChartInstance = useRef<Chart | null>(null);
  const latencyChartInstance = useRef<Chart | null>(null);
  const errorsChartInstance = useRef<Chart | null>(null);

  const { data: trends, isLoading, refetch } = trpc.traefikMetrics.getTrends.useQuery({ 
    period, 
    serviceName: serviceName || undefined 
  });
  
  const { data: history } = trpc.traefikMetrics.getHistory.useQuery({ 
    limit: 100,
    serviceName: serviceName || undefined 
  });

  const collectMetrics = trpc.traefikMetrics.collectMetrics.useMutation({
    onSuccess: (result) => {
      toast.success(`Собрано ${result.saved} метрик`);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Requests Chart
  useEffect(() => {
    if (!requestsChartRef.current || !trends) return;

    if (requestsChartInstance.current) {
      requestsChartInstance.current.destroy();
    }

    const ctx = requestsChartRef.current.getContext("2d");
    if (!ctx) return;

    requestsChartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: trends.labels,
        datasets: [{
          label: "Запросы",
          data: trends.requestsTotal,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Запросы" },
          },
        },
      },
    });

    return () => {
      if (requestsChartInstance.current) {
        requestsChartInstance.current.destroy();
      }
    };
  }, [trends]);

  // Latency Chart
  useEffect(() => {
    if (!latencyChartRef.current || !trends) return;

    if (latencyChartInstance.current) {
      latencyChartInstance.current.destroy();
    }

    const ctx = latencyChartRef.current.getContext("2d");
    if (!ctx) return;

    latencyChartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: trends.labels,
        datasets: [{
          label: "Латентность (мс)",
          data: trends.avgLatency,
          borderColor: "rgb(234, 179, 8)",
          backgroundColor: "rgba(234, 179, 8, 0.1)",
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "мс" },
          },
        },
      },
    });

    return () => {
      if (latencyChartInstance.current) {
        latencyChartInstance.current.destroy();
      }
    };
  }, [trends]);

  // Errors Chart
  useEffect(() => {
    if (!errorsChartRef.current || !trends) return;

    if (errorsChartInstance.current) {
      errorsChartInstance.current.destroy();
    }

    const ctx = errorsChartRef.current.getContext("2d");
    if (!ctx) return;

    errorsChartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: trends.labels,
        datasets: [
          {
            label: "Ошибки 4xx",
            data: trends.errors4xx,
            backgroundColor: "rgba(249, 115, 22, 0.7)",
            borderColor: "rgb(249, 115, 22)",
            borderWidth: 1,
          },
          {
            label: "Ошибки 5xx",
            data: trends.errors5xx,
            backgroundColor: "rgba(239, 68, 68, 0.7)",
            borderColor: "rgb(239, 68, 68)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top" },
        },
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,
          },
          x: {
            stacked: true,
          },
        },
      },
    });

    return () => {
      if (errorsChartInstance.current) {
        errorsChartInstance.current.destroy();
      }
    };
  }, [trends]);

  // Get unique service names from history
  const serviceNames = history 
    ? Array.from(new Set(history.map((m: any) => m.serviceName)))
    : [];

  // Calculate summary stats
  const totalRequests = trends?.requestsTotal.reduce((a, b) => a + b, 0) || 0;
  const avgLatency = trends?.avgLatency.length 
    ? Math.round(trends.avgLatency.reduce((a, b) => a + b, 0) / trends.avgLatency.length)
    : 0;
  const totalErrors4xx = trends?.errors4xx.reduce((a, b) => a + b, 0) || 0;
  const totalErrors5xx = trends?.errors5xx.reduce((a, b) => a + b, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Исторические тренды Traefik</h2>
          <p className="text-muted-foreground">Анализ трафика и производительности за период</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={serviceName} onValueChange={setServiceName}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Все сервисы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Все сервисы</SelectItem>
              {serviceNames.map((name: string) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Час</SelectItem>
              <SelectItem value="day">День</SelectItem>
              <SelectItem value="week">Неделя</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={() => collectMetrics.mutate()}
            disabled={collectMetrics.isPending}
          >
            {collectMetrics.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Собрать метрики
          </Button>
          
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего запросов</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalRequests.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              За {period === "hour" ? "час" : period === "day" ? "день" : "неделю"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Средняя латентность</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {avgLatency} мс
            </div>
            <p className="text-xs text-muted-foreground">
              Среднее время отклика
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ошибки 4xx</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalErrors4xx.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Клиентские ошибки
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ошибки 5xx</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalErrors5xx.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Серверные ошибки
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : trends?.labels.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Нет данных за выбранный период</p>
              <p className="text-sm mt-2">
                Нажмите "Собрать метрики" для сбора текущих данных из Traefik
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Количество запросов</CardTitle>
                <CardDescription>Динамика трафика за период</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <canvas ref={requestsChartRef} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Латентность</CardTitle>
                <CardDescription>Среднее время отклика в миллисекундах</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <canvas ref={latencyChartRef} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ошибки</CardTitle>
              <CardDescription>Распределение ошибок 4xx и 5xx за период</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <canvas ref={errorsChartRef} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Recent Metrics Table */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Последние записи метрик</CardTitle>
            <CardDescription>Детальные данные по сервисам</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Время</th>
                    <th className="text-left py-2 px-3">Сервис</th>
                    <th className="text-right py-2 px-3">Запросы</th>
                    <th className="text-right py-2 px-3">Латентность</th>
                    <th className="text-right py-2 px-3">4xx</th>
                    <th className="text-right py-2 px-3">5xx</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 10).map((metric: any, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3">
                        {new Date(metric.collectedAt).toLocaleString("ru-RU")}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline">{metric.serviceName}</Badge>
                      </td>
                      <td className="text-right py-2 px-3 font-mono">
                        {metric.requestsTotal}
                      </td>
                      <td className="text-right py-2 px-3 font-mono">
                        {Math.round(parseFloat(metric.avgLatency))} мс
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-orange-600">
                        {metric.errors4xx}
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-red-600">
                        {metric.errors5xx}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
