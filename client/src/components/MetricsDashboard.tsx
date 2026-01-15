import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { RefreshCw, TrendingUp, AlertTriangle, Activity, Clock, Globe, Server, CheckCircle, XCircle } from "lucide-react";
import { TraefikTrendsDashboard } from "./TraefikTrendsDashboard";
import Chart from "chart.js/auto";

export function MetricsDashboard() {
  const [timeRange, setTimeRange] = useState("24");
  const responseTimeChartRef = useRef<HTMLCanvasElement>(null);
  const errorCountChartRef = useRef<HTMLCanvasElement>(null);
  const requestCountChartRef = useRef<HTMLCanvasElement>(null);
  const responseTimeChartInstance = useRef<Chart | null>(null);
  const errorCountChartInstance = useRef<Chart | null>(null);
  const requestCountChartInstance = useRef<Chart | null>(null);

  const { data: dashboardMetrics, isLoading, refetch } = trpc.admin.getDashboardMetrics.useQuery();
  const { data: monitoringStatus } = trpc.admin.getMonitoringStatus.useQuery();
  const { data: errorStats } = trpc.admin.getErrorStats.useQuery();
  const { data: traefikMetrics } = trpc.admin.getTraefikMetrics.useQuery();
  const { data: traefikHealth } = trpc.admin.getTraefikHealth.useQuery();

  // Response Time Chart
  useEffect(() => {
    if (!responseTimeChartRef.current || !dashboardMetrics?.responseTime) return;

    if (responseTimeChartInstance.current) {
      responseTimeChartInstance.current.destroy();
    }

    const ctx = responseTimeChartRef.current.getContext("2d");
    if (!ctx) return;

    const labels = dashboardMetrics.responseTime.map(m => 
      new Date(m.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    );
    const data = dashboardMetrics.responseTime.map(m => m.value);

    responseTimeChartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Время отклика (мс)",
          data,
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
            title: { display: true, text: "мс" },
          },
        },
      },
    });

    return () => {
      if (responseTimeChartInstance.current) {
        responseTimeChartInstance.current.destroy();
      }
    };
  }, [dashboardMetrics?.responseTime]);

  // Error Count Chart
  useEffect(() => {
    if (!errorCountChartRef.current || !dashboardMetrics?.errorCount) return;

    if (errorCountChartInstance.current) {
      errorCountChartInstance.current.destroy();
    }

    const ctx = errorCountChartRef.current.getContext("2d");
    if (!ctx) return;

    const labels = dashboardMetrics.errorCount.map(m => 
      new Date(m.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    );
    const data = dashboardMetrics.errorCount.map(m => m.value);

    errorCountChartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Ошибки",
          data,
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgb(239, 68, 68)",
          borderWidth: 1,
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
            ticks: { stepSize: 1 },
          },
        },
      },
    });

    return () => {
      if (errorCountChartInstance.current) {
        errorCountChartInstance.current.destroy();
      }
    };
  }, [dashboardMetrics?.errorCount]);

  // Request Count Chart
  useEffect(() => {
    if (!requestCountChartRef.current || !dashboardMetrics?.requestCount) return;

    if (requestCountChartInstance.current) {
      requestCountChartInstance.current.destroy();
    }

    const ctx = requestCountChartRef.current.getContext("2d");
    if (!ctx) return;

    const labels = dashboardMetrics.requestCount.map(m => 
      new Date(m.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    );
    const data = dashboardMetrics.requestCount.map(m => m.value);

    requestCountChartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Запросы",
          data,
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
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
          },
        },
      },
    });

    return () => {
      if (requestCountChartInstance.current) {
        requestCountChartInstance.current.destroy();
      }
    };
  }, [dashboardMetrics?.requestCount]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Дашборд метрик</h2>
          <p className="text-muted-foreground">Мониторинг производительности и ошибок</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Последний час</SelectItem>
              <SelectItem value="6">6 часов</SelectItem>
              <SelectItem value="24">24 часа</SelectItem>
              <SelectItem value="72">3 дня</SelectItem>
              <SelectItem value="168">Неделя</SelectItem>
            </SelectContent>
          </Select>
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
            <CardTitle className="text-sm font-medium">Статус системы</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {monitoringStatus?.ollamaHealthy ? (
                <span className="text-green-500">Активен</span>
              ) : (
                <span className="text-red-500">Ошибка</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Последняя проверка: {monitoringStatus?.lastOllamaCheck 
                ? new Date(monitoringStatus.lastOllamaCheck).toLocaleTimeString("ru-RU")
                : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Среднее время отклика</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardMetrics?.responseTime && dashboardMetrics.responseTime.length > 0
                ? Math.round(dashboardMetrics.responseTime.reduce((a, b) => a + b.value, 0) / dashboardMetrics.responseTime.length)
                : 0} мс
            </div>
            <p className="text-xs text-muted-foreground">За последние 24 часа</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего ошибок</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {errorStats?.total ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Исправлено: {errorStats?.autoFixed ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего запросов</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardMetrics?.requestCount?.reduce((a, b) => a + b.value, 0) ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">За последние 24 часа</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Время отклика</CardTitle>
            <CardDescription>Среднее время ответа сервера в миллисекундах</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <canvas ref={responseTimeChartRef} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Количество ошибок</CardTitle>
            <CardDescription>Ошибки за период</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <canvas ref={errorCountChartRef} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Количество запросов</CardTitle>
          <CardDescription>Нагрузка на сервер за период</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <canvas ref={requestCountChartRef} />
          </div>
        </CardContent>
      </Card>

      {/* Traefik Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Статус Traefik
          </CardTitle>
          <CardDescription>Мониторинг балансировщика нагрузки</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <div className={`p-2 rounded-full ${traefikHealth?.healthy ? 'bg-green-100' : 'bg-red-100'}`}>
                {traefikHealth?.healthy ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Статус</p>
                <p className="font-semibold">
                  {traefikHealth?.healthy ? 'Активен' : 'Недоступен'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <div className="p-2 rounded-full bg-blue-100">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Роутеры</p>
                <p className="font-semibold">
                  {traefikMetrics?.stats?.activeRouters ?? 0} / {traefikMetrics?.stats?.totalRouters ?? 0}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <div className="p-2 rounded-full bg-purple-100">
                <Server className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Сервисы</p>
                <p className="font-semibold">
                  {traefikMetrics?.stats?.activeServices ?? 0} / {traefikMetrics?.stats?.totalServices ?? 0}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <div className="p-2 rounded-full bg-gray-100">
                <Activity className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Версия</p>
                <p className="font-semibold">
                  {traefikHealth?.version || '—'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Service Health */}
          {traefikMetrics?.serviceHealth && Object.keys(traefikMetrics.serviceHealth).length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Здоровье сервисов</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(traefikMetrics.serviceHealth).slice(0, 8).map(([name, status]) => (
                  <div key={name} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                    <div className={`w-2 h-2 rounded-full ${
                      status === 'healthy' ? 'bg-green-500' : 
                      status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="truncate" title={name}>{name.split('@')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {traefikHealth?.error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {traefikHealth.error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Traefik Historical Trends */}
      <TraefikTrendsDashboard />

      {/* Error Details */}
      {errorStats && Object.keys(errorStats.bySource).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ошибки по источникам</CardTitle>
            <CardDescription>Распределение ошибок по компонентам системы</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(errorStats.bySource).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <p className="font-medium">{source}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                    {count} ошибок
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
