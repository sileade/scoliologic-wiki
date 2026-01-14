import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Bell,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

interface OllamaStatus {
  connected: boolean;
  version?: string;
  models?: string[];
  error?: string;
  responseTime?: number;
}

interface OllamaSettings {
  enabled: boolean;
  url: string;
  embeddingModel: string;
  chatModel: string;
  healthCheckInterval: number;
  notifyOnFailure: boolean;
}

// Monitoring Status Card Component
function MonitoringStatusCard() {
  const { data: monitoringStatus, refetch: refetchMonitoring } = trpc.admin.getMonitoringStatus.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data: errorStats } = trpc.admin.getErrorStats.useQuery();
  const triggerHealthCheck = trpc.admin.triggerHealthCheck.useMutation({
    onSuccess: () => {
      toast.success("Проверка запущена");
      refetchMonitoring();
    },
  });

  if (!monitoringStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Мониторинг системы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Загрузка...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Мониторинг системы
            </CardTitle>
            <CardDescription>
              Автоматический контроль и исправление ошибок
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerHealthCheck.mutate()}
            disabled={triggerHealthCheck.isPending}
          >
            {triggerHealthCheck.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className={`p-2 rounded-full ${monitoringStatus.ollamaHealthy ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {monitoringStatus.ollamaHealthy ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ollama</p>
              <p className="font-medium">
                {monitoringStatus.ollamaHealthy ? 'Здоров' : 'Недоступен'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Запросы</p>
              <p className="font-medium">{monitoringStatus.metrics.requestCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Ср. отклик</p>
              <p className="font-medium">{Math.round(monitoringStatus.metrics.averageResponseTime)} мс</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Ошибки/час</p>
              <p className="font-medium">{monitoringStatus.metrics.errorRate}</p>
            </div>
          </div>
        </div>

        {/* Error Stats */}
        {errorStats && errorStats.total > 0 && (
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="font-medium mb-2">Статистика ошибок</p>
            <div className="grid gap-2 md:grid-cols-3 text-sm">
              <div>
                <span className="text-muted-foreground">Всего: </span>
                <span className="font-medium">{errorStats.total}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Исправлено: </span>
                <span className="font-medium text-green-600">{errorStats.resolved}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Авто-исправлено: </span>
                <span className="font-medium text-blue-600">{errorStats.autoFixed}</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Errors */}
        {monitoringStatus.recentErrors.length > 0 && (
          <div>
            <p className="font-medium mb-2">Последние ошибки</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {monitoringStatus.recentErrors.slice(0, 5).map((error, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-muted/30 rounded text-sm">
                  {error.resolved ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{error.source}: {error.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(error.timestamp).toLocaleString()}
                      {error.autoFixSuccess && ' • Авто-исправлено'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Check */}
        <p className="text-xs text-muted-foreground text-right">
          Последняя проверка: {monitoringStatus.lastOllamaCheck ? new Date(monitoringStatus.lastOllamaCheck).toLocaleString() : 'Никогда'}
        </p>
      </CardContent>
    </Card>
  );
}

export function OllamaSettingsPanel() {
  const [settings, setSettings] = useState<OllamaSettings>({
    enabled: true,
    url: "http://localhost:11434",
    embeddingModel: "nomic-embed-text",
    chatModel: "llama3.2",
    healthCheckInterval: 60,
    notifyOnFailure: true,
  });
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings
  const { data: savedSettings, refetch: refetchSettings } = trpc.admin.getOllamaSettings.useQuery();
  
  // Load health status
  const { data: healthStatus, refetch: refetchHealth } = trpc.admin.getOllamaHealth.useQuery(undefined, {
    refetchInterval: 60000, // Auto-refresh every minute
  });

  // Mutations
  const saveSettings = trpc.admin.saveOllamaSettings.useMutation({
    onSuccess: () => {
      toast.success("Настройки Ollama сохранены");
      refetchSettings();
      refetchHealth();
    },
    onError: (error) => {
      toast.error(`Ошибка сохранения: ${error.message}`);
    },
  });

  const testConnection = trpc.admin.testOllamaConnection.useMutation({
    onSuccess: (result) => {
      setStatus(result);
      if (result.connected) {
        toast.success(`Подключение успешно! Версия: ${result.version}`);
      } else {
        toast.error(`Ошибка подключения: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings(savedSettings);
    }
  }, [savedSettings]);

  useEffect(() => {
    if (healthStatus) {
      setStatus(healthStatus);
    }
  }, [healthStatus]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings.mutateAsync(settings);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsCheckingHealth(true);
    try {
      await testConnection.mutateAsync({ url: settings.url });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const getStatusBadge = () => {
    if (!status) {
      return <Badge variant="secondary">Не проверено</Badge>;
    }
    if (status.connected) {
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Подключено
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Недоступно
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Статус Ollama
              </CardTitle>
              <CardDescription>
                Текущее состояние AI-сервиса
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Server className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Версия</p>
                  <p className="font-medium">{status.version || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Cpu className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Модели</p>
                  <p className="font-medium">{status.models?.length || 0} загружено</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Отклик</p>
                  <p className="font-medium">{status.responseTime || 0} мс</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Статус</p>
                  <p className="font-medium text-green-600">Активен</p>
                </div>
              </div>
            </div>
          ) : status?.error ? (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Ошибка подключения</p>
                <p className="text-sm text-muted-foreground">{status.error}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <p className="text-muted-foreground">Нажмите "Проверить подключение" для проверки статуса</p>
            </div>
          )}

          {/* Available Models */}
          {status?.connected && status.models && status.models.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Доступные модели:</p>
              <div className="flex flex-wrap gap-2">
                {status.models.map((model) => (
                  <Badge key={model} variant="outline">
                    {model}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Настройки подключения
          </CardTitle>
          <CardDescription>
            Конфигурация подключения к Ollama серверу
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Включить AI-функции</Label>
              <p className="text-sm text-muted-foreground">
                Семантический поиск и AI-помощник
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, enabled: checked }))}
            />
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="ollama-url">URL сервера Ollama</Label>
            <div className="flex gap-2">
              <Input
                id="ollama-url"
                value={settings.url}
                onChange={(e) => setSettings(s => ({ ...s, url: e.target.value }))}
                placeholder="http://localhost:11434"
              />
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isCheckingHealth || testConnection.isPending}
              >
                {(isCheckingHealth || testConnection.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Для удалённого сервера укажите IP: http://192.168.1.100:11434
            </p>
          </div>

          {/* Models */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="embedding-model">Модель для эмбеддингов</Label>
              <Input
                id="embedding-model"
                value={settings.embeddingModel}
                onChange={(e) => setSettings(s => ({ ...s, embeddingModel: e.target.value }))}
                placeholder="nomic-embed-text"
              />
              <p className="text-sm text-muted-foreground">
                Используется для семантического поиска
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chat-model">Модель для генерации</Label>
              <Input
                id="chat-model"
                value={settings.chatModel}
                onChange={(e) => setSettings(s => ({ ...s, chatModel: e.target.value }))}
                placeholder="llama3.2"
              />
              <p className="text-sm text-muted-foreground">
                Используется для AI-помощника
              </p>
            </div>
          </div>

          {/* Health Check Interval */}
          <div className="space-y-2">
            <Label htmlFor="health-interval">Интервал проверки (секунды)</Label>
            <Input
              id="health-interval"
              type="number"
              min={10}
              max={3600}
              value={settings.healthCheckInterval}
              onChange={(e) => setSettings(s => ({ ...s, healthCheckInterval: parseInt(e.target.value) || 60 }))}
            />
            <p className="text-sm text-muted-foreground">
              Как часто проверять доступность Ollama (10-3600 сек)
            </p>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Уведомления о сбоях
              </Label>
              <p className="text-sm text-muted-foreground">
                Отправлять уведомление администратору при недоступности Ollama
              </p>
            </div>
            <Switch
              checked={settings.notifyOnFailure}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, notifyOnFailure: checked }))}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isCheckingHealth || testConnection.isPending}
            >
              {(isCheckingHealth || testConnection.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Проверить подключение
            </Button>
            <Button onClick={handleSave} disabled={isSaving || saveSettings.isPending}>
              {(isSaving || saveSettings.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Сохранить настройки
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Card */}
      <MonitoringStatusCard />

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle>Настройка удалённой Ollama</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Если Ollama установлена на другой машине в локальной сети, выполните следующие шаги:
          </p>
          <div className="space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium mb-1">1. На сервере с Ollama</p>
              <code className="text-sm bg-background px-2 py-1 rounded">
                sudo systemctl edit ollama
              </code>
              <p className="text-sm text-muted-foreground mt-1">
                Добавьте: Environment="OLLAMA_HOST=0.0.0.0"
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium mb-1">2. Перезапустите сервис</p>
              <code className="text-sm bg-background px-2 py-1 rounded">
                sudo systemctl restart ollama
              </code>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium mb-1">3. Укажите URL выше</p>
              <p className="text-sm text-muted-foreground">
                Формат: http://IP_СЕРВЕРА:11434
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
