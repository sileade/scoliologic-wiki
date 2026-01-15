import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Save, TestTube, ExternalLink, Loader2, CheckCircle, XCircle, Server, Network, Shield, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";

interface TraefikRouter {
  name: string;
  entryPoints: string[];
  rule: string;
  service: string;
  status: string;
}

interface TraefikService {
  name: string;
  type: string;
  status: string;
  servers?: { url: string }[];
}

export function TraefikSettingsPanel() {
  const [settings, setSettings] = useState({
    enabled: false,
    connectionType: "local" as "local" | "remote",
    // Local settings
    apiUrl: "",
    // Remote settings
    remoteHost: "",
    remotePort: "8080",
    useSSL: false,
    // Auth
    authType: "none" as "none" | "basic" | "digest",
    apiUser: "",
    apiPassword: "",
    // Other
    entryPoint: "websecure",
    dashboardUrl: "",
    // Advanced
    timeout: 10,
    retryCount: 3,
  });
  
  const [testResult, setTestResult] = useState<{ 
    success: boolean; 
    version?: string; 
    error?: string;
    routers?: number;
    services?: number;
  } | null>(null);
  
  const [routers, setRouters] = useState<TraefikRouter[]>([]);
  const [services, setServices] = useState<TraefikService[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(false);

  const { data: savedSettings, isLoading } = trpc.admin.getTraefikSettings.useQuery();
  const saveMutation = trpc.admin.saveTraefikSettings.useMutation({
    onSuccess: () => toast.success("Настройки Traefik сохранены"),
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });
  const testMutation = trpc.admin.testTraefikConnection.useMutation({
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ success: false, error: err.message }),
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({
        enabled: savedSettings.enabled,
        connectionType: (savedSettings.connectionType || "local") as "local" | "remote",
        apiUrl: savedSettings.apiUrl,
        remoteHost: savedSettings.remoteHost || "",
        remotePort: savedSettings.remotePort || "8080",
        useSSL: savedSettings.useSSL || false,
        authType: (savedSettings.authType || "none") as "none" | "basic" | "digest",
        apiUser: savedSettings.apiUser,
        apiPassword: "",
        entryPoint: savedSettings.entryPoint,
        dashboardUrl: savedSettings.dashboardUrl,
        timeout: savedSettings.timeout || 10,
        retryCount: savedSettings.retryCount || 3,
      });
    }
  }, [savedSettings]);

  // Compute effective API URL based on connection type
  const getEffectiveApiUrl = () => {
    if (settings.connectionType === "local") {
      return settings.apiUrl;
    } else {
      const protocol = settings.useSSL ? "https" : "http";
      return `${protocol}://${settings.remoteHost}:${settings.remotePort}`;
    }
  };

  const handleSave = () => {
    const effectiveUrl = getEffectiveApiUrl();
    saveMutation.mutate({
      ...settings,
      apiUrl: effectiveUrl,
    });
  };

  const handleTest = () => {
    setTestResult(null);
    const effectiveUrl = getEffectiveApiUrl();
    testMutation.mutate({
      apiUrl: effectiveUrl,
      apiUser: settings.authType !== "none" ? settings.apiUser : "",
      apiPassword: settings.authType !== "none" ? settings.apiPassword : "",
    });
  };

  const handleLoadInfo = async () => {
    setLoadingInfo(true);
    try {
      // Simulate loading routers and services info
      // In real implementation, this would call API endpoints
      const effectiveUrl = getEffectiveApiUrl();
      const response = await fetch(`/api/trpc/admin.getTraefikInfo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl: effectiveUrl }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result?.data) {
          setRouters(data.result.data.routers || []);
          setServices(data.result.data.services || []);
        }
      }
    } catch (error) {
      toast.error("Не удалось загрузить информацию о роутерах");
    } finally {
      setLoadingInfo(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Настройки Traefik
          </CardTitle>
          <CardDescription>
            Интеграция с существующим Traefik для балансировки нагрузки и управления маршрутизацией
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Включить интеграцию с Traefik</Label>
              <p className="text-sm text-muted-foreground">
                Позволяет AI-агенту управлять маршрутизацией через Traefik API
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>

          <Tabs defaultValue="connection" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="connection">
                <Server className="h-4 w-4 mr-2" />
                Подключение
              </TabsTrigger>
              <TabsTrigger value="auth">
                <Shield className="h-4 w-4 mr-2" />
                Авторизация
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <Info className="h-4 w-4 mr-2" />
                Дополнительно
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connection" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Тип подключения</Label>
                <Select
                  value={settings.connectionType}
                  onValueChange={(value: "local" | "remote") => 
                    setSettings({ ...settings, connectionType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Локальный (localhost или Docker)</SelectItem>
                    <SelectItem value="remote">Удалённый сервер (LAN/WAN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.connectionType === "local" ? (
                <div className="space-y-2">
                  <Label htmlFor="apiUrl">API URL</Label>
                  <Input
                    id="apiUrl"
                    placeholder="http://localhost:8080 или http://traefik:8080"
                    value={settings.apiUrl}
                    onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Для Docker: используйте имя контейнера (traefik). Для локальной установки: localhost
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="remoteHost">IP адрес или Hostname</Label>
                    <Input
                      id="remoteHost"
                      placeholder="192.168.1.100 или traefik.local"
                      value={settings.remoteHost}
                      onChange={(e) => setSettings({ ...settings, remoteHost: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      IP адрес или DNS имя сервера с Traefik в локальной сети
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remotePort">Порт API</Label>
                    <Input
                      id="remotePort"
                      placeholder="8080"
                      value={settings.remotePort}
                      onChange={(e) => setSettings({ ...settings, remotePort: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-3 flex items-center space-x-2">
                    <Switch
                      id="useSSL"
                      checked={settings.useSSL}
                      onCheckedChange={(checked) => setSettings({ ...settings, useSSL: checked })}
                    />
                    <Label htmlFor="useSSL">Использовать HTTPS (SSL/TLS)</Label>
                  </div>
                </div>
              )}

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Итоговый URL API:</p>
                <code className="text-sm bg-background px-2 py-1 rounded">
                  {getEffectiveApiUrl() || "Не настроено"}
                </code>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entryPoint">Entry Point</Label>
                  <Select
                    value={settings.entryPoint}
                    onValueChange={(value) => setSettings({ ...settings, entryPoint: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web">web (HTTP, порт 80)</SelectItem>
                      <SelectItem value="websecure">websecure (HTTPS, порт 443)</SelectItem>
                      <SelectItem value="traefik">traefik (Dashboard)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dashboardUrl">Dashboard URL</Label>
                  <Input
                    id="dashboardUrl"
                    placeholder="http://traefik.local:8080/dashboard/"
                    value={settings.dashboardUrl}
                    onChange={(e) => setSettings({ ...settings, dashboardUrl: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="auth" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Тип авторизации</Label>
                <Select
                  value={settings.authType}
                  onValueChange={(value: "none" | "basic" | "digest") => 
                    setSettings({ ...settings, authType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без авторизации</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="digest">Digest Auth</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Выберите тип авторизации, настроенный для Traefik API
                </p>
              </div>

              {settings.authType !== "none" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiUser">Имя пользователя</Label>
                    <Input
                      id="apiUser"
                      placeholder="admin"
                      value={settings.apiUser}
                      onChange={(e) => setSettings({ ...settings, apiUser: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apiPassword">Пароль</Label>
                    <Input
                      id="apiPassword"
                      type="password"
                      placeholder="••••••••"
                      value={settings.apiPassword}
                      onChange={(e) => setSettings({ ...settings, apiPassword: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Совет:</strong> Для безопасности рекомендуется использовать Basic Auth или ограничить доступ к API по IP-адресам в конфигурации Traefik.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeout">Таймаут подключения (сек)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={1}
                    max={60}
                    value={settings.timeout}
                    onChange={(e) => setSettings({ ...settings, timeout: parseInt(e.target.value) || 10 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Время ожидания ответа от Traefik API
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retryCount">Количество попыток</Label>
                  <Input
                    id="retryCount"
                    type="number"
                    min={1}
                    max={10}
                    value={settings.retryCount}
                    onChange={(e) => setSettings({ ...settings, retryCount: parseInt(e.target.value) || 3 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Количество повторных попыток при ошибке
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {testResult && (
            <div className={`p-4 rounded-lg ${testResult.success ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"}`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <span className="text-green-700 dark:text-green-300 font-medium">
                        Подключение успешно!
                      </span>
                      <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                        Версия Traefik: {testResult.version}
                        {testResult.routers !== undefined && (
                          <span className="ml-4">Роутеров: {testResult.routers}</span>
                        )}
                        {testResult.services !== undefined && (
                          <span className="ml-4">Сервисов: {testResult.services}</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <span className="text-red-700 dark:text-red-300 font-medium">
                        Ошибка подключения
                      </span>
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {testResult.error}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Сохранить
            </Button>
            <Button 
              variant="outline" 
              onClick={handleTest} 
              disabled={testMutation.isPending || (!settings.apiUrl && !settings.remoteHost)}
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
              Проверить подключение
            </Button>
            {testResult?.success && (
              <Button variant="outline" onClick={handleLoadInfo} disabled={loadingInfo}>
                {loadingInfo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Загрузить информацию
              </Button>
            )}
            {settings.dashboardUrl && (
              <Button variant="ghost" asChild>
                <a href={settings.dashboardUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Открыть Dashboard
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Routers and Services Info */}
      {(routers.length > 0 || services.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Роутеры ({routers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {routers.map((router) => (
                  <div key={router.name} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{router.name}</span>
                      <Badge variant={router.status === "enabled" ? "default" : "secondary"}>
                        {router.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {router.rule}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Сервисы ({services.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {services.map((service) => (
                  <div key={service.name} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{service.name}</span>
                      <Badge variant={service.status === "enabled" ? "default" : "secondary"}>
                        {service.type}
                      </Badge>
                    </div>
                    {service.servers && service.servers.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Серверов: {service.servers.length}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
