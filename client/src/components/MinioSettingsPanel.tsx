import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Save, TestTube, Loader2, CheckCircle, XCircle, Database } from "lucide-react";
import { toast } from "sonner";

export function MinioSettingsPanel() {
  const [settings, setSettings] = useState({
    enabled: false,
    endpoint: "",
    port: 9000,
    useSSL: false,
    accessKey: "",
    secretKey: "",
    bucket: "wiki-files",
    region: "us-east-1",
    publicUrl: "",
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const { data: savedSettings, isLoading } = trpc.admin.getMinioSettings.useQuery();
  const saveMutation = trpc.admin.saveMinioSettings.useMutation({
    onSuccess: () => toast.success("Настройки MinIO сохранены"),
    onError: (err) => toast.error(`Ошибка: ${err.message}`),
  });
  const testMutation = trpc.admin.testMinioConnection.useMutation({
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ success: false, error: err.message }),
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({
        enabled: savedSettings.enabled,
        endpoint: savedSettings.endpoint,
        port: savedSettings.port,
        useSSL: savedSettings.useSSL,
        accessKey: savedSettings.accessKey,
        secretKey: "",
        bucket: savedSettings.bucket,
        region: savedSettings.region,
        publicUrl: savedSettings.publicUrl,
      });
    }
  }, [savedSettings]);

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const handleTest = () => {
    setTestResult(null);
    testMutation.mutate({
      endpoint: settings.endpoint,
      port: settings.port,
      useSSL: settings.useSSL,
      accessKey: settings.accessKey,
      secretKey: settings.secretKey,
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
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Настройки MinIO S3</CardTitle>
          </div>
          <CardDescription>
            Хранилище файлов на S3-совместимом сервере MinIO
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Включить MinIO хранилище</Label>
              <p className="text-sm text-muted-foreground">
                Использовать MinIO для хранения файлов вместо встроенного хранилища
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Input
                id="endpoint"
                placeholder="minio.local или 192.168.1.100"
                value={settings.endpoint}
                onChange={(e) => setSettings({ ...settings, endpoint: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Адрес сервера MinIO (без протокола)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">Порт</Label>
              <Input
                id="port"
                type="number"
                placeholder="9000"
                value={settings.port}
                onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value) || 9000 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessKey">Access Key</Label>
              <Input
                id="accessKey"
                placeholder="minioadmin"
                value={settings.accessKey}
                onChange={(e) => setSettings({ ...settings, accessKey: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secretKey">Secret Key</Label>
              <Input
                id="secretKey"
                type="password"
                placeholder="••••••••"
                value={settings.secretKey}
                onChange={(e) => setSettings({ ...settings, secretKey: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bucket">Bucket</Label>
              <Input
                id="bucket"
                placeholder="wiki-files"
                value={settings.bucket}
                onChange={(e) => setSettings({ ...settings, bucket: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Имя bucket для хранения файлов</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                placeholder="us-east-1"
                value={settings.region}
                onChange={(e) => setSettings({ ...settings, region: e.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="publicUrl">Public URL</Label>
              <Input
                id="publicUrl"
                placeholder="https://files.example.com"
                value={settings.publicUrl}
                onChange={(e) => setSettings({ ...settings, publicUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Публичный URL для доступа к файлам (опционально)</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="useSSL"
                checked={settings.useSSL}
                onCheckedChange={(checked) => setSettings({ ...settings, useSSL: checked })}
              />
              <Label htmlFor="useSSL">Использовать SSL (HTTPS)</Label>
            </div>
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg ${testResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-700">{testResult.message}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">Ошибка: {testResult.error}</span>
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
            <Button variant="outline" onClick={handleTest} disabled={testMutation.isPending || !settings.endpoint}>
              {testMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
              Проверить подключение
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
