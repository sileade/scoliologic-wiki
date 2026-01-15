import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Save, TestTube, ExternalLink, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export function TraefikSettingsPanel() {
  const [settings, setSettings] = useState({
    enabled: false,
    apiUrl: "",
    apiUser: "",
    apiPassword: "",
    entryPoint: "websecure",
    dashboardUrl: "",
  });
  const [testResult, setTestResult] = useState<{ success: boolean; version?: string; error?: string } | null>(null);

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
        apiUrl: savedSettings.apiUrl,
        apiUser: savedSettings.apiUser,
        apiPassword: "",
        entryPoint: savedSettings.entryPoint,
        dashboardUrl: savedSettings.dashboardUrl,
      });
    }
  }, [savedSettings]);

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const handleTest = () => {
    setTestResult(null);
    testMutation.mutate({
      apiUrl: settings.apiUrl,
      apiUser: settings.apiUser,
      apiPassword: settings.apiPassword,
    });
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
          <CardTitle>Настройки Traefik</CardTitle>
          <CardDescription>
            Интеграция с Traefik для балансировки нагрузки и управления маршрутизацией
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">API URL</Label>
              <Input
                id="apiUrl"
                placeholder="http://traefik.local:8080"
                value={settings.apiUrl}
                onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">URL API Traefik (обычно порт 8080)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dashboardUrl">Dashboard URL</Label>
              <Input
                id="dashboardUrl"
                placeholder="http://traefik.local:8080/dashboard/"
                value={settings.dashboardUrl}
                onChange={(e) => setSettings({ ...settings, dashboardUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">URL дашборда Traefik</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiUser">API Username</Label>
              <Input
                id="apiUser"
                placeholder="admin"
                value={settings.apiUser}
                onChange={(e) => setSettings({ ...settings, apiUser: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiPassword">API Password</Label>
              <Input
                id="apiPassword"
                type="password"
                placeholder="••••••••"
                value={settings.apiPassword}
                onChange={(e) => setSettings({ ...settings, apiPassword: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entryPoint">Entry Point</Label>
              <Input
                id="entryPoint"
                placeholder="websecure"
                value={settings.entryPoint}
                onChange={(e) => setSettings({ ...settings, entryPoint: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Точка входа Traefik (web, websecure)</p>
            </div>
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg ${testResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-700">
                      Подключение успешно! Версия Traefik: {testResult.version}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">
                      Ошибка подключения: {testResult.error}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Сохранить
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testMutation.isPending || !settings.apiUrl}>
              {testMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
              Проверить подключение
            </Button>
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
    </div>
  );
}
