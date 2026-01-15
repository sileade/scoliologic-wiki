import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, AlertTriangle, Activity, BarChart3 } from "lucide-react";
import Chart from "chart.js/auto";

export function TraefikTrafficCharts() {
  const [selectedService, setSelectedService] = useState<string>("all");
  const requestsChartRef = useRef<HTMLCanvasElement>(null);
  const errorsChartRef = useRef<HTMLCanvasElement>(null);
  const latencyChartRef = useRef<HTMLCanvasElement>(null);
  const requestsChartInstance = useRef<Chart | null>(null);
  const errorsChartInstance = useRef<Chart | null>(null);
  const latencyChartInstance = useRef<Chart | null>(null);

  const { data: serviceStats, isLoading, refetch } = trpc.admin.getTraefikServiceStats.useQuery();
  const { data: prometheusMetrics } = trpc.admin.getTraefikPrometheusMetrics.useQuery();

  // Requests Chart
  useEffect(() => {
    if (!requestsChartRef.current || !serviceStats?.services) return;

    if (requestsChartInstance.current) {
      requestsChartInstance.current.destroy();
    }

    const ctx = requestsChartRef.current.getContext("2d");
    if (!ctx) return;

    const filteredServices = selectedService === "all" 
      ? serviceStats.services 
      : serviceStats.services.filter(s => s.name === selectedService);

    const labels = filteredServices.map(s => s.name.split("@")[0]);
    const data = filteredServices.map(s => s.requestsTotal);

    requestsChartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Всего запросов",
          data,
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgb(59, 130, 246)",
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
            title: { display: true, text: "Запросы" },
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
            },
          },
        },
      },
    });

    return () => {
      if (requestsChartInstance.current) {
        requestsChartInstance.current.destroy();
      }
    };
  }, [serviceStats?.services, selectedService]);

  // Errors Chart
  useEffect(() => {
    if (!errorsChartRef.current || !serviceStats?.services) return;

    if (errorsChartInstance.current) {
      errorsChartInstance.current.destroy();
    }

    const ctx = errorsChartRef.current.getContext("2d");
    if (!ctx) return;

    const filteredServices = selectedService === "all" 
      ? serviceStats.services 
      : serviceStats.services.filter(s => s.name === selectedService);

    const labels = filteredServices.map(s => s.name.split("@")[0]);
    const errors4xx = filteredServices.map(s => s.errors4xx);
    const errors5xx = filteredServices.map(s => s.errors5xx);

    errorsChartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Ошибки 4xx",
            data: errors4xx,
            backgroundColor: "rgba(251, 191, 36, 0.7)",
            borderColor: "rgb(251, 191, 36)",
            borderWidth: 1,
          },
          {
            label: "Ошибки 5xx",
            data: errors5xx,
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
          legend: { position: "top" },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Ошибки" },
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
            },
          },
        },
      },
    });

    return () => {
      if (errorsChartInstance.current) {
        errorsChartInstance.current.destroy();
      }
    };
  }, [serviceStats?.services, selectedService]);

  // Latency Chart
  useEffect(() => {
    if (!latencyChartRef.current || !serviceStats?.services) return;

    if (latencyChartInstance.current) {
      latencyChartInstance.current.destroy();
    }

    const ctx = latencyChartRef.current.getContext("2d");
    if (!ctx) return;

    const filteredServices = selectedService === "all" 
      ? serviceStats.services 
      : serviceStats.services.filter(s => s.name === selectedService);

    const labels = filteredServices.map(s => s.name.split("@")[0]);
    const data = filteredServices.map(s => s.avgLatencyMs);

    latencyChartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Средняя латентность (мс)",
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
            title: { display: true, text: "мс" },
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
            },
          },
        },
      },
    });

    return () => {
      if (latencyChartInstance.current) {
        latencyChartInstance.current.destroy();
      }
    };
  }, [serviceStats?.services, selectedService]);

  const totalRequests = serviceStats?.services?.reduce((sum, s) => sum + s.requestsTotal, 0) || 0;
  const totalErrors4xx = serviceStats?.services?.reduce((sum, s) => sum + s.errors4xx, 0) || 0;
  const totalErrors5xx = serviceStats?.services?.reduce((sum, s) => sum + s.errors5xx, 0) || 0;
  const avgLatency = serviceStats?.services?.length 
    ? Math.round(serviceStats.services.reduce((sum, s) => sum + s.avgLatencyMs, 0) / serviceStats.services.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Графики трафика Traefik</h3>
          <p className="text-sm text-muted-foreground">
            Визуализация метрик из Prometheus
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Выберите сервис" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все сервисы</SelectItem>
              {serviceStats?.services?.map((service) => (
                <SelectItem key={service.name} value={service.name}>
                  {service.name.split("@")[0]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего запросов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">{totalRequests.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ошибки 4xx</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold">{totalErrors4xx.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ошибки 5xx</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-bold">{totalErrors5xx.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ср. латентность</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">{avgLatency} мс</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {!serviceStats?.services || serviceStats.services.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет данных о трафике</p>
              <p className="text-sm">Убедитесь, что Traefik настроен и Prometheus metrics включены</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Количество запросов</CardTitle>
              <CardDescription>Общее количество запросов по сервисам</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <canvas ref={requestsChartRef} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ошибки по сервисам</CardTitle>
              <CardDescription>Распределение ошибок 4xx и 5xx</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <canvas ref={errorsChartRef} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {serviceStats?.services && serviceStats.services.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Латентность по сервисам</CardTitle>
            <CardDescription>Среднее время ответа в миллисекундах</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <canvas ref={latencyChartRef} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Metrics Info */}
      {prometheusMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Prometheus Metrics</CardTitle>
            <CardDescription>Сырые данные из Traefik</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground">Метрики запросов</p>
                <p className="font-semibold">{prometheusMetrics.requestsTotal?.length || 0}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground">Метрики длительности</p>
                <p className="font-semibold">{prometheusMetrics.requestDuration?.length || 0}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground">Активные соединения</p>
                <p className="font-semibold">{prometheusMetrics.openConnections?.length || 0}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground">TLS сертификаты</p>
                <p className="font-semibold">{prometheusMetrics.tlsCertsExpiration?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
