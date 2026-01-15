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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Bell,
  Check,
  Loader2,
  Send,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  MessageCircle,
  Hash,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface TelegramConfig {
  botToken: string;
  chatId: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
}

interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

interface Integration {
  id: number;
  provider: "telegram" | "slack";
  config: string;
  isEnabled: boolean;
  lastTestedAt: Date | null;
  lastTestSuccess: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export function NotificationIntegrationsPanel() {
  const [activeTab, setActiveTab] = useState<"telegram" | "slack" | "logs">("telegram");
  
  // Telegram form state
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    botToken: "",
    chatId: "",
    parseMode: "HTML",
  });
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [telegramBotInfo, setTelegramBotInfo] = useState<{ username?: string; firstName?: string } | null>(null);
  
  // Slack form state
  const [slackConfig, setSlackConfig] = useState<SlackConfig>({
    webhookUrl: "",
    channel: "",
    username: "Scoliologic Wiki",
    iconEmoji: ":bell:",
  });
  const [slackEnabled, setSlackEnabled] = useState(true);

  // Queries
  const integrationsQuery = trpc.notifications.getIntegrations.useQuery();
  const logsQuery = trpc.notifications.getLogs.useQuery({ limit: 100 });

  // Mutations
  const saveMutation = trpc.notifications.saveIntegration.useMutation({
    onSuccess: () => {
      toast.success("Настройки сохранены");
      integrationsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const testMutation = trpc.notifications.testNotification.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Тестовое уведомление отправлено!");
        integrationsQuery.refetch();
      } else {
        toast.error(`Ошибка: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const deleteMutation = trpc.notifications.deleteIntegration.useMutation({
    onSuccess: () => {
      toast.success("Интеграция удалена");
      integrationsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const toggleMutation = trpc.notifications.toggleIntegration.useMutation({
    onSuccess: () => {
      integrationsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const botInfoQuery = trpc.notifications.getTelegramBotInfo.useQuery(
    { botToken: telegramConfig.botToken },
    { enabled: telegramConfig.botToken.length > 20 }
  );

  // Load existing settings
  useEffect(() => {
    if (integrationsQuery.data) {
      const telegram = integrationsQuery.data.find(i => i.provider === "telegram");
      const slack = integrationsQuery.data.find(i => i.provider === "slack");
      
      if (telegram) {
        const config = JSON.parse(telegram.config) as TelegramConfig;
        setTelegramConfig(config);
        setTelegramEnabled(telegram.isEnabled);
      }
      
      if (slack) {
        const config = JSON.parse(slack.config) as SlackConfig;
        setSlackConfig(config);
        setSlackEnabled(slack.isEnabled);
      }
    }
  }, [integrationsQuery.data]);

  // Update bot info when token changes
  useEffect(() => {
    if (botInfoQuery.data?.success) {
      setTelegramBotInfo({
        username: botInfoQuery.data.username,
        firstName: botInfoQuery.data.firstName,
      });
    } else {
      setTelegramBotInfo(null);
    }
  }, [botInfoQuery.data]);

  const handleSaveTelegram = () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      toast.error("Заполните все обязательные поля");
      return;
    }
    saveMutation.mutate({
      provider: "telegram",
      config: telegramConfig,
      isEnabled: telegramEnabled,
    });
  };

  const handleSaveSlack = () => {
    if (!slackConfig.webhookUrl) {
      toast.error("Введите Webhook URL");
      return;
    }
    saveMutation.mutate({
      provider: "slack",
      config: slackConfig,
      isEnabled: slackEnabled,
    });
  };

  const handleTestTelegram = () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      toast.error("Заполните настройки перед тестированием");
      return;
    }
    testMutation.mutate({
      provider: "telegram",
      config: telegramConfig,
    });
  };

  const handleTestSlack = () => {
    if (!slackConfig.webhookUrl) {
      toast.error("Введите Webhook URL перед тестированием");
      return;
    }
    testMutation.mutate({
      provider: "slack",
      config: slackConfig,
    });
  };

  const telegramIntegration = integrationsQuery.data?.find(i => i.provider === "telegram");
  const slackIntegration = integrationsQuery.data?.find(i => i.provider === "slack");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Интеграции уведомлений</h2>
          <p className="text-muted-foreground">
            Настройте отправку алертов в Telegram и Slack
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            integrationsQuery.refetch();
            logsQuery.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="telegram" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Telegram
            {telegramIntegration?.isEnabled && (
              <Badge variant="secondary" className="ml-1">Активен</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="slack" className="gap-2">
            <Hash className="h-4 w-4" />
            Slack
            {slackIntegration?.isEnabled && (
              <Badge variant="secondary" className="ml-1">Активен</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Bell className="h-4 w-4" />
            Журнал
          </TabsTrigger>
        </TabsList>

        <TabsContent value="telegram" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Telegram Bot
              </CardTitle>
              <CardDescription>
                Настройте бота Telegram для получения уведомлений об алертах
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="telegram-enabled">Включить интеграцию</Label>
                <Switch
                  id="telegram-enabled"
                  checked={telegramEnabled}
                  onCheckedChange={setTelegramEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bot-token">Bot Token *</Label>
                <Input
                  id="bot-token"
                  type="password"
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={telegramConfig.botToken}
                  onChange={(e) => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Получите токен у @BotFather в Telegram
                </p>
                {telegramBotInfo && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Бот: @{telegramBotInfo.username} ({telegramBotInfo.firstName})
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="chat-id">Chat ID *</Label>
                <Input
                  id="chat-id"
                  placeholder="-1001234567890 или 123456789"
                  value={telegramConfig.chatId}
                  onChange={(e) => setTelegramConfig({ ...telegramConfig, chatId: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  ID чата или группы. Для группы начинается с -100
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parse-mode">Формат сообщений</Label>
                <Select
                  value={telegramConfig.parseMode}
                  onValueChange={(v) => setTelegramConfig({ ...telegramConfig, parseMode: v as TelegramConfig["parseMode"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HTML">HTML</SelectItem>
                    <SelectItem value="Markdown">Markdown</SelectItem>
                    <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {telegramIntegration && (
                <div className="flex items-center gap-2 text-sm">
                  {telegramIntegration.lastTestedAt && (
                    <>
                      Последний тест:{" "}
                      {telegramIntegration.lastTestSuccess ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Успешно
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Ошибка
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        {new Date(telegramIntegration.lastTestedAt).toLocaleString("ru-RU")}
                      </span>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveTelegram} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Сохранить
                </Button>
                <Button variant="outline" onClick={handleTestTelegram} disabled={testMutation.isPending}>
                  {testMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Send className="h-4 w-4 mr-2" />
                  Тест
                </Button>
                {telegramIntegration && (
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate({ provider: "telegram" })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slack" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Slack Webhook
              </CardTitle>
              <CardDescription>
                Настройте Incoming Webhook для отправки уведомлений в Slack
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="slack-enabled">Включить интеграцию</Label>
                <Switch
                  id="slack-enabled"
                  checked={slackEnabled}
                  onCheckedChange={setSlackEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL *</Label>
                <Input
                  id="webhook-url"
                  type="password"
                  placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
                  value={slackConfig.webhookUrl}
                  onChange={(e) => setSlackConfig({ ...slackConfig, webhookUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Создайте Incoming Webhook в настройках Slack App
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slack-channel">Канал (опционально)</Label>
                <Input
                  id="slack-channel"
                  placeholder="#alerts"
                  value={slackConfig.channel || ""}
                  onChange={(e) => setSlackConfig({ ...slackConfig, channel: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Переопределить канал по умолчанию из Webhook
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="slack-username">Имя бота</Label>
                  <Input
                    id="slack-username"
                    placeholder="Scoliologic Wiki"
                    value={slackConfig.username || ""}
                    onChange={(e) => setSlackConfig({ ...slackConfig, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slack-emoji">Иконка (emoji)</Label>
                  <Input
                    id="slack-emoji"
                    placeholder=":bell:"
                    value={slackConfig.iconEmoji || ""}
                    onChange={(e) => setSlackConfig({ ...slackConfig, iconEmoji: e.target.value })}
                  />
                </div>
              </div>

              {slackIntegration && (
                <div className="flex items-center gap-2 text-sm">
                  {slackIntegration.lastTestedAt && (
                    <>
                      Последний тест:{" "}
                      {slackIntegration.lastTestSuccess ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Успешно
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Ошибка
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        {new Date(slackIntegration.lastTestedAt).toLocaleString("ru-RU")}
                      </span>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveSlack} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Сохранить
                </Button>
                <Button variant="outline" onClick={handleTestSlack} disabled={testMutation.isPending}>
                  {testMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Send className="h-4 w-4 mr-2" />
                  Тест
                </Button>
                {slackIntegration && (
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate({ provider: "slack" })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Журнал уведомлений
              </CardTitle>
              <CardDescription>
                История отправленных уведомлений
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : logsQuery.data?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет записей в журнале
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Время</TableHead>
                      <TableHead>Провайдер</TableHead>
                      <TableHead>Заголовок</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Ошибка</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsQuery.data?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {new Date(log.createdAt).toLocaleString("ru-RU")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.provider === "telegram" ? (
                              <MessageCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <Hash className="h-3 w-3 mr-1" />
                            )}
                            {log.provider}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {log.title}
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Ошибка
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {log.error || "-"}
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
    </div>
  );
}
