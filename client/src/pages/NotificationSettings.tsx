import { useState, useEffect } from "react";
import { Bell, Mail, FileText, MessageSquare, AtSign, Shield, Info, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function NotificationSettings() {
  const [, setLocation] = useLocation();
  
  const { data: preferences, isLoading, refetch } = trpc.notifications.getPreferences.useQuery();
  
  const updateMutation = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Настройки сохранены");
      refetch();
    },
    onError: () => {
      toast.error("Ошибка сохранения настроек");
    },
  });

  const [settings, setSettings] = useState({
    emailEnabled: true,
    pageUpdates: true,
    pageComments: true,
    mentions: true,
    accessRequests: true,
    systemNotifications: true,
  });

  useEffect(() => {
    if (preferences) {
      setSettings({
        emailEnabled: preferences.emailEnabled,
        pageUpdates: preferences.pageUpdates,
        pageComments: preferences.pageComments,
        mentions: preferences.mentions,
        accessRequests: preferences.accessRequests,
        systemNotifications: preferences.systemNotifications,
      });
    }
  }, [preferences]);

  const handleToggle = (key: keyof typeof settings) => {
    const newValue = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    updateMutation.mutate({ [key]: newValue });
  };

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => setLocation("/wiki")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Назад
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Настройки уведомлений</h1>
          <p className="text-muted-foreground">
            Управляйте тем, какие уведомления вы хотите получать
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Email notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email-уведомления
            </CardTitle>
            <CardDescription>
              Получать уведомления на электронную почту
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="emailEnabled" className="flex-1">
                Включить email-уведомления
              </Label>
              <Switch
                id="emailEnabled"
                checked={settings.emailEnabled}
                onCheckedChange={() => handleToggle("emailEnabled")}
              />
            </div>
          </CardContent>
        </Card>

        {/* In-app notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Уведомления в приложении
            </CardTitle>
            <CardDescription>
              Настройте типы уведомлений, которые вы хотите получать
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <Label htmlFor="pageUpdates">Изменения страниц</Label>
                  <p className="text-sm text-muted-foreground">
                    Когда кто-то редактирует ваши страницы
                  </p>
                </div>
              </div>
              <Switch
                id="pageUpdates"
                checked={settings.pageUpdates}
                onCheckedChange={() => handleToggle("pageUpdates")}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-green-500" />
                <div>
                  <Label htmlFor="pageComments">Комментарии</Label>
                  <p className="text-sm text-muted-foreground">
                    Когда кто-то комментирует ваши страницы
                  </p>
                </div>
              </div>
              <Switch
                id="pageComments"
                checked={settings.pageComments}
                onCheckedChange={() => handleToggle("pageComments")}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AtSign className="h-5 w-5 text-orange-500" />
                <div>
                  <Label htmlFor="mentions">Упоминания</Label>
                  <p className="text-sm text-muted-foreground">
                    Когда вас упоминают в комментариях или страницах
                  </p>
                </div>
              </div>
              <Switch
                id="mentions"
                checked={settings.mentions}
                onCheckedChange={() => handleToggle("mentions")}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-yellow-500" />
                <div>
                  <Label htmlFor="accessRequests">Запросы доступа</Label>
                  <p className="text-sm text-muted-foreground">
                    Когда кто-то запрашивает доступ к вашим страницам
                  </p>
                </div>
              </div>
              <Switch
                id="accessRequests"
                checked={settings.accessRequests}
                onCheckedChange={() => handleToggle("accessRequests")}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-gray-500" />
                <div>
                  <Label htmlFor="systemNotifications">Системные уведомления</Label>
                  <p className="text-sm text-muted-foreground">
                    Важные системные сообщения и обновления
                  </p>
                </div>
              </div>
              <Switch
                id="systemNotifications"
                checked={settings.systemNotifications}
                onCheckedChange={() => handleToggle("systemNotifications")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
