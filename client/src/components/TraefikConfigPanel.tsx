import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  FileCode,
  Loader2,
  Plus,
  Trash2,
  Edit,
  Play,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface ConfigFile {
  id: number;
  name: string;
  filePath: string;
  format: "yaml" | "toml";
  content: string | null;
  isAutoApply: boolean;
  lastAppliedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

export function TraefikConfigPanel() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigFile | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    filePath: "/etc/traefik/dynamic/",
    format: "yaml" as "yaml" | "toml",
    content: "",
    isAutoApply: false,
  });

  const configsQuery = trpc.traefikConfig.getFiles.useQuery();
  
  const saveConfig = trpc.traefikConfig.saveFile.useMutation({
    onSuccess: () => {
      toast.success(editingConfig ? "Конфигурация обновлена" : "Конфигурация создана");
      setShowCreateDialog(false);
      setEditingConfig(null);
      resetForm();
      configsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const applyConfig = trpc.traefikConfig.applyFile.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Конфигурация применена");
      } else {
        toast.error(`Ошибка: ${result.error}`);
      }
      configsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteConfig = trpc.traefikConfig.deleteFile.useMutation({
    onSuccess: () => {
      toast.success("Конфигурация удалена");
      configsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      filePath: "/etc/traefik/dynamic/",
      format: "yaml",
      content: "",
      isAutoApply: false,
    });
  };

  const handleEdit = (config: ConfigFile) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      filePath: config.filePath,
      format: config.format,
      content: config.content || "",
      isAutoApply: config.isAutoApply,
    });
    setShowCreateDialog(true);
  };

  const handleSubmit = () => {
    saveConfig.mutate({
      id: editingConfig?.id,
      ...formData,
    });
  };

  const getStatusBadge = (config: ConfigFile) => {
    if (config.lastError) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Ошибка
        </Badge>
      );
    }
    if (config.lastAppliedAt) {
      return (
        <Badge variant="outline" className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-3 w-3" />
          Применено
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Не применено
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Конфигурации Traefik</h2>
          <p className="text-muted-foreground">
            Управление файлами динамической конфигурации
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить конфигурацию
        </Button>
      </div>

      {/* Config Files */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Файлы конфигурации
          </CardTitle>
          <CardDescription>
            Динамические конфигурации для Traefik file provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : configsQuery.data?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет конфигурационных файлов. Создайте первый файл.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Путь</TableHead>
                  <TableHead>Формат</TableHead>
                  <TableHead>Авто-применение</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[150px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configsQuery.data?.map((config: ConfigFile) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell className="font-mono text-sm">{config.filePath}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{config.format.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={config.isAutoApply}
                        onCheckedChange={(checked) => {
                          saveConfig.mutate({
                            id: config.id,
                            name: config.name,
                            filePath: config.filePath,
                            format: config.format,
                            content: config.content || "",
                            isAutoApply: checked,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>{getStatusBadge(config)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => applyConfig.mutate({ id: config.id })}
                          disabled={applyConfig.isPending}
                          title="Применить"
                        >
                          {applyConfig.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(config)}
                          title="Редактировать"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteConfig.mutate({ id: config.id })}
                          title="Удалить"
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

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingConfig(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Редактировать конфигурацию" : "Создать конфигурацию"}
            </DialogTitle>
            <DialogDescription>
              Создайте файл динамической конфигурации для Traefik
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="wiki-routers"
                />
              </div>

              <div className="space-y-2">
                <Label>Формат</Label>
                <Select
                  value={formData.format}
                  onValueChange={(value: "yaml" | "toml") => setFormData({ ...formData, format: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yaml">YAML</SelectItem>
                    <SelectItem value="toml">TOML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Путь к файлу</Label>
              <Input
                value={formData.filePath}
                onChange={(e) => setFormData({ ...formData, filePath: e.target.value })}
                placeholder="/etc/traefik/dynamic/wiki.yaml"
              />
              <p className="text-xs text-muted-foreground">
                Полный путь к файлу на сервере Traefik
              </p>
            </div>

            <div className="space-y-2">
              <Label>Содержимое</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder={formData.format === "yaml" 
                  ? "http:\n  routers:\n    wiki:\n      rule: Host(`wiki.example.com`)\n      service: wiki-service"
                  : "[http.routers.wiki]\n  rule = \"Host(`wiki.example.com`)\"\n  service = \"wiki-service\""
                }
                className="font-mono text-sm min-h-[300px]"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Авто-применение</Label>
                <p className="text-xs text-muted-foreground">
                  Автоматически записывать файл при изменениях
                </p>
              </div>
              <Switch
                checked={formData.isAutoApply}
                onCheckedChange={(checked) => setFormData({ ...formData, isAutoApply: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingConfig(null);
              resetForm();
            }}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.filePath || saveConfig.isPending}
            >
              {saveConfig.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingConfig ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
