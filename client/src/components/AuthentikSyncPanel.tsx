import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Users,
  Shield,
  Link2,
  Loader2,
  AlertCircle,
  Settings,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: number;
  details: string[];
}

interface AuthentikSettings {
  enabled: boolean;
  url: string;
  clientId: string;
  clientSecret: string;
  apiToken: string;
  syncInterval: number;
}

export function AuthentikSyncPanel() {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    groups?: SyncResult;
    users?: SyncResult;
    memberships?: SyncResult;
  } | null>(null);
  
  // Settings form state
  const [settings, setSettings] = useState<AuthentikSettings>({
    enabled: false,
    url: "",
    clientId: "",
    clientSecret: "",
    apiToken: "",
    syncInterval: 60,
  });

  // Query Authentik status and settings
  const { data: authentikStatus, isLoading: statusLoading, refetch: refetchStatus } = 
    trpc.admin.getAuthentikStatus.useQuery();
  
  const { data: authentikSettings, isLoading: settingsLoading } = 
    trpc.admin.getAuthentikSettings.useQuery();

  // Load settings when fetched
  useEffect(() => {
    if (authentikSettings) {
      setSettings({
        enabled: authentikSettings.enabled,
        url: authentikSettings.url || "",
        clientId: authentikSettings.clientId || "",
        clientSecret: authentikSettings.clientSecret || "",
        apiToken: authentikSettings.apiToken || "",
        syncInterval: authentikSettings.syncInterval || 60,
      });
    }
  }, [authentikSettings]);

  // Mutations
  const saveSettings = trpc.admin.saveAuthentikSettings.useMutation({
    onSuccess: () => {
      toast.success("Настройки Authentik сохранены");
      refetchStatus();
    },
    onError: (error) => {
      toast.error(`Ошибка сохранения: ${error.message}`);
    },
    onSettled: () => setSaving(false),
  });

  const testConnection = trpc.admin.testAuthentikConnection.useMutation({
    onSuccess: (result) => {
      if (result.connected) {
        toast.success("Подключение успешно!");
      } else {
        toast.error(`Ошибка подключения: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const syncGroups = trpc.admin.syncAuthentikGroups.useMutation({
    onSuccess: (result) => {
      setLastSyncResult(prev => ({ ...prev, groups: result }));
      toast.success(`Синхронизировано групп: ${result.synced} (создано: ${result.created}, обновлено: ${result.updated})`);
    },
    onError: (error) => {
      toast.error(`Ошибка синхронизации групп: ${error.message}`);
    },
    onSettled: () => setSyncing(null),
  });

  const syncUsers = trpc.admin.syncAuthentikUsers.useMutation({
    onSuccess: (result) => {
      setLastSyncResult(prev => ({ ...prev, users: result }));
      toast.success(`Синхронизировано пользователей: ${result.synced} (создано: ${result.created}, обновлено: ${result.updated})`);
    },
    onError: (error) => {
      toast.error(`Ошибка синхронизации пользователей: ${error.message}`);
    },
    onSettled: () => setSyncing(null),
  });

  const syncMemberships = trpc.admin.syncAuthentikMemberships.useMutation({
    onSuccess: (result) => {
      setLastSyncResult(prev => ({ ...prev, memberships: result }));
      toast.success(`Синхронизировано членств: ${result.synced} (добавлено: ${result.created})`);
    },
    onError: (error) => {
      toast.error(`Ошибка синхронизации членств: ${error.message}`);
    },
    onSettled: () => setSyncing(null),
  });

  const fullSync = trpc.admin.fullAuthentikSync.useMutation({
    onSuccess: (result) => {
      setLastSyncResult(result);
      toast.success("Полная синхронизация завершена");
    },
    onError: (error) => {
      toast.error(`Ошибка полной синхронизации: ${error.message}`);
    },
    onSettled: () => setSyncing(null),
  });

  const handleSaveSettings = () => {
    setSaving(true);
    saveSettings.mutate(settings);
  };

  const handleTestConnection = () => {
    testConnection.mutate({
      url: settings.url,
      apiToken: settings.apiToken,
    });
  };

  const handleSyncGroups = () => {
    setSyncing("groups");
    syncGroups.mutate();
  };

  const handleSyncUsers = () => {
    setSyncing("users");
    syncUsers.mutate();
  };

  const handleSyncMemberships = () => {
    setSyncing("memberships");
    syncMemberships.mutate();
  };

  const handleFullSync = () => {
    setSyncing("full");
    fullSync.mutate();
  };

  if (statusLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Настройки
          </TabsTrigger>
          <TabsTrigger value="sync">
            <RefreshCw className="h-4 w-4 mr-2" />
            Синхронизация
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Статус подключения
              </CardTitle>
              <CardDescription>
                Текущий статус подключения к серверу Authentik
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {authentikStatus?.enabled ? (
                    authentikStatus?.connected ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Подключено
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Ошибка подключения
                      </Badge>
                    )
                  ) : (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Отключено
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {authentikStatus?.url || "URL не настроен"}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchStatus()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Обновить
                </Button>
              </div>
              
              {authentikStatus?.error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Ошибка подключения</AlertTitle>
                  <AlertDescription>{authentikStatus.error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Settings Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Настройки Authentik
              </CardTitle>
              <CardDescription>
                Настройте параметры подключения к серверу Authentik для OAuth2 авторизации и синхронизации
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Включить интеграцию</Label>
                  <p className="text-sm text-muted-foreground">
                    Активировать OAuth2 авторизацию и синхронизацию через Authentik
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => setSettings(s => ({ ...s, enabled: checked }))}
                />
              </div>

              <div className="border-t pt-6 space-y-4">
                {/* URL */}
                <div className="space-y-2">
                  <Label htmlFor="authentik-url">URL сервера Authentik</Label>
                  <Input
                    id="authentik-url"
                    placeholder="https://auth.example.com"
                    value={settings.url}
                    onChange={(e) => setSettings(s => ({ ...s, url: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Базовый URL вашего сервера Authentik (без /api)
                  </p>
                </div>

                {/* Client ID */}
                <div className="space-y-2">
                  <Label htmlFor="client-id">Client ID</Label>
                  <Input
                    id="client-id"
                    placeholder="wiki-client"
                    value={settings.clientId}
                    onChange={(e) => setSettings(s => ({ ...s, clientId: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Client ID из OAuth2 Provider в Authentik
                  </p>
                </div>

                {/* Client Secret */}
                <div className="space-y-2">
                  <Label htmlFor="client-secret">Client Secret</Label>
                  <div className="relative">
                    <Input
                      id="client-secret"
                      type={showSecrets ? "text" : "password"}
                      placeholder="••••••••••••••••"
                      value={settings.clientSecret}
                      onChange={(e) => setSettings(s => ({ ...s, clientSecret: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecrets(!showSecrets)}
                    >
                      {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Client Secret из OAuth2 Provider в Authentik
                  </p>
                </div>

                {/* API Token */}
                <div className="space-y-2">
                  <Label htmlFor="api-token">API Token</Label>
                  <div className="relative">
                    <Input
                      id="api-token"
                      type={showSecrets ? "text" : "password"}
                      placeholder="••••••••••••••••"
                      value={settings.apiToken}
                      onChange={(e) => setSettings(s => ({ ...s, apiToken: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecrets(!showSecrets)}
                    >
                      {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    API Token для синхронизации пользователей и групп (создайте в Authentik → Admin → Tokens)
                  </p>
                </div>

                {/* Sync Interval */}
                <div className="space-y-2">
                  <Label htmlFor="sync-interval">Интервал синхронизации (минуты)</Label>
                  <Input
                    id="sync-interval"
                    type="number"
                    min={5}
                    max={1440}
                    value={settings.syncInterval}
                    onChange={(e) => setSettings(s => ({ ...s, syncInterval: parseInt(e.target.value) || 60 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Как часто автоматически синхронизировать пользователей и группы (минимум 5 минут)
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Сохранить настройки
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection}
                  disabled={!settings.url || !settings.apiToken || testConnection.isPending}
                >
                  {testConnection.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Проверить подключение
                </Button>
              </div>

              {/* Help */}
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Как настроить Authentik</AlertTitle>
                <AlertDescription className="mt-2 space-y-2">
                  <p>1. В Authentik создайте OAuth2/OpenID Provider с типом Confidential</p>
                  <p>2. Redirect URI: <code className="bg-muted px-1 rounded">{window.location.origin}/api/authentik/callback</code></p>
                  <p>3. Scopes: <code className="bg-muted px-1 rounded">openid profile email groups</code></p>
                  <p>4. Создайте API Token в Admin → Tokens с правами на чтение пользователей и групп</p>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync" className="space-y-6">
          {/* Sync Actions */}
          {authentikStatus?.enabled && authentikStatus?.connected ? (
            <Card>
              <CardHeader>
                <CardTitle>Синхронизация</CardTitle>
                <CardDescription>
                  Синхронизируйте пользователей и группы из Authentik. 
                  Автоматическая синхронизация выполняется каждые {settings.syncInterval} минут.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Button
                    variant="outline"
                    onClick={handleSyncGroups}
                    disabled={syncing !== null}
                    className="h-auto py-4 flex-col"
                  >
                    {syncing === "groups" ? (
                      <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                    ) : (
                      <Shield className="h-6 w-6 mb-2" />
                    )}
                    <span>Синхронизировать группы</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleSyncUsers}
                    disabled={syncing !== null}
                    className="h-auto py-4 flex-col"
                  >
                    {syncing === "users" ? (
                      <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                    ) : (
                      <Users className="h-6 w-6 mb-2" />
                    )}
                    <span>Синхронизировать пользователей</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleSyncMemberships}
                    disabled={syncing !== null}
                    className="h-auto py-4 flex-col"
                  >
                    {syncing === "memberships" ? (
                      <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                    ) : (
                      <Link2 className="h-6 w-6 mb-2" />
                    )}
                    <span>Синхронизировать членства</span>
                  </Button>
                  
                  <Button
                    onClick={handleFullSync}
                    disabled={syncing !== null}
                    className="h-auto py-4 flex-col"
                  >
                    {syncing === "full" ? (
                      <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-6 w-6 mb-2" />
                    )}
                    <span>Полная синхронизация</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentik не подключен</AlertTitle>
              <AlertDescription>
                Настройте подключение к Authentik на вкладке "Настройки" для использования синхронизации.
              </AlertDescription>
            </Alert>
          )}

          {/* Last Sync Results */}
          {lastSyncResult && (
            <Card>
              <CardHeader>
                <CardTitle>Результаты последней синхронизации</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {lastSyncResult.groups && (
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4" />
                        Группы
                      </h4>
                      <div className="text-sm space-y-1">
                        <div>Синхронизировано: {lastSyncResult.groups.synced}</div>
                        <div className="text-green-600">Создано: {lastSyncResult.groups.created}</div>
                        <div className="text-blue-600">Обновлено: {lastSyncResult.groups.updated}</div>
                        {lastSyncResult.groups.errors > 0 && (
                          <div className="text-red-600">Ошибок: {lastSyncResult.groups.errors}</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {lastSyncResult.users && (
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4" />
                        Пользователи
                      </h4>
                      <div className="text-sm space-y-1">
                        <div>Синхронизировано: {lastSyncResult.users.synced}</div>
                        <div className="text-green-600">Создано: {lastSyncResult.users.created}</div>
                        <div className="text-blue-600">Обновлено: {lastSyncResult.users.updated}</div>
                        {lastSyncResult.users.errors > 0 && (
                          <div className="text-red-600">Ошибок: {lastSyncResult.users.errors}</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {lastSyncResult.memberships && (
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Link2 className="h-4 w-4" />
                        Членства в группах
                      </h4>
                      <div className="text-sm space-y-1">
                        <div>Обработано: {lastSyncResult.memberships.synced}</div>
                        <div className="text-green-600">Добавлено: {lastSyncResult.memberships.created}</div>
                        {lastSyncResult.memberships.errors > 0 && (
                          <div className="text-red-600">Ошибок: {lastSyncResult.memberships.errors}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
