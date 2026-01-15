import { useState, useCallback, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { WikiEditor } from "@/components/WikiEditor";
import { FavoriteButton } from "@/components/FavoriteButton";
import { FavoritesSidebar } from "@/components/FavoritesSidebar";
import { TagInput } from "@/components/TagInput";
import { PageTree } from "@/components/PageTree";
import { FolderImport } from "@/components/FolderImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Menu,
  Save,
  Settings,
  History,
  Share2,
  MoreHorizontal,
  FileText,
  Loader2,
  ChevronLeft,
  Globe,
  Lock,
  Search,
  LogIn,
  Download,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/const";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "react-i18next";
import { useLocalizedError } from "@/hooks/useLocalizedError";

interface Page {
  id: number;
  title: string;
  slug: string;
  content: string | null;
  contentJson: unknown;
  icon: string | null;
  coverImage: string | null;
  isPublic: boolean;
  parentId: number | null;
}

export default function Wiki() {
  const { t } = useTranslation();
  const { getErrorMessage } = useLocalizedError();
  const params = useParams<{ slug?: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [editedContentJson, setEditedContentJson] = useState<object | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageParentId, setNewPageParentId] = useState<number | undefined>();
  const [newPageIsPublic, setNewPageIsPublic] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<number | null>(null);
  
  const utils = trpc.useUtils();
  
  // Queries
  const { data: pageData, isLoading: pageLoading } = trpc.pages.getBySlug.useQuery(
    { slug: params.slug || "" },
    { enabled: !!params.slug }
  );
  
  const { data: versions } = trpc.pages.getVersions.useQuery(
    { pageId: currentPage?.id || 0 },
    { enabled: !!currentPage?.id && historyDialogOpen }
  );
  
  // Mutations
  const createPage = trpc.pages.create.useMutation({
    onSuccess: (data) => {
      utils.pages.getRootPages.invalidate();
      utils.pages.getChildren.invalidate();
      setCreateDialogOpen(false);
      setNewPageTitle("");
      setNewPageParentId(undefined);
      setLocation(`/wiki/${data.slug}`);
      toast.success(t("wiki.pageCreated"));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
  
  const updatePage = trpc.pages.update.useMutation({
    onSuccess: () => {
      utils.pages.getBySlug.invalidate({ slug: params.slug });
      utils.pages.getRootPages.invalidate();
      setHasChanges(false);
      toast.success(t("wiki.pageUpdated"));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
  
  const deletePage = trpc.pages.delete.useMutation({
    onSuccess: () => {
      utils.pages.getRootPages.invalidate();
      utils.pages.getChildren.invalidate();
      setDeleteDialogOpen(false);
      setPageToDelete(null);
      setLocation("/wiki");
      toast.success(t("wiki.pageDeleted"));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
  
  const rollbackPage = trpc.pages.rollback.useMutation({
    onSuccess: () => {
      utils.pages.getBySlug.invalidate({ slug: params.slug });
      setHistoryDialogOpen(false);
      toast.success(t("wiki.versionRestored"));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
  
  const uploadMedia = trpc.media.upload.useMutation();
  const exportMarkdown = trpc.markdown.exportPage.useMutation();
  
  // Effects
  useEffect(() => {
    if (pageData) {
      setCurrentPage(pageData as Page);
      setEditedTitle(pageData.title);
      setEditedContent(pageData.content || "");
      setEditedContentJson(pageData.contentJson as object || null);
      setHasChanges(false);
      setIsEditMode(false); // Reset to view mode when page changes
    }
  }, [pageData]);
  
  // Handlers
  const handleContentChange = useCallback((content: string, json: object) => {
    setEditedContent(content);
    setEditedContentJson(json);
    setHasChanges(true);
  }, []);
  
  const handleTitleChange = useCallback((title: string) => {
    setEditedTitle(title);
    setHasChanges(true);
  }, []);
  
  const handleSave = async () => {
    if (!currentPage) return;
    
    setSaving(true);
    try {
      await updatePage.mutateAsync({
        id: currentPage.id,
        title: editedTitle,
        content: editedContent,
        contentJson: editedContentJson,
      });
    } finally {
      setSaving(false);
    }
  };
  
  const handleCreatePage = () => {
    if (!newPageTitle.trim()) return;
    
    createPage.mutate({
      title: newPageTitle,
      parentId: newPageParentId,
      isPublic: newPageIsPublic,
    });
  };
  
  const handleDeletePage = () => {
    if (pageToDelete) {
      deletePage.mutate({ id: pageToDelete });
    }
  };
  
  const handleImageUpload = async (file: File): Promise<string> => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const result = await uploadMedia.mutateAsync({
            filename: file.name,
            mimeType: file.type,
            base64Data: base64,
            pageId: currentPage?.id,
          });
          resolve(result.url);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  const handleVideoUpload = async (file: File): Promise<string> => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const result = await uploadMedia.mutateAsync({
            filename: file.name,
            mimeType: file.type,
            base64Data: base64,
            pageId: currentPage?.id,
          });
          resolve(result.url);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  const handleRollback = (version: number) => {
    if (!currentPage) return;
    rollbackPage.mutate({ pageId: currentPage.id, version });
  };
  
  const openCreateDialog = (parentId?: number) => {
    setNewPageParentId(parentId);
    setNewPageTitle("");
    setNewPageIsPublic(false);
    setCreateDialogOpen(true);
  };
  
  const openDeleteDialog = (pageId: number) => {
    setPageToDelete(pageId);
    setDeleteDialogOpen(true);
  };
  
  const isAdmin = user?.role === "admin";
  
  // Check page-specific permissions
  const { data: pagePermission } = trpc.pages.checkMyPermission.useQuery(
    { pageId: currentPage?.id || 0 },
    { enabled: !!currentPage?.id }
  );
  
  // User can edit if they have edit/admin permission on this page
  const canEdit = isAdmin || pagePermission?.canEdit || false;
  const canRead = pagePermission?.canRead || currentPage?.isPublic || isAdmin || false;
  
  // Loading state
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg hidden sm:inline">Scoliologic Wiki</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/search")}
          >
            <Search className="h-4 w-4 mr-2" />
            {t("common.search")}
          </Button>
          
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/admin")}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}
              
              <NotificationBell />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium">
                        {user?.name?.charAt(0) || "U"}
                      </span>
                    </div>
                    <span className="hidden sm:inline">{user?.name || "User"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation("/profile")}>
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation("/logout")}>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button size="sm" onClick={() => window.location.href = getLoginUrl()}>
              <LogIn className="h-4 w-4 mr-2" />
              {t("auth.login")}
            </Button>
          )}
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Sidebar */}
          <ResizablePanel
            defaultSize={20}
            minSize={15}
            maxSize={35}
            className={cn(
              "border-r bg-muted/30",
              !sidebarOpen && "hidden lg:block"
            )}
          >
            <ScrollArea className="h-full">
              {user && (
                <>
                  <FavoritesSidebar />
                  <div className="border-t" />
                </>
              )}
              <PageTree
                selectedPageId={currentPage?.id}
                onSelectPage={(page) => setLocation(`/wiki/${page.slug}`)}
                onCreatePage={canEdit ? openCreateDialog : undefined}
                onDeletePage={isAdmin ? openDeleteDialog : undefined}
                onEditPage={(page) => setLocation(`/wiki/${page.slug}`)}
                isAdmin={isAdmin}
              />
              
              {/* Folder Import - only for users with edit permission */}
              {canEdit && (
                <div className="border-t p-3">
                  <FolderImport
                    parentPageId={currentPage?.id}
                    onImportComplete={() => {
                      // Refresh page tree after import
                    }}
                  />
                </div>
              )}
            </ScrollArea>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* Content Area */}
          <ResizablePanel defaultSize={80}>
            <div className="h-full flex flex-col">
              {currentPage ? (
                <>
                  {/* Page Header */}
                  <div className="border-b p-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => setLocation("/wiki")}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      {isEditMode ? (
                        <Input
                          value={editedTitle}
                          onChange={(e) => handleTitleChange(e.target.value)}
                          className="text-xl font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0"
                          placeholder="Page title..."
                        />
                      ) : (
                        <h1 className="text-xl font-semibold truncate">{currentPage.title}</h1>
                      )}
                      
                      {currentPage.isPublic ? (
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      
                      {/* Edit button - only shown to users with edit permission */}
                      {canEdit && !isEditMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditMode(true)}
                          className="ml-2"
                        >
                          {t("common.edit")}
                        </Button>
                      )}
                      
                      {/* Cancel edit button */}
                      {isEditMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsEditMode(false);
                            setEditedTitle(currentPage.title);
                            setEditedContent(currentPage.content || "");
                            setEditedContentJson(currentPage.contentJson as object || null);
                            setHasChanges(false);
                          }}
                          className="ml-2"
                        >
                          {t("common.cancel")}
                        </Button>
                      )}
                    </div>
                    
                    {/* Tags */}
                    <div className="flex-1 min-w-0">
                      <TagInput pageId={currentPage.id} editable={isEditMode} />
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {currentPage && (
                        <FavoriteButton pageId={currentPage.id} />
                      )}
                      
                      {isEditMode && hasChanges && (
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          {t("common.save")}
                        </Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setHistoryDialogOpen(true)}>
                            <History className="h-4 w-4 mr-2" />
                            {t("wiki.viewHistory")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            toast.success(t("common.copied"));
                          }}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Copy Link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={async () => {
                            if (!currentPage) return;
                            try {
                              const result = await exportMarkdown.mutateAsync({ pageId: currentPage.id });
                              const blob = new Blob([result.content], { type: 'text/markdown' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = result.filename;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast.success(t("export.exportSuccess"));
                            } catch (error) {
                              toast.error(t("export.exportError"));
                            }
                          }}>
                            <FileDown className="h-4 w-4 mr-2" />
                            {t("export.exportAs")} Markdown
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setLocation(`/admin/pages/${currentPage.id}`)}>
                                <Settings className="h-4 w-4 mr-2" />
                                Page Settings
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  
                  {/* Editor */}
                  <ScrollArea className="flex-1">
                    <div className="max-w-4xl mx-auto p-6">
                      <WikiEditor
                        content={currentPage.content || ""}
                        contentJson={currentPage.contentJson as object}
                        onChange={handleContentChange}
                        editable={isEditMode}
                        onImageUpload={isEditMode ? handleImageUpload : undefined}
                        onVideoUpload={isEditMode ? handleVideoUpload : undefined}
                      />
                    </div>
                  </ScrollArea>
                </>
              ) : pageLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">{t("wiki.welcome")}</h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    {t("wiki.noPages")} {t("wiki.createFirstPage")}
                  </p>
                  {canEdit && (
                    <Button onClick={() => openCreateDialog()}>
                      {t("wiki.createPage")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      {/* Create Page Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wiki.createPage")}</DialogTitle>
            <DialogDescription>
              {t("wiki.pageTitle")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("wiki.pageTitle")}</Label>
              <Input
                id="title"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder={t("wiki.enterTitle")}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("wiki.visibility")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("wiki.makePublic")}
                </p>
              </div>
              <Switch
                checked={newPageIsPublic}
                onCheckedChange={setNewPageIsPublic}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreatePage} disabled={!newPageTitle.trim() || createPage.isPending}>
              {createPage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("wiki.createPage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("wiki.deletePage")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("wiki.confirmDelete")} {t("wiki.deleteWarning")}
              {t("wiki.deleteChildPages")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Version History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("wiki.history")}</DialogTitle>
            <DialogDescription>
              View and restore previous versions of this page.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {versions?.map((version: {
                id: number;
                version: number;
                title: string;
                changeDescription: string | null;
                createdAt: Date;
                createdByName: string | null;
              }) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium">Version {version.version}</div>
                    <div className="text-sm text-muted-foreground">
                      {version.changeDescription || "No description"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {version.createdByName} • {new Date(version.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollback(version.version)}
                      disabled={rollbackPage.isPending}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              ))}
              
              {(!versions || versions.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No version history available
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
