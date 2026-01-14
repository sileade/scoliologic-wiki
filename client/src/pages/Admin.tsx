import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Users,
  Shield,
  Settings,
  Activity,
  FileText,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit,
  UserPlus,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { useTranslation } from "react-i18next";

export default function Admin() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Dialogs
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<{ id: number; name: string; description: string | null; color: string | null } | null>(null);
  
  // Form states
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#3B82F6");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedMemberRole, setSelectedMemberRole] = useState<"member" | "editor" | "admin">("member");
  
  const utils = trpc.useUtils();
  
  // Queries
  const { data: stats } = trpc.admin.getDashboardStats.useQuery();
  const { data: users } = trpc.users.list.useQuery();
  const { data: groups } = trpc.groups.list.useQuery();
  const { data: activityLogs } = trpc.admin.getActivityLogs.useQuery({ limit: 50 });
  const { data: accessRequests } = trpc.admin.getPendingAccessRequests.useQuery();
  const { data: groupMembers } = trpc.groups.getMembers.useQuery(
    { groupId: selectedGroup?.id || 0 },
    { enabled: !!selectedGroup?.id }
  );
  
  // Mutations
  const createGroup = trpc.groups.create.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      setCreateGroupOpen(false);
      setNewGroupName("");
      setNewGroupDescription("");
      toast.success(t("admin.groupCreated"));
    },
  });
  
  const updateGroup = trpc.groups.update.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      setEditGroupOpen(false);
      setSelectedGroup(null);
      toast.success(t("admin.groupUpdated"));
    },
  });
  
  const deleteGroup = trpc.groups.delete.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      toast.success(t("admin.groupDeleted"));
    },
  });
  
  const addMember = trpc.groups.addMember.useMutation({
    onSuccess: () => {
      utils.groups.getMembers.invalidate({ groupId: selectedGroup?.id });
      setAddMemberOpen(false);
      setSelectedUserId("");
      toast.success(t("admin.memberAdded"));
    },
  });
  
  const removeMember = trpc.groups.removeMember.useMutation({
    onSuccess: () => {
      utils.groups.getMembers.invalidate({ groupId: selectedGroup?.id });
      toast.success(t("admin.memberRemoved"));
    },
  });
  
  const updateUserRole = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success(t("admin.roleUpdated"));
    },
  });
  
  const handleAccessRequest = trpc.admin.handleAccessRequest.useMutation({
    onSuccess: () => {
      utils.admin.getPendingAccessRequests.invalidate();
      toast.success(t("admin.requestHandled"));
    },
  });
  
  // Auth check
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (user?.role !== "admin") {
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <Shield className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-4">{t("errors.forbidden")}</p>
        <Button onClick={() => setLocation("/wiki")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setLocation("/wiki")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{t("admin.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("admin.userManagement")}</p>
            </div>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">
              <Activity className="h-4 w-4 mr-2" />
              {t("admin.dashboard")}
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              {t("admin.users")}
            </TabsTrigger>
            <TabsTrigger value="groups">
              <Shield className="h-4 w-4 mr-2" />
              {t("admin.groups")}
            </TabsTrigger>
            <TabsTrigger value="requests">
              <FileText className="h-4 w-4 mr-2" />
              {t("admin.permissions")}
              {accessRequests && accessRequests.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {accessRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="h-4 w-4 mr-2" />
              {t("admin.logs")}
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <Activity className="h-4 w-4 mr-2" />
              {t("admin.analytics")}
            </TabsTrigger>
          </TabsList>
          
          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("admin.totalUsers")}</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("admin.totalPages")}</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalPages || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("admin.totalGroups")}</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalGroups || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("admin.permissions")}</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{accessRequests?.length || 0}</div>
                </CardContent>
              </Card>
            </div>
            
            {/* Recent Activity */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{t("admin.recentActivity")}</CardTitle>
                <CardDescription>{t("admin.logs")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {stats?.recentActivity?.map((log: {
                      id: number;
                      action: string;
                      entityType: string;
                      createdAt: Date;
                      userName: string | null;
                    }) => (
                      <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{log.userName || "System"}</span>
                            {" "}{log.action.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.userManagement")}</CardTitle>
                <CardDescription>{t("admin.users")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.userName")}</TableHead>
                      <TableHead>{t("admin.userEmail")}</TableHead>
                      <TableHead>{t("admin.role")}</TableHead>
                      <TableHead>{t("admin.recentActivity")}</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((u: {
                      id: number;
                      name: string | null;
                      email: string | null;
                      role: "user" | "admin" | "guest";
                      lastSignedIn: Date;
                    }) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name || "—"}</TableCell>
                        <TableCell>{u.email || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : u.role === "guest" ? "secondary" : "outline"}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(u.lastSignedIn).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateUserRole.mutate({ userId: u.id, role: "admin" })}>
                                Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateUserRole.mutate({ userId: u.id, role: "user" })}>
                                Make User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateUserRole.mutate({ userId: u.id, role: "guest" })}>
                                Make Guest
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Groups Tab */}
          <TabsContent value="groups">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Groups List */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{t("admin.groups")}</CardTitle>
                    <CardDescription>{t("admin.groupManagement")}</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setCreateGroupOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("admin.createGroup")}
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {groups?.map((group: {
                        id: number;
                        name: string;
                        description: string | null;
                        color: string | null;
                      }) => (
                        <div
                          key={group.id}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-colors",
                            selectedGroup?.id === group.id ? "bg-muted border-primary" : "hover:bg-muted/50"
                          )}
                          onClick={() => setSelectedGroup(group)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: group.color || "#3B82F6" }}
                              />
                              <span className="font-medium">{group.name}</span>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedGroup(group);
                                  setNewGroupName(group.name);
                                  setNewGroupDescription(group.description || "");
                                  setNewGroupColor(group.color || "#3B82F6");
                                  setEditGroupOpen(true);
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteGroup.mutate({ id: group.id })}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t("common.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {group.description && (
                            <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                          )}
                        </div>
                      ))}
                      
                      {(!groups || groups.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          No groups yet. Create one to get started.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              
              {/* Group Members */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>
                      {selectedGroup ? `${selectedGroup.name} - ${t("admin.groupMembers")}` : t("admin.groupMembers")}
                    </CardTitle>
                    <CardDescription>
                      {selectedGroup ? t("admin.groupManagement") : t("admin.groups")}
                    </CardDescription>
                  </div>
                  {selectedGroup && (
                    <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t("admin.addMember")}
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {selectedGroup ? (
                    <ScrollArea className="h-96">
                      <div className="space-y-2">
                        {groupMembers?.map((member: {
                          id: number;
                          userId: number;
                          role: "member" | "editor" | "admin";
                          userName: string | null;
                          userEmail: string | null;
                        }) => (
                          <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                            <div>
                              <p className="font-medium">{member.userName || "Unknown"}</p>
                              <p className="text-sm text-muted-foreground">{member.userEmail}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{member.role}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive"
                                onClick={() => removeMember.mutate({
                                  groupId: selectedGroup.id,
                                  userId: member.userId,
                                })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        {(!groupMembers || groupMembers.length === 0) && (
                          <div className="text-center py-8 text-muted-foreground">
                            No members in this group yet.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-96 flex items-center justify-center text-muted-foreground">
                      Select a group to view its members
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Access Requests Tab */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Pending Access Requests</CardTitle>
                <CardDescription>Review and approve access requests</CardDescription>
              </CardHeader>
              <CardContent>
                {accessRequests && accessRequests.length > 0 ? (
                  <div className="space-y-3">
                    {accessRequests.map((request: {
                      id: number;
                      userName: string | null;
                      userEmail: string | null;
                      pageName: string | null;
                      groupName: string | null;
                      requestedPermission: string;
                      message: string | null;
                      createdAt: Date;
                    }) => (
                      <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{request.userName || request.userEmail}</p>
                          <p className="text-sm text-muted-foreground">
                            Requesting {request.requestedPermission} access to{" "}
                            {request.pageName || request.groupName || "resource"}
                          </p>
                          {request.message && (
                            <p className="text-sm mt-1 italic">"{request.message}"</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(request.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAccessRequest.mutate({ requestId: request.id, action: "approve" })}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => handleAccessRequest.mutate({ requestId: request.id, action: "reject" })}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending access requests
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Activity Log Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>System-wide activity history</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLogs?.map((log: {
                        id: number;
                        action: string;
                        entityType: string;
                        entityId: number | null;
                        createdAt: Date;
                        userName: string | null;
                        userEmail: string | null;
                      }) => (
                        <TableRow key={log.id}>
                          <TableCell>{log.userName || log.userEmail || "System"}</TableCell>
                          <TableCell>{log.action.replace(/_/g, " ")}</TableCell>
                          <TableCell>
                            {log.entityType} {log.entityId ? `#${log.entityId}` : ""}
                          </TableCell>
                          <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Create Group Dialog */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.createGroup")}</DialogTitle>
            <DialogDescription>{t("admin.groupDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("admin.groupName")}</Label>
              <Input
                id="name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Engineering Team"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("admin.groupDescription")}</Label>
              <Input
                id="description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Optional description..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">{t("tags.tagColor")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="color"
                  type="color"
                  value={newGroupColor}
                  onChange={(e) => setNewGroupColor(e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={newGroupColor}
                  onChange={(e) => setNewGroupColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => createGroup.mutate({
              name: newGroupName,
              description: newGroupDescription,
              color: newGroupColor,
            })} disabled={!newGroupName.trim() || createGroup.isPending}>
              {createGroup.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("admin.createGroup")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Group Dialog */}
      <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.editGroup")}</DialogTitle>
            <DialogDescription>{t("admin.groupDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("admin.groupName")}</Label>
              <Input
                id="edit-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("admin.groupDescription")}</Label>
              <Input
                id="edit-description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-color">{t("tags.tagColor")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="edit-color"
                  type="color"
                  value={newGroupColor}
                  onChange={(e) => setNewGroupColor(e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={newGroupColor}
                  onChange={(e) => setNewGroupColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => selectedGroup && updateGroup.mutate({
              id: selectedGroup.id,
              name: newGroupName,
              description: newGroupDescription,
              color: newGroupColor,
            })} disabled={!newGroupName.trim() || updateGroup.isPending}>
              {updateGroup.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.addMember")} - {selectedGroup?.name}</DialogTitle>
            <DialogDescription>{t("admin.groupMembers")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((u: { id: number; name: string | null; email: string | null }) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.name || u.email || `User #${u.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedMemberRole} onValueChange={(v) => setSelectedMemberRole(v as "member" | "editor" | "admin")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t("admin.roles.reader")}</SelectItem>
                  <SelectItem value="editor">{t("admin.roles.editor")}</SelectItem>
                  <SelectItem value="admin">{t("admin.roles.admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => selectedGroup && addMember.mutate({
              groupId: selectedGroup.id,
              userId: parseInt(selectedUserId),
              role: selectedMemberRole,
            })} disabled={!selectedUserId || addMember.isPending}>
              {addMember.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("admin.addMember")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
