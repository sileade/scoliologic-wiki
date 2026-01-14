import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  RefreshCw,
  CheckCircle,
  XCircle,
  Users,
  Shield,
  Link2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: number;
  details: string[];
}

export function AuthentikSyncPanel() {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{
    groups?: SyncResult;
    users?: SyncResult;
    memberships?: SyncResult;
  } | null>(null);

  // Query Authentik status
  const { data: authentikStatus, isLoading: statusLoading, refetch: refetchStatus } = 
    trpc.admin.getAuthentikStatus.useQuery();

  // Mutations
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

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Статус подключения к Authentik
          </CardTitle>
          <CardDescription>
            Проверьте подключение к серверу Authentik для синхронизации пользователей и групп
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
              Проверить
            </Button>
          </div>
          
          {authentikStatus?.error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ошибка подключения</AlertTitle>
              <AlertDescription>{authentikStatus.error}</AlertDescription>
            </Alert>
          )}
          
          {!authentikStatus?.enabled && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentik не настроен</AlertTitle>
              <AlertDescription>
                Для включения интеграции добавьте переменные окружения:
                <code className="block mt-2 p-2 bg-muted rounded text-xs">
                  AUTHENTIK_ENABLED=true<br />
                  AUTHENTIK_URL=https://auth.example.com<br />
                  AUTHENTIK_CLIENT_ID=wiki-client<br />
                  AUTHENTIK_CLIENT_SECRET=your-secret<br />
                  AUTHENTIK_API_TOKEN=your-api-token
                </code>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sync Actions */}
      {authentikStatus?.enabled && authentikStatus?.connected && (
        <Card>
          <CardHeader>
            <CardTitle>Синхронизация</CardTitle>
            <CardDescription>
              Синхронизируйте пользователей и группы из Authentik. 
              Автоматическая синхронизация выполняется каждый час.
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
    </div>
  );
}
