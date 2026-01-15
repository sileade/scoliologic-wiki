import { useState } from "react";
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
  AlertTriangle,
  Bell,
  Check,
  Loader2,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface AlertThreshold {
  id: number;
  name: string;
  serviceName: string | null;
  metricType: string;
  operator: string;
  threshold: string;
  windowMinutes: number;
  isEnabled: boolean;
  notifyEmail: boolean;
  notifyWebhook: boolean;
  webhookUrl: string | null;
  cooldownMinutes: number;
  lastTriggeredAt: Date | null;
}

interface Alert {
  id: number;
  thresholdId: number;
  serviceName: string;
  metricType: string;
  currentValue: string;
  thresholdValue: string;
  status: "triggered" | "resolved" | "acknowledged";
  message: string | null;
  createdAt: Date;
}

const METRIC_TYPES = [
  { value: "errors_4xx_rate", label: "Ошибки 4xx (%)" },
  { value: "errors_5xx_rate", label: "Ошибки 5xx (%)" },
  { value: "error_total_rate", label: "Все ошибки (%)" },
  { value: "latency_avg", label: "Средняя латентность (мс)" },
  { value: "requests_per_second", label: "Запросов/сек" },
];

const OPERATORS = [
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
];

export function TraefikAlertsPanel() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<AlertThreshold | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    serviceName: "",
    metricType: "errors_5xx_rate" as string,
    operator: "gt" as string,
    threshold: 5,
    windowMinutes: 5,
    notifyEmail: true,
    notifyWebhook: false,
    webhookUrl: "",
    cooldownMinutes: 15,
  });

  const thresholdsQuery = trpc.traefikAlerts.getThresholds.useQuery();
  const alertsQuery = trpc.traefikAlerts.getAlerts.useQuery({ limit: 50 });
  
  const createThreshold = trpc.traefikAlerts.createThreshold.useMutation({
    onSuccess: () => {
      toast.success("Порог создан");
      setShowCreateDialog(false);
      resetForm();
      thresholdsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateThreshold = trpc.traefikAlerts.updateThreshold.useMutation({
    onSuccess: () => {
      toast.success("Порог обновлён");
      setEditingThreshold(null);
      resetForm();
      thresholdsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteThreshold = trpc.traefikAlerts.deleteThreshold.useMutation({
    onSuccess: () => {
      toast.success("Порог удалён");
      thresholdsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const checkThresholds = trpc.traefikAlerts.checkThresholds.useMutation({
    onSuccess: (result) => {
      toast.success(`Проверка завершена: ${result.checked} проверено, ${result.triggered} сработало`);
      alertsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const acknowledgeAlert = trpc.traefikAlerts.acknowledgeAlert.useMutation({
    onSuccess: () => {
      toast.success("Алерт подтверждён");
      alertsQuery.refetch();
    },
  });

  const resolveAlert = trpc.traefikAlerts.resolveAlert.useMutation({
    onSuccess: () => {
      toast.success("Алерт закрыт");
      alertsQuery.refetch();
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      serviceName: "",
      metricType: "errors_5xx_rate",
      operator: "gt",
      threshold: 5,
      windowMinutes: 5,
      notifyEmail: true,
      notifyWebhook: false,
      webhookUrl: "",
      cooldownMinutes: 15,
    });
  };

  const handleEdit = (threshold: AlertThreshold) => {
    setEditingThreshold(threshold);
    setFormData({
      name: threshold.name,
      serviceName: threshold.serviceName || "",
      metricType: threshold.metricType,
      operator: threshold.operator,
      threshold: parseFloat(threshold.threshold),
      windowMinutes: threshold.windowMinutes,
      notifyEmail: threshold.notifyEmail,
      notifyWebhook: threshold.notifyWebhook,
      webhookUrl: threshold.webhookUrl || "",
      cooldownMinutes: threshold.cooldownMinutes,
    });
  };

  const handleSubmit = () => {
    if (editingThreshold) {
      updateThreshold.mutate({
        id: editingThreshold.id,
        ...formData,
        serviceName: formData.serviceName || null,
        webhookUrl: formData.webhookUrl || null,
      });
    } else {
      createThreshold.mutate({
        ...formData,
        serviceName: formData.serviceName || undefined,
        webhookUrl: formData.webhookUrl || undefined,
        metricType: formData.metricType as any,
        operator: formData.operator as any,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "triggered":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Активен</Badge>;
      case "acknowledged":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Подтверждён</Badge>;
      case "resolved":
        return <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Закрыт</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getMetricLabel = (type: string) => {
    return METRIC_TYPES.find(m => m.value === type)?.label || type;
  };

  const getOperatorLabel = (op: string) => {
    return OPERATORS.find(o => o.value === op)?.label || op;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Алерты Traefik</h2>
          <p className="text-muted-foreground">
            Настройка порогов и просмотр истории алертов
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => checkThresholds.mutate()}
            disabled={checkThresholds.isPending}
          >
            {checkThresholds.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Проверить сейчас
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить порог
          </Button>
        </div>
      </div>

      {/* Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Пороги алертов
          </CardTitle>
          <CardDescription>
            Настройте условия для автоматических уведомлений
          </CardDescription>
        </CardHeader>
        <CardContent>
          {thresholdsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : thresholdsQuery.data?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет настроенных порогов. Создайте первый порог для мониторинга.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Сервис</TableHead>
                  <TableHead>Условие</TableHead>
                  <TableHead>Уведомления</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[100px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thresholdsQuery.data?.map((threshold: AlertThreshold) => (
                  <TableRow key={threshold.id}>
                    <TableCell className="font-medium">{threshold.name}</TableCell>
                    <TableCell>{threshold.serviceName || "Все сервисы"}</TableCell>
                    <TableCell>
                      {getMetricLabel(threshold.metricType)} {getOperatorLabel(threshold.operator)} {threshold.threshold}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {threshold.notifyEmail && <Badge variant="outline">Email</Badge>}
                        {threshold.notifyWebhook && <Badge variant="outline">Webhook</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={threshold.isEnabled}
                        onCheckedChange={(checked) => {
                          updateThreshold.mutate({ id: threshold.id, isEnabled: checked });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(threshold)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteThreshold.mutate({ id: threshold.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            История алертов
          </CardTitle>
          <CardDescription>
            Последние сработавшие алерты
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alertsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : alertsQuery.data?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет алертов. Система работает стабильно.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Время</TableHead>
                  <TableHead>Сервис</TableHead>
                  <TableHead>Метрика</TableHead>
                  <TableHead>Значение</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[100px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertsQuery.data?.map((alert: Alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      {new Date(alert.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{alert.serviceName}</TableCell>
                    <TableCell>{getMetricLabel(alert.metricType)}</TableCell>
                    <TableCell>
                      <span className="text-destructive font-medium">
                        {parseFloat(alert.currentValue).toFixed(2)}
                      </span>
                      {" / "}
                      <span className="text-muted-foreground">
                        {parseFloat(alert.thresholdValue).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(alert.status)}</TableCell>
                    <TableCell>
                      {alert.status === "triggered" && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => acknowledgeAlert.mutate({ id: alert.id })}
                            title="Подтвердить"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => resolveAlert.mutate({ id: alert.id })}
                            title="Закрыть"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {alert.status === "acknowledged" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resolveAlert.mutate({ id: alert.id })}
                          title="Закрыть"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingThreshold} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingThreshold(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingThreshold ? "Редактировать порог" : "Создать порог алерта"}
            </DialogTitle>
            <DialogDescription>
              Настройте условия для автоматического уведомления
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Высокий уровень ошибок 5xx"
              />
            </div>

            <div className="space-y-2">
              <Label>Сервис (оставьте пустым для всех)</Label>
              <Input
                value={formData.serviceName}
                onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                placeholder="api@docker"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Метрика</Label>
                <Select
                  value={formData.metricType}
                  onValueChange={(value) => setFormData({ ...formData, metricType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Оператор</Label>
                <Select
                  value={formData.operator}
                  onValueChange={(value) => setFormData({ ...formData, operator: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Порог</Label>
                <Input
                  type="number"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Окно (минуты)</Label>
                <Input
                  type="number"
                  value={formData.windowMinutes}
                  onChange={(e) => setFormData({ ...formData, windowMinutes: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Cooldown (минуты)</Label>
                <Input
                  type="number"
                  value={formData.cooldownMinutes}
                  onChange={(e) => setFormData({ ...formData, cooldownMinutes: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Email уведомления</Label>
                <Switch
                  checked={formData.notifyEmail}
                  onCheckedChange={(checked) => setFormData({ ...formData, notifyEmail: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Webhook уведомления</Label>
                <Switch
                  checked={formData.notifyWebhook}
                  onCheckedChange={(checked) => setFormData({ ...formData, notifyWebhook: checked })}
                />
              </div>

              {formData.notifyWebhook && (
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    value={formData.webhookUrl}
                    onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                    placeholder="https://hooks.slack.com/..."
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingThreshold(null);
              resetForm();
            }}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createThreshold.isPending || updateThreshold.isPending}
            >
              {(createThreshold.isPending || updateThreshold.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingThreshold ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
