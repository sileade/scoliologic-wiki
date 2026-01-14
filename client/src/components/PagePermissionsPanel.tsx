import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Shield,
  Users,
  FileText,
  Plus,
  Trash2,
  Loader2,
  Search,
  Eye,
  Edit,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

type PermissionLevel = "read" | "edit" | "admin";

interface Permission {
  id: number;
  pageId: number | null;
  groupId: number | null;
  userId: number | null;
  permission: PermissionLevel;
  pageTitle?: string;
  groupName?: string;
  userName?: string;
}

export function PagePermissionsPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPermission, setNewPermission] = useState({
    pageId: "",
    groupId: "",
    userId: "",
    permission: "read" as PermissionLevel,
  });

  // Queries
  const { data: pages, isLoading: pagesLoading } = trpc.pages.list.useQuery();
  const { data: groups, isLoading: groupsLoading } = trpc.groups.list.useQuery();
  const { data: users, isLoading: usersLoading } = trpc.users.list.useQuery();
  const { data: permissions, isLoading: permissionsLoading, refetch: refetchPermissions } = 
    trpc.admin.getPagePermissions.useQuery({ pageId: selectedPage ?? undefined });

  // Mutations
  const addPermission = trpc.admin.addPagePermission.useMutation({
    onSuccess: () => {
      toast.success("Права доступа добавлены");
      refetchPermissions();
      setAddDialogOpen(false);
      setNewPermission({ pageId: "", groupId: "", userId: "", permission: "read" });
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const removePermission = trpc.admin.removePagePermission.useMutation({
    onSuccess: () => {
      toast.success("Права доступа удалены");
      refetchPermissions();
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const handleAddPermission = () => {
    if (!newPermission.pageId && !newPermission.groupId && !newPermission.userId) {
      toast.error("Выберите страницу, группу или пользователя");
      return;
    }
    
    addPermission.mutate({
      pageId: newPermission.pageId ? parseInt(newPermission.pageId) : undefined,
      groupId: newPermission.groupId ? parseInt(newPermission.groupId) : undefined,
      userId: newPermission.userId ? parseInt(newPermission.userId) : undefined,
      permission: newPermission.permission,
    });
  };

  const handleRemovePermission = (id: number) => {
    if (confirm("Удалить эти права доступа?")) {
      removePermission.mutate({ id });
    }
  };

  const getPermissionIcon = (permission: PermissionLevel) => {
    switch (permission) {
      case "read": return <Eye className="h-4 w-4" />;
      case "edit": return <Edit className="h-4 w-4" />;
      case "admin": return <Crown className="h-4 w-4" />;
    }
  };

  const getPermissionBadge = (permission: PermissionLevel) => {
    switch (permission) {
      case "read": return <Badge variant="secondary">Чтение</Badge>;
      case "edit": return <Badge variant="default">Редактирование</Badge>;
      case "admin": return <Badge className="bg-purple-500">Администратор</Badge>;
    }
  };

  const filteredPages = pages?.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const isLoading = pagesLoading || groupsLoading || usersLoading || permissionsLoading;

  return (
    <div className="space-y-6">
      {/* Page Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Выберите страницу
          </CardTitle>
          <CardDescription>
            Выберите страницу для управления правами доступа или оставьте пустым для глобальных прав
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск страниц..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={selectedPage?.toString() ?? "all"}
              onValueChange={(v) => setSelectedPage(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Все страницы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все страницы (глобальные права)</SelectItem>
                {filteredPages.map((page) => (
                  <SelectItem key={page.id} value={page.id.toString()}>
                    {page.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Permissions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Права доступа
            </CardTitle>
            <CardDescription>
              {selectedPage 
                ? `Права доступа для выбранной страницы` 
                : "Глобальные права доступа для всех страниц"}
            </CardDescription>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Добавить права
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить права доступа</DialogTitle>
                <DialogDescription>
                  Назначьте права доступа группе или пользователю
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Page Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Страница</label>
                  <Select
                    value={newPermission.pageId}
                    onValueChange={(v) => setNewPermission(p => ({ ...p, pageId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Все страницы (глобально)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Все страницы (глобально)</SelectItem>
                      {pages?.map((page) => (
                        <SelectItem key={page.id} value={page.id.toString()}>
                          {page.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Group Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Группа</label>
                  <Select
                    value={newPermission.groupId}
                    onValueChange={(v) => setNewPermission(p => ({ ...p, groupId: v, userId: "" }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите группу" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Не выбрано</SelectItem>
                      {groups?.map((group) => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* User Selection (alternative to group) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Или пользователь</label>
                  <Select
                    value={newPermission.userId}
                    onValueChange={(v) => setNewPermission(p => ({ ...p, userId: v, groupId: "" }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите пользователя" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Не выбрано</SelectItem>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Permission Level */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Уровень доступа</label>
                  <Select
                    value={newPermission.permission}
                    onValueChange={(v) => setNewPermission(p => ({ ...p, permission: v as PermissionLevel }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Чтение
                        </div>
                      </SelectItem>
                      <SelectItem value="edit">
                        <div className="flex items-center gap-2">
                          <Edit className="h-4 w-4" />
                          Редактирование
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4" />
                          Администратор
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleAddPermission} disabled={addPermission.isPending}>
                  {addPermission.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Добавить
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : permissions && permissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Страница</TableHead>
                  <TableHead>Группа/Пользователь</TableHead>
                  <TableHead>Уровень доступа</TableHead>
                  <TableHead className="w-[100px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((perm) => (
                  <TableRow key={perm.id}>
                    <TableCell>
                      {perm.pageTitle ? (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {perm.pageTitle}
                        </div>
                      ) : (
                        <Badge variant="outline">Все страницы</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {perm.groupName ? (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {perm.groupName}
                        </div>
                      ) : perm.userName ? (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          {perm.userName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPermissionIcon(perm.permission)}
                        {getPermissionBadge(perm.permission)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePermission(perm.id)}
                        disabled={removePermission.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Нет настроенных прав доступа</p>
              <p className="text-sm">Нажмите "Добавить права" для создания первой записи</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle>Как работают права доступа</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">Чтение</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Пользователь может просматривать страницу, но не может редактировать
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Edit className="h-5 w-5 text-blue-500" />
                <h4 className="font-medium">Редактирование</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Пользователь может просматривать и редактировать содержимое страницы
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-purple-500" />
                <h4 className="font-medium">Администратор</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Полный доступ: редактирование, удаление и управление правами страницы
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            <strong>Приоритет прав:</strong> Индивидуальные права пользователя имеют приоритет над групповыми. 
            Права на конкретную страницу имеют приоритет над глобальными правами.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
