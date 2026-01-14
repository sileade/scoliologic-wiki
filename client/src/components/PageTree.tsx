import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
  Lock,
  Globe,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocation } from "wouter";

interface Page {
  id: number;
  title: string;
  slug: string;
  icon: string | null;
  isPublic: boolean;
  parentId: number | null;
}

interface PageTreeItemProps {
  page: Page;
  level: number;
  selectedPageId?: number;
  onSelect: (page: Page) => void;
  onCreateChild: (parentId: number) => void;
  onDelete: (pageId: number) => void;
  onEdit: (page: Page) => void;
  isAdmin?: boolean;
}

function PageTreeItem({
  page,
  level,
  selectedPageId,
  onSelect,
  onCreateChild,
  onDelete,
  onEdit,
  isAdmin,
}: PageTreeItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const { data: children, isLoading } = trpc.pages.getChildren.useQuery(
    { parentId: page.id },
    { enabled: isOpen }
  );

  const hasChildren = children && children.length > 0;
  const isSelected = selectedPageId === page.id;

  return (
    <div>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={cn(
            "flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer group",
            "hover:bg-muted/50 transition-colors",
            isSelected && "bg-muted"
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => onSelect(page)}
        >
          <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 hover:bg-muted"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <span className="text-lg mr-1">
            {page.icon || <FileText className="h-4 w-4 text-muted-foreground" />}
          </span>
          
          <span className="flex-1 truncate text-sm">{page.title}</span>
          
          {page.isPublic ? (
            <Globe className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Lock className="h-3 w-3 text-muted-foreground" />
          )}
          
          {(isHovered || isSelected) && (
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                onClick={() => onCreateChild(page.id)}
              >
                <Plus className="h-3 w-3" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(page)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(page.slug)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDelete(page.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        
        <CollapsibleContent>
          {hasChildren && (
            <div>
              {children.map((child: Page) => (
                <PageTreeItem
                  key={child.id}
                  page={child}
                  level={level + 1}
                  selectedPageId={selectedPageId}
                  onSelect={onSelect}
                  onCreateChild={onCreateChild}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface PageTreeProps {
  selectedPageId?: number;
  onSelectPage?: (page: Page) => void;
  onCreatePage?: (parentId?: number) => void;
  onDeletePage?: (pageId: number) => void;
  onEditPage?: (page: Page) => void;
  isAdmin?: boolean;
  className?: string;
}

export function PageTree({
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  onEditPage,
  isAdmin,
  className,
}: PageTreeProps) {
  const [, setLocation] = useLocation();
  
  const { data: rootPages, isLoading } = trpc.pages.getRootPages.useQuery();

  const handleSelect = useCallback((page: Page) => {
    onSelectPage?.(page);
    setLocation(`/wiki/${page.slug}`);
  }, [onSelectPage, setLocation]);

  const handleCreateChild = useCallback((parentId: number) => {
    onCreatePage?.(parentId);
  }, [onCreatePage]);

  const handleDelete = useCallback((pageId: number) => {
    onDeletePage?.(pageId);
  }, [onDeletePage]);

  const handleEdit = useCallback((page: Page) => {
    onEditPage?.(page);
  }, [onEditPage]);

  if (isLoading) {
    return (
      <div className={cn("p-4 flex items-center justify-center", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("py-2", className)}>
      <div className="px-3 mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Pages
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => onCreatePage?.()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {rootPages && rootPages.length > 0 ? (
        <div className="space-y-0.5">
          {rootPages.map((page: Page) => (
            <PageTreeItem
              key={page.id}
              page={page}
              level={0}
              selectedPageId={selectedPageId}
              onSelect={handleSelect}
              onCreateChild={handleCreateChild}
              onDelete={handleDelete}
              onEdit={handleEdit}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      ) : (
        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No pages yet</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => onCreatePage?.()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create first page
          </Button>
        </div>
      )}
    </div>
  );
}

export default PageTree;
