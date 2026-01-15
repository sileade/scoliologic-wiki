import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Globe, Server, Shield, AlertCircle, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Router {
  name: string;
  provider: string;
  status: string;
  rule: string;
  service: string;
  entryPoints: string[];
  tls?: { certResolver?: string };
  middlewares?: string[];
}

interface Service {
  name: string;
  provider: string;
  status: string;
  type: string;
  serverStatus?: Record<string, string>;
  loadBalancer?: {
    servers?: Array<{ url: string }>;
    passHostHeader?: boolean;
  };
}

export function TraefikRoutersPanel() {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const { data: traefikSettings } = trpc.admin.getTraefikSettings.useQuery();

  const { data: traefikData, refetch, isRefetching } = trpc.admin.getTraefikRouters.useQuery(undefined, {
    enabled: traefikSettings?.enabled ?? false,
  });

  // Update local state when data changes
  const routers: Router[] = (traefikData?.routers || []) as Router[];
  const services: Service[] = (traefikData?.services || []) as Service[];

  useEffect(() => {
    if (traefikData && !traefikData.error) {
      setLastRefresh(new Date());
    }
  }, [traefikData]);

  const handleRefresh = async () => {
    if (!traefikSettings?.enabled || !traefikSettings?.apiUrl) {
      toast.error("Traefik не настроен", {
        description: "Сначала настройте подключение к Traefik в разделе настроек",
      });
      return;
    }
    
    await refetch();
    toast.success("Данные обновлены");
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "enabled":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Активен</Badge>;
      case "disabled":
        return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />Отключен</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" />Предупреждение</Badge>;
      default:
        return <Badge variant="outline">{status || "Неизвестно"}</Badge>;
    }
  };

  const getProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      docker: "bg-blue-500",
      file: "bg-purple-500",
      kubernetes: "bg-green-600",
      consul: "bg-pink-500",
      etcd: "bg-orange-500",
    };
    return (
      <Badge className={colors[provider?.toLowerCase()] || "bg-gray-500"}>
        {provider}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Роутеры и Сервисы Traefik</h3>
          <p className="text-sm text-muted-foreground">
            Просмотр и управление конфигурацией Traefik
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-sm text-muted-foreground">
              Обновлено: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={handleRefresh} disabled={isRefetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      {!traefikSettings?.enabled && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertCircle className="w-5 h-5" />
              <span>Traefik не настроен. Перейдите в раздел "Traefik" для настройки подключения.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error message */}
      {traefikData?.error && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <XCircle className="w-5 h-5" />
              <span>Ошибка подключения: {traefikData.error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего роутеров</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">{routers.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Активных роутеров</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">
                {routers.filter(r => r.status?.toLowerCase() === "enabled").length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего сервисов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-500" />
              <span className="text-2xl font-bold">{services.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">С TLS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">
                {routers.filter(r => r.tls).length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Routers and Services */}
      <Tabs defaultValue="routers" className="w-full">
        <TabsList>
          <TabsTrigger value="routers">
            <Globe className="w-4 h-4 mr-2" />
            Роутеры ({routers.length})
          </TabsTrigger>
          <TabsTrigger value="services">
            <Server className="w-4 h-4 mr-2" />
            Сервисы ({services.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="routers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>HTTP Роутеры</CardTitle>
              <CardDescription>Список всех HTTP роутеров в Traefik</CardDescription>
            </CardHeader>
            <CardContent>
              {routers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Нет данных о роутерах</p>
                  <p className="text-sm">Нажмите "Обновить" для загрузки данных</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Провайдер</TableHead>
                      <TableHead>Правило</TableHead>
                      <TableHead>Сервис</TableHead>
                      <TableHead>Entry Points</TableHead>
                      <TableHead>TLS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routers.map((router) => (
                      <TableRow key={router.name}>
                        <TableCell className="font-medium">{router.name}</TableCell>
                        <TableCell>{getStatusBadge(router.status)}</TableCell>
                        <TableCell>{getProviderBadge(router.provider)}</TableCell>
                        <TableCell className="max-w-xs truncate" title={router.rule}>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {router.rule}
                          </code>
                        </TableCell>
                        <TableCell>{router.service}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {router.entryPoints?.map((ep) => (
                              <Badge key={ep} variant="outline" className="text-xs">
                                {ep}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {router.tls ? (
                            <Badge className="bg-green-600">
                              <Shield className="w-3 h-3 mr-1" />
                              {router.tls.certResolver || "TLS"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Нет</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>HTTP Сервисы</CardTitle>
              <CardDescription>Список всех HTTP сервисов в Traefik</CardDescription>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Нет данных о сервисах</p>
                  <p className="text-sm">Нажмите "Обновить" для загрузки данных</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Провайдер</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead>Серверы</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service) => (
                      <TableRow key={service.name}>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell>{getStatusBadge(service.status)}</TableCell>
                        <TableCell>{getProviderBadge(service.provider)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{service.type || "loadBalancer"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {service.loadBalancer?.servers?.map((server, idx) => (
                              <div key={idx} className="flex items-center gap-1">
                                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                  {server.url}
                                </code>
                                {service.serverStatus?.[server.url] && (
                                  <Badge 
                                    className={service.serverStatus[server.url] === "UP" ? "bg-green-500" : "bg-red-500"}
                                    variant="outline"
                                  >
                                    {service.serverStatus[server.url]}
                                  </Badge>
                                )}
                              </div>
                            )) || <span className="text-muted-foreground text-sm">—</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dashboard Link */}
      {traefikSettings?.dashboardUrl && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Traefik Dashboard</h4>
                <p className="text-sm text-muted-foreground">
                  Открыть полный дашборд Traefik для расширенного управления
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href={traefikSettings.dashboardUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Открыть Dashboard
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
